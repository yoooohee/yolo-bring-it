from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import numpy as np
import io
import cv2
import base64
from io import BytesIO
from rembg import remove
from transformers import CLIPProcessor, CLIPModel, WhisperProcessor, pipeline
from torch.nn.functional import softmax
import socketio
import mediapipe as mp
import librosa
from scipy.spatial.distance import cosine
import difflib
import tempfile
import os
import logging
import sys
import torch
from detectron2.config import get_cfg
from detectron2.engine import DefaultPredictor
from detectron2.data import MetadataCatalog
sys.path.insert(0, '/home/j-i13c207/Detic/third_party/CenterNet2')
from centernet.config import add_centernet_config
sys.path.insert(0, '/home/j-i13c207/Detic/third_party/Deformable-DETR')
from detic.config import add_detic_config

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# SocketIO와 EngineIO 로거 설정
logging.getLogger("socketio").setLevel(logging.WARNING)
logging.getLogger("engineio").setLevel(logging.WARNING)
logging.getLogger("uvicorn").setLevel(logging.WARNING)
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

app = FastAPI(
    title="FAST API",
    description="API for object detection, emotion analysis, color similarity, and audio processing",
    version="1.0.0",
    openapi_url="/openapi.json"
)

# CORS 설정 (localhost 테스트용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # React 앱의 주소
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 모델 초기화
clip_model = None
clip_processor = None
whisper_processor = None
stt_pipeline = None
face_mesh = None
detic_predictor = None

# 모델 로드 함수
def load_detic_model():
    global detic_predictor
    if detic_predictor is None:
        try:
            cfg = get_cfg()
            add_centernet_config(cfg)
            add_detic_config(cfg)
            cfg.merge_from_file("/home/j-i13c207/Detic/configs/Detic_LCOCOI21k_CLIP_SwinB_896b32_4x_ft4x_max-size.yaml")
            cfg.MODEL.WEIGHTS = "/home/j-i13c207/Detic/runs/detic_train/model_best.pth"
            cfg.MODEL.ROI_HEADS.SCORE_THRESH_TEST = 0.5
            cfg.MODEL.ROI_HEADS.NUM_CLASSES = 1203
            cfg.MODEL.DETIC.MAX_SIZE_TEST = 640
            cfg.MODEL.DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
            detic_predictor = DefaultPredictor(cfg)
            logger.info("Detic model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Detic model: {e}")
            raise
    return detic_predictor

def load_clip_model():
    global clip_model, clip_processor
    if clip_model is None or clip_processor is None:
        try:
            clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
            clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
            logger.info("CLIP model and processor loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load CLIP model: {e}")
            raise
    return clip_model, clip_processor

def load_whisper_model():
    global whisper_processor, stt_pipeline
    if whisper_processor is None or stt_pipeline is None:
        try:
            whisper_processor = WhisperProcessor.from_pretrained("openai/whisper-base")
            stt_pipeline = pipeline(
                "automatic-speech-recognition",
                model="openai/whisper-base",
                chunk_length_s=30,
                stride_length_s=(4, 2)
            )
            logger.info("Whisper model and pipeline loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise
    return whisper_processor, stt_pipeline

def load_face_mesh():
    global face_mesh
    if face_mesh is None:
        try:
            mp_face_mesh = mp.solutions.face_mesh
            face_mesh = mp_face_mesh.FaceMesh(
                static_image_mode=False,
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5
            )
            logger.info("MediaPipe FaceMesh loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load FaceMesh: {e}")
            raise
    return face_mesh

# Detic 객체 탐지 엔드포인트
@app.post("/predict-object")
async def predict_object(member_id: int = Query(..., description="Member ID indicating who sent the request"), file: UploadFile = File(...)):
    try:
        predictor = load_detic_model()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detic model load failed: {str(e)}")
    contents = await file.read()
    image = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)

    outputs = predictor(image)
    instances = outputs["instances"].to("cpu")
    objects = []
    metadata = MetadataCatalog.get(predictor.cfg.DATASETS.TEST[0])
    for i in range(len(instances)):
        cls = instances.pred_classes[i].item()
        label = metadata.thing_classes[cls] if hasattr(metadata, 'thing_classes') else f"class_{cls}"
        confidence = instances.scores[i].item()
        objects.append({"label": label, "confidence": round(confidence, 3)})

    return {"member_id": member_id, "results": objects}

# 기존 엔드포인트들
@app.post("/predict-emotion")
async def predict_emotion(member_id: int = Query(..., description="Member ID indicating who sent the request"), file: UploadFile = File(...)):
    contents = await file.read()
    img = Image.open(io.BytesIO(contents))
    img_np = np.array(img)

    try:
        result = DeepFace.analyze(img_np, actions=['emotion'], enforce_detection=True)
        emotions = {k: round(float(v), 2) for k, v in result[0]["emotion"].items()}
        return {
            "member_id": member_id,
            "dominant_emotion": result[0]["dominant_emotion"],
            "emotions": emotions
        }
    except Exception as e:
        return {"member_id": member_id, "error": str(e)}

def compute_color_similarity_score_np(img_np, target_rgb, threshold=50):
    pixels = img_np.reshape(-1, 3)
    dists = np.linalg.norm(pixels - np.array(target_rgb), axis=1)
    similar_pixels = np.sum(dists < threshold)
    total_pixels = pixels.shape[0]
    score = similar_pixels / total_pixels * 100
    return round(score, 2)

@app.post("/color-score")
async def color_score(member_id: int = Query(..., description="Member ID indicating who sent the request"), file: UploadFile = File(...), r: int = 0, g: int = 255, b: int = 0):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    img_np = np.array(image)
    score = compute_color_similarity_score_np(img_np, (r, g, b))
    return {
        "member_id": member_id,
        "target_color": {"r": r, "g": g, "b": b},
        "score_percent": score
    }

@app.post("/color-closest")
async def color_closest(member_id: int = Query(..., description="Member ID indicating who sent the request"), file: UploadFile = File(...), r: int = 0, g: int = 255, b: int = 0):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    img_np = np.array(image)
    pixels = img_np.reshape(-1, 3)
    target_rgb = np.array([r, g, b])

    dists = np.linalg.norm(pixels - target_rgb, axis=1)
    closest_idx = np.argmin(dists)
    closest_color = pixels[closest_idx]
    distance = np.linalg.norm(closest_color - target_rgb)

    max_dist = np.linalg.norm([255, 255, 255])
    similarity = 100 - (distance / max_dist * 100)
    similarity = round(similarity, 2)

    return {
        "member_id": member_id,
        "target_color": target_rgb.tolist(),
        "closest_color": closest_color.tolist(),
        "color_distance": round(distance, 2),
        "similarity_score": similarity
    }

def image_to_base64(pil_image):
    buffered = BytesIO()
    pil_image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode()

@app.post("/analyze-emotion-nobg")
async def analyze_emotion_nobg(member_id: int = Query(..., description="Member ID indicating who sent the request"), file: UploadFile = File(...)):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")

    result_bytes = remove(io.BytesIO(contents).getvalue())
    image_nobg = Image.open(io.BytesIO(result_bytes)).convert("RGB")

    try:
        image_np = np.array(image_nobg)
        result = DeepFace.analyze(img_path=image_np, actions=["emotion"], enforce_detection=True)[0]
        region = result["region"]
        return {
            "member_id": member_id,
            "dominant_emotion": result["dominant_emotion"],
            "emotion_scores": {k: float(v) for k, v in result["emotion"].items()},
            "face_region": region,
            "image_base64": image_to_base64(image_nobg)
        }
    except ValueError:
        return {
            "member_id": member_id,
            "success": False,
            "message": "😥 얼굴을 인식하지 못했습니다. 정면 얼굴 사진을 사용해주세요."
        }

@app.post("/clip-multi-similarity")
async def clip_multi_similarity(member_id: int = Query(..., description="Member ID indicating who sent the request"), file: UploadFile = File(...)):
    try:
        model, processor = load_clip_model()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CLIP model load failed: {str(e)}")
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")

    texts = ["a photo of a dog", "a photo of a butterfly", "a photo of a person", "a photo of a flower", "a photo of a snail"]
    inputs = processor(text=texts, images=image, return_tensors="pt", padding=True)
    outputs = model(**inputs)

    logits = outputs.logits_per_image
    probs = softmax(logits, dim=1).squeeze()
    scores = {text: round(prob.item() * 100, 2) for text, prob in zip(texts, probs)}
    best_match = max(scores, key=scores.get)

    return {
        "member_id": member_id,
        "scores": scores,
        "best_match": best_match,
        "best_score_percent": scores[best_match]
    }

# SocketIO 설정
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=["http://localhost:3000"],
    transports=['websocket', 'polling'],
    logger=False,
    engineio_logger=False
)
app.mount("/socket.io/", socketio.ASGIApp(sio))

# 이전 상태 추적
eyes_closed = False

@sio.event
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")

@sio.on('frame')
async def process_frame(sid, data):
    global eyes_closed
    try:
        face_mesh = load_face_mesh()
    except Exception as e:
        logger.error(f"FaceMesh load failed: {e}")
        await sio.emit('face_result', {'error': f"FaceMesh load failed: {str(e)}"}, room=sid)
        return

    img_data = base64.b64decode(data['frame'])
    img_array = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(img_rgb)

    if results.multi_face_landmarks:
        landmarks = results.multi_face_landmarks[0].landmark
        left_eye_upper = np.array([landmarks[159].x, landmarks[159].y])
        left_eye_lower = np.array([landmarks[145].x, landmarks[145].y])
        left_distance = np.linalg.norm(left_eye_upper - left_eye_lower)
        right_eye_upper = np.array([landmarks[386].x, landmarks[386].y])
        right_eye_lower = np.array([landmarks[374].x, landmarks[374].y])
        right_distance = np.linalg.norm(right_eye_upper - right_eye_lower)
        avg_distance = (left_distance + right_distance) / 2
        is_closed = bool(avg_distance < 0.02)

        if is_closed != eyes_closed:
            eyes_closed = is_closed
            status = "closed" if is_closed else "opened"
            await sio.emit('eye_event', {'status': status}, room=sid)

        await sio.emit('face_result', {'closed': bool(eyes_closed)}, room=sid)
    else:
        await sio.emit('face_result', {'error': 'No face detected'}, room=sid)

@app.post("/audio-similarity")
async def audio_similarity(
    member_id: int = Query(..., description="Member ID indicating who sent the request"),
    target_file: UploadFile = File(...),
    user_file: UploadFile = File(...),
    language: str = Query("ko-KR")
):
    try:
        whisper_processor, stt_pipeline = load_whisper_model()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Whisper model load failed: {str(e)}")

    try:
        target_contents = await target_file.read()
        user_contents = await user_file.read()

        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as target_temp, \
             tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as user_temp:
            target_temp.write(target_contents)
            user_temp.write(user_contents)
            target_path = target_temp.name
            user_path = user_temp.name

        target_y, target_sr = librosa.load(target_path, sr=16000)
        user_y, user_sr = librosa.load(user_path, sr=16000)

        target_mfcc = librosa.feature.mfcc(y=target_y, sr=target_sr, n_mfcc=13).mean(axis=1)
        user_mfcc = librosa.feature.mfcc(y=user_y, sr=user_sr, n_mfcc=13).mean(axis=1)
        mfcc_sim = max(0, 1 - cosine(target_mfcc, user_mfcc))

        target_pitch, _, _ = librosa.pyin(target_y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'))
        user_pitch, _, _ = librosa.pyin(user_y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'))
        target_pitch_mean = np.nanmean(target_pitch)
        user_pitch_mean = np.nanmean(user_pitch)
        pitch_sim = 0
        if target_pitch_mean and user_pitch_mean:
            pitch_sim = max(0, min(1, 1 - abs(target_pitch_mean - user_pitch_mean) / max(target_pitch_mean, user_pitch_mean, 1e-6)))

        target_tempo = float(librosa.beat.beat_track(y=target_y, sr=target_sr)[0])
        user_tempo = float Denver/librosa.beat.beat_track(y=user_y, sr=user_sr)[0])
        tempo_sim = 0
        if target_tempo > 0 and user_tempo > 0:
            tempo_sim = max(0, min(1, 1 - abs(target_tempo - user_tempo) / max(target_tempo, user_tempo)))

        audio_sim = (mfcc_sim + pitch_sim + tempo_sim) / 3
        audio_score = round(audio_sim * 100, 2)

        lang_map = {"ko-KR": "korean", "en-US": "english"}
        lang_name = lang_map.get(language, "english")
        forced_decoder_ids = whisper_processor.get_decoder_prompt_ids(language=lang_name, task="transcribe")

        target_result = stt_pipeline(
            target_path,
            generate_kwargs={"forced_decoder_ids": forced_decoder_ids, "language": lang_name}
        )
        user_result = stt_pipeline(
            user_path,
            generate_kwargs={"forced_decoder_ids": forced_decoder_ids, "language": lang_name}
        )
        target_text = target_result.get("text", "").strip()
        user_text = user_result.get("text", "").strip()

        if not target_text or not user_text:
            raise ValueError("STT 인식 실패: 오디오가 명확하지 않거나 언어 설정을 확인하세요.")

        text_ratio = difflib.SequenceMatcher(None, target_text, user_text).ratio()
        text_score = round(text_ratio * 100, 2)

        overall_score = round((text_score * 0.5 + audio_score * 0.5), 2)

        os.unlink(target_path)
        os.unlink(user_path)

        return {
            "member_id": member_id,
            "target_text": target_text,
            "user_text": user_text,
            "text_score_percent": text_score,
            "audio_score_percent": audio_score,
            "overall_score_percent": overall_score
        }
    except Exception as e:
        logger.error(f"Audio similarity error: {str(e)}")
        return {"member_id": member_id, "error": u(str(e))}

# 세션별 데이터 저장
session_data = {}

@sio.on('set_forbidden_word')
async def set_forbidden_word(sid, data):
    forbidden_word = data.get('word', '').strip().lower()
    if forbidden_word:
        session_data[sid] = {'word': forbidden_word, 'score': 10}
        await sio.emit('word_set', {'message': f'금지 단어가 설정되었습니다: {forbidden_word}', 'score': 10}, room=sid)
        logger.debug(f"Session {sid}: Forbidden word set to {forbidden_word}")
    else:
        await sio.emit('error', {'message': '유효하지 않은 금지 단어입니다.'}, room=sid)

@sio.on('audio_chunk')
async def process_audio_chunk(sid, data):
    if sid not in session_data:
        await sio.emit('error', {'message': '먼저 금지 단어를 설정하세요.'}, room=sid)
        return

    try:
        whisper_processor, stt_pipeline = load_whisper_model()
    except Exception as e:
        logger.error(f"Whisper model load failed: {e}")
        await sio.emit('error', {'message': f"Whisper model load failed: {str(e)}"}, room=sid)
        return

    try:
        audio_data = base64.b64decode(data['chunk'])
        if len(audio_data) == 0:
            logger.warning(f"Session {sid}: Empty audio chunk received")
            return

        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
            temp_audio.write(audio_data)
            audio_path = temp_audio.name

        lang_name = data.get('language', "korean")
        forced_decoder_ids = whisper_processor.get_decoder_prompt_ids(language=lang_name, task="transcribe")

        result = stt_pipeline(audio_path, generate_kwargs={"forced_decoder_ids": forced_decoder_ids})
        text = result.get("text", "").strip().lower()
        logger.debug(f"Session {sid}: Transcribed text: {text}")

        await sio.emit('transcription', {'text': text}, room=sid)

        if session_data[sid]['word'] in text:
            session_data[sid]['score'] -= 1
            await sio.emit('score_update', {'score': session_data[sid]['score']}, room=sid)
            if session_data[sid]['score'] <= 0:
                await sio.emit('out', {'message': 'OUT! 점수가 0이 되었습니다.'}, room=sid)
                del session_data[sid]
            else:
                await sio.emit('warning', {'message': f'금지 단어 감지! 점수 -1 (남은 점수: {session_data[sid]["score"]})'}, room=sid)

        os.unlink(audio_path)
    except Exception as e:
        logger.error(f"오디오 청크 오류: {str(e)}")
        await sio.emit('error', {'message': str(e)}, room=sid)
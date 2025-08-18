import io
import numpy as np
from PIL import Image
from deepface import DeepFace
from rembg import remove
import tempfile
import os

def analyze_face_emotion(image_data, do_emotion):
    # 이미지 로드 (bytes 직접 처리)
    try:
        image = Image.open(io.BytesIO(image_data)).convert("RGB")
    except Exception as e:
        return f"Error decoding image: {str(e)}"

    # 배경 제거
    try:
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format="PNG")
        result_bytes = remove(img_byte_arr.getvalue())
        image_nobg = Image.open(io.BytesIO(result_bytes)).convert("RGB")
    except Exception as e:
        return f"Error removing background: {str(e)}"

    # 감정 분석
    try:
        image_np = np.array(image_nobg)
        # 임시 파일로 저장 (구버전 DeepFace 호환)
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp_file:
            image_nobg.save(temp_file.name, format="PNG")
            # DeepFace 호출 (img_path 사용)
            result = DeepFace.analyze(img_path=temp_file.name, actions=["emotion"], enforce_detection=True)[0]
        os.remove(temp_file.name)  # 임시 파일 삭제
        
        emotions = result["emotion"]
        do_emotion = do_emotion.lower()
        if do_emotion not in emotions:
            return f"Emotion '{do_emotion}' not recognized"
        
        score = emotions.get(do_emotion, 0.0)
        return f"{do_emotion}:{score:.2f}%"
    except ValueError:
        return "Face not detected"
    except Exception as e:
        return f"Error: {str(e)}"
import io
from PIL import Image
import torch
from transformers import CLIPProcessor, CLIPModel
import logging

logger = logging.getLogger(__name__)

# CLIP 모델 로드 (서버 시작 시 한 번만)
try:
    model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
except Exception as e:
    logger.error(f"Failed to load CLIP model: {str(e)}")
    raise

def check_picture_similarity(image_data, target_picture):
    try:
        # image_data는 bytes이므로 바로 PIL 이미지로 변환
        image = Image.open(io.BytesIO(image_data)).convert("RGB")

        # 고정된 5개 텍스트
        texts = ["a photo of a dog", "a photo of a butterfly", "a photo of a person", "a photo of a flower", "a photo of a snail"]
        inputs = processor(text=texts, images=image, return_tensors="pt", padding=True)

        # 유사도 계산
        with torch.no_grad():
            outputs = model(**inputs)
        logits = outputs.logits_per_image
        probs = torch.softmax(logits, dim=1).squeeze()
        scores = {text: round(prob.item() * 100, 2) for text, prob in zip(texts, probs)}

        # target_picture에 해당하는 점수 추출
        target_text = f"a photo of a {target_picture.lower()}"
        if target_text not in scores:
            raise ValueError(f"Target picture '{target_picture}' not in valid texts: {texts}")
        similarity_percent = scores[target_text]

        # 디버깅 로그
        logger.info(f"All scores: {scores}")
        logger.info(f"Selected target: {target_text}, Similarity: {similarity_percent}%")

        return {
            "similarity_percent": f"{similarity_percent:.2f}%",
            "is_similar": True  # 이미지 처리 성공 시 PASS
        }
    except Exception as e:
        logger.error(f"Picture similarity error: {str(e)}")
        raise ValueError(f"Picture similarity 처리 중 오류: {str(e)}")
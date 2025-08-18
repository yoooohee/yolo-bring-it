from fastapi import FastAPI
from yolo_api import app as yolo_api_app
import psutil
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

cpu_usage = psutil.cpu_percent()
logger.info(f"CPU Usage during processing: {cpu_usage}%")

app = FastAPI(
    title="Main API",
    description="Main API mounting YOLO API for ML tasks",
    version="1.0.0"
)
logger.info("Mounting yolo_api_app")
app.mount("/api/v1", yolo_api_app)  # /api/v1로 마운트 변경
logger.info("yolo_api_app mounted successfully")
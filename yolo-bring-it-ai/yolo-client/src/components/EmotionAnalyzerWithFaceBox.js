import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

function EmotionAnalyzerWithFaceBox() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [emotionData, setEmotionData] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const imgRef = useRef(null);
  const [scale, setScale] = useState({ x: 1, y: 1 });

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
    setEmotionData(null);
    setErrorMsg("");
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await axios.post("http://localhost:8000/analyze-emotion-nobg", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success === false) {
        setErrorMsg(response.data.message);
      } else {
        setEmotionData(response.data);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("서버 오류 또는 얼굴 분석 실패.");
    }
  };

  useEffect(() => {
    if (imgRef.current && emotionData) {
      const img = imgRef.current;
      const actualWidth = img.naturalWidth;
      const actualHeight = img.naturalHeight;
      const renderedWidth = img.width;
      const renderedHeight = img.height;

      setScale({
        x: renderedWidth / actualWidth,
        y: renderedHeight / actualHeight,
      });
    }
  }, [emotionData]);

  return (
    <div style={{ padding: 20 }}>
      <h2>😄 감정 분석 (배경 제거 + 얼굴 박스)</h2>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      <button onClick={handleAnalyze}>분석하기</button>

      {errorMsg && <p style={{ color: "red" }}>{errorMsg}</p>}

      {emotionData && (
        <div style={{ marginTop: 20, position: "relative", display: "inline-block" }}>
          <img
            ref={imgRef}
            src={`data:image/png;base64,${emotionData.image_base64}`}
            alt="분석된 얼굴"
            style={{ maxWidth: 400 }}
          />

          {/* 빨간 네모 박스 (좌표 스케일 조정) */}
          {scale.x !== 1 && (
            <div
              style={{
                position: "absolute",
                top: emotionData.face_region.y * scale.y,
                left: emotionData.face_region.x * scale.x,
                width: emotionData.face_region.w * scale.x,
                height: emotionData.face_region.h * scale.y,
                border: "2px solid red",
                boxSizing: "border-box",
              }}
            />
          )}

          <h3>🎯 주요 감정: {emotionData.dominant_emotion}</h3>
          <ul>
            {Object.entries(emotionData.emotion_scores).map(([k, v]) => (
              <li key={k}>
                {k}: {v.toFixed(2)}%
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default EmotionAnalyzerWithFaceBox;

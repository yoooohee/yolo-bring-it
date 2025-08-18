import React, { useState } from "react";
import axios from "axios";

function EmotionDetectForm() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [result, setResult] = useState(null);

  const handleChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile)); // 미리보기용 URL 생성
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post("http://localhost:8000/predict-emotion", formData);
      setResult(res.data);
    } catch (error) {
      setResult({ error: error.message });
    }
  };

  return (
    <div>
      <h2>😊 얼굴 감정 인식</h2>
      <form onSubmit={handleSubmit}>
        <input type="file" accept="image/*" onChange={handleChange} />
        <button type="submit">업로드</button>
      </form>

      {previewUrl && (
        <div style={{ marginTop: "1rem" }}>
          <p><strong>업로드한 사진:</strong></p>
          <img src={previewUrl} alt="preview" style={{ maxWidth: "300px", border: "1px solid #ccc" }} />
        </div>
      )}

      {result && result.dominant_emotion && (
        <div>
          <p><strong>감정:</strong> {result.dominant_emotion}</p>
          <ul>
            {Object.entries(result.emotions).map(([k, v]) => (
              <li key={k}>{k}: {v}%</li>
            ))}
          </ul>
        </div>
      )}

      {result && result.error && (
        <p style={{ color: "red" }}>에러: {result.error}</p>
      )}
    </div>
  );
}

export default EmotionDetectForm;

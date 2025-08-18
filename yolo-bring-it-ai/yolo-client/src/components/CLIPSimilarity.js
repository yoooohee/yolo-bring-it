import React, { useState } from "react";
import axios from "axios";

function CLIPSimilarity() {
  const [file, setFile] = useState(null);
  const [scores, setScores] = useState({});
  const [bestMatch, setBestMatch] = useState("");
  const [bestScore, setBestScore] = useState(0);

  // Mapping for translating labels to Korean
  const labelTranslations = {
    "a photo of a dog": "개",
    "a photo of a butterfly": "나비",
    "a photo of a person": "사람",
    "a photo of a flower": "꽃",
    "a photo of a snail": "달팽이",
  };

  const handleChange = (e) => {
    setFile(e.target.files[0]);
    setScores({});
    setBestMatch("");
    setBestScore(0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post("http://i13C207.p.ssafy.io:8001/api/clip-multi-similarity", formData);
      
      // Transform the scores object to use translated labels
      const transformedScores = {};
      Object.keys(res.data.scores).forEach((key) => {
        const newKey = labelTranslations[key] || key; // Fallback to original key if no translation
        transformedScores[newKey] = res.data.scores[key];
      });

      // Transform the bestMatch label
      const transformedBestMatch = labelTranslations[res.data.best_match] || res.data.best_match;

      setScores(transformedScores);
      setBestMatch(transformedBestMatch);
      setBestScore(res.data.best_score_percent);
    } catch (err) {
      console.error("❌ 요청 실패:", err);
      alert("서버 요청에 실패했습니다.");
    }
  };

  return (
    <div style={{ marginTop: "20px" }}>
      <h2>🧠 CLIP 유사도 분석 (다중 항목)</h2>
      <form onSubmit={handleSubmit}>
        <input type="file" accept="image/*" onChange={handleChange} />
        <button type="submit">분석하기</button>
      </form>

      {Object.keys(scores).length > 0 && (
        <div style={{ marginTop: "15px" }}>
          <h4>📊 유사도 결과:</h4>
          <ul>
            {Object.entries(scores).map(([label, percent], i) => (
              <li key={i}>
                {label} : <strong>{percent}%</strong>
              </li>
            ))}
          </ul>
          <p>
            ✅ 가장 유사한 항목: <strong>{bestMatch}</strong> (
            {bestScore}%)
          </p>
        </div>
      )}
    </div>
  );
}

export default CLIPSimilarity;
import React, { useState } from "react";
import axios from "axios";

function ColorClosestForm() {
  const [file, setFile] = useState(null);
  const [color, setColor] = useState("#00ff00");
  const [result, setResult] = useState(null);

  const handleChange = (e) => {
    const selected = e.target.files[0];
    setFile(selected);
  };

  const handleColorChange = (e) => {
    setColor(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    try {
      const res = await axios.post(
        `http://i13C207.p.ssafy.io:8001/api/color-closest?r=${r}&g=${g}&b=${b}`,
        formData
      );
      setResult(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const colorBox = (rgb, label) => (
    <div style={{ marginBottom: "1rem" }}>
      <p><strong>{label}</strong></p>
      <div style={{
        width: 100,
        height: 50,
        backgroundColor: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
        border: "1px solid #ccc"
      }} />
      <p>{`RGB(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`}</p>
    </div>
  );

  return (
    <div>
      <h2>🎯 가장 비슷한 색 찾기</h2>
      <form onSubmit={handleSubmit}>
        <input type="file" accept="image/*" onChange={handleChange} />
        <div style={{ margin: "1rem 0" }}>
          <label>기준 색상: </label>
          <input type="color" value={color} onChange={handleColorChange} />
        </div>
        <button type="submit">분석하기</button>
      </form>

      {result && (
        <div style={{ marginTop: "1rem" }}>
          <p><strong>정확도 점수:</strong> {result.similarity_score}%</p>
          <p><strong>색상 거리:</strong> {result.color_distance}</p>
          <div style={{ display: "flex", gap: "2rem" }}>
            {colorBox(result.target_color, "🎯 기준 색상")}
            {colorBox(result.closest_color, "📷 사진 속 가장 유사한 색")}
          </div>
        </div>
      )}
    </div>
  );
}

export default ColorClosestForm;

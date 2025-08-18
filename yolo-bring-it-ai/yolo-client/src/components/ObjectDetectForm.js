import React, { useState } from "react";
import axios from "axios";

function ObjectDetectForm() {
  const [file, setFile] = useState(null);
  const [memberId, setMemberId] = useState(1);
  const [results, setResults] = useState([]);

  const handleFileChange = (e) => setFile(e.target.files[0]);
  const handleMemberIdChange = (e) => setMemberId(e.target.value);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await axios.post(`http://localhost:8000/predict-object?member_id=${memberId}`, formData);
    setResults(res.data.results);
  };

  return (
    <div>
      <h2>📦 Detic 객체 탐지</h2>
      <form onSubmit={handleSubmit}>
        <input type="number" value={memberId} onChange={handleMemberIdChange} placeholder="Member ID" />
        <input type="file" onChange={handleFileChange} accept="image/*" />
        <button type="submit">업로드</button>
      </form>
      <ul>
        {results.map((r, idx) => (
          <li key={idx}>{r.label} ({r.confidence})</li>
        ))}
      </ul>
    </div>
  );
}

export default ObjectDetectForm;
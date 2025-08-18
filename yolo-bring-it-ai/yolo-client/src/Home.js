import React from "react";
import { Link } from "react-router-dom";

function Home() {
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>🧠 이미지 분석 시스템 선택</h1>
      <div style={{ display: "flex", justifyContent: "center", gap: "2rem" }}>
        <Link to="/rest-api-test">
          <button style={{ padding: "1rem 2rem", fontSize: "1.2rem" }}>
            RESTAPI 테스트
          </button>
        </Link>
        <Link to="/web-ai-test">
          <button style={{ padding: "1rem 2rem", fontSize: "1.2rem" }}>
            WEB에 AI넣고 테스트
          </button>
        </Link>
        <Link to="/flappy-bird-test">
          <button style={{ padding: "1rem 2rem", fontSize: "1.2rem" }}>
            플래피 버그 테스트
          </button>
        </Link>
      </div>
    </div>
  );
}

export default Home;
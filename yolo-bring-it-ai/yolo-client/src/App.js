import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./Home";  // 새 홈 페이지
import RestApiTest from "./RestApiTest";  // REST API 테스트 페이지
import WebAiTest from "./WebAiTest";  // WEB AI 테스트 페이지
import FlappyBirdTest from "./FlappyBirdTest";  // WEB AI 테스트 페이지

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />  // 홈 페이지 (버튼들)
        <Route path="/rest-api-test" element={<RestApiTest />} />  // 기존 페이지
        <Route path="/web-ai-test" element={<WebAiTest />} />  // 새 페이지
        <Route path="/flappy-bird-test" element={<FlappyBirdTest />} />
      </Routes>
    </Router>
  );
}

export default App;
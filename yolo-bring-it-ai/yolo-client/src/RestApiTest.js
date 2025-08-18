import React from "react";
import ObjectDetectForm from "./components/ObjectDetectForm";
import EmotionDetectForm from "./components/EmotionDetectForm";
import ColorClosestForm from "./components/ColorClosestForm";
import EmotionAnalyzerWithFaceBox from "./components/EmotionAnalyzerWithFaceBox";
import CLIPSimilarity from "./components/CLIPSimilarity";
import EyeDetect from "./components/EyeDetectForm"; // EyeDetectForm을 EyeDetect로 가정
import AudioSimilarityForm from "./components/AudioSimilarityForm"; // 새 컴포넌트 추가
import ForbiddenWordGame from "./components/ForbiddenWordGame";

function RestApiTest() {
  return (
    <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
      <h1>🧠 RESTAPI 테스트</h1>
      
      {/* 컴포넌트들을 세로로 배치 */}
      <ObjectDetectForm />
      <EmotionDetectForm />
      <ColorClosestForm />
      <EmotionAnalyzerWithFaceBox />
      <CLIPSimilarity />
      <EyeDetect />
      <AudioSimilarityForm />
      <ForbiddenWordGame />
    </div>
  );
}

export default RestApiTest;
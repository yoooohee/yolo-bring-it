import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import io from "socket.io-client";

const socket = io("http://localhost:8000", {
  transports: ['websocket'],  // ✅ 추가/강조: WebSocket만 사용
});

const EyeDetectForm = () => {
  const webcamRef = useRef(null);
  const [status, setStatus] = useState("대기 중...");
  const [eventMessage, setEventMessage] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      if (webcamRef.current) {
        const screenshot = webcamRef.current.getScreenshot();
        if (screenshot) {
          const frame = screenshot.split(",")[1];  // base64 데이터
          socket.emit("frame", { frame });
        }
      }
    }, 100);  // 100ms 간격

    socket.on("face_result", (data) => {
      if (data.error) {
        setStatus("얼굴 미감지");
      } else {
        setStatus(data.closed ? "눈 감음" : "눈 뜸");
      }
    });

    socket.on("eye_event", (data) => {
      setEventMessage(data.status === "closed" ? "⚠️ 눈을 감았어요!" : "👍 눈을 떴어요!");
      setTimeout(() => setEventMessage(""), 3000);
    });

    return () => {
      clearInterval(interval);
      socket.off("face_result");
      socket.off("eye_event");
    };
  }, []);

  return (
    <div style={{ border: "1px solid #ccc", padding: "1rem", width: "300px" }}>
      <h2>실시간 눈 감기 감지</h2>
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        width={320}
        height={240}
      />
      <p>상태: {status}</p>
      {eventMessage && <p style={{ color: "red" }}>{eventMessage}</p>}
    </div>
  );
};

export default EyeDetectForm;
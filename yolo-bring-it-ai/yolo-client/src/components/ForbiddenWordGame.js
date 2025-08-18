import React, { useState, useRef, useEffect } from "react";
import io from "socket.io-client";

function ForbiddenWordGame() {
  const [forbiddenWord, setForbiddenWord] = useState("");
  const [transcription, setTranscription] = useState("");
  const [message, setMessage] = useState("");
  const [score, setScore] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const socketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunkIntervalRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    socketRef.current = io("http://localhost:8000");

    socketRef.current.on("word_set", (data) => {
      setMessage(data.message);
      setScore(data.score);
      console.log("Word set:", data);
      startRecording();
    });
    socketRef.current.on("transcription", (data) => {
      setTranscription(data.text);
      console.log("Transcription received (인식 텍스트):", data.text);  // 한국어 로그 추가
    });
    socketRef.current.on("score_update", (data) => {
      setScore(data.score);
      console.log("Score updated (점수 업데이트):", data.score);
    });
    socketRef.current.on("warning", (data) => setMessage(data.message));
    socketRef.current.on("out", (data) => {
      setMessage(data.message);
      stopRecording();
    });
    socketRef.current.on("error", (data) => {
      setMessage(data.message);
      console.log("Server error (서버 에러):", data.message);
    });

    return () => {
      socketRef.current.disconnect();
      stopRecording();
    };
  }, []);

  const handleSetWord = () => {
    if (forbiddenWord) {
      socketRef.current.emit("set_forbidden_word", { word: forbiddenWord, language: "ko-KR" });
      console.log("Setting forbidden word (금지 단어 설정):", forbiddenWord);
      setIsRecording(true);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: "audio/webm" });
      console.log("Recording started - speak now! (녹음 시작 - 말해보세요)");

      mediaRecorderRef.current.ondataavailable = (event) => {
        console.log("Data available (데이터 사용 가능): size = ", event.data.size);  // 데이터 크기 로그
        if (event.data.size > 0) {
          event.data.arrayBuffer().then((buffer) => {
            const base64Chunk = btoa(String.fromCharCode(...new Uint8Array(buffer)));
            socketRef.current.emit("audio_chunk", { chunk: base64Chunk, language: "ko-KR" });
            console.log("Audio chunk sent to server (청크 전송): size =", buffer.byteLength);
          });
        } else {
          console.warn("Empty chunk - no sound or too short (빈 청크 - 소리 없음)");
        }
      };

      mediaRecorderRef.current.start(5000);
      chunkIntervalRef.current = setInterval(() => {
        if (mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.start(5000);
          console.log("Chunk processed - waiting for next (청크 처리 - 다음 대기)");
        }
      }, 5000);
    } catch (err) {
      setMessage("마이크 접근 오류: 브라우저 설정을 확인하세요.");
      console.error("Start error (시작 에러):", err);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      clearInterval(chunkIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      setIsRecording(false);
      console.log("Recording stopped successfully (녹음 중지 성공)");
    }
  };

  return (
    <div style={{ marginTop: "20px", padding: "20px", border: "1px solid #ddd", borderRadius: "8px", backgroundColor: "#f9f9f9", width: "300px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      <h2>🚫 금지 단어 게임</h2>
      <input
        type="text"
        value={forbiddenWord}
        onChange={(e) => setForbiddenWord(e.target.value)}
        placeholder="금지 단어 입력 (예: 엄준식)"
        style={{ width: "100%", marginBottom: "10px" }}
      />
      <button onClick={handleSetWord} disabled={isRecording} style={{ width: "100%", marginBottom: "10px" }}>금지 단어 설정 (자동 녹음 시작)</button>
      {isRecording && (
        <div>
          <p style={{ color: "green" }}>백그라운드 녹음 중... (말을 해보세요)</p>
          <button onClick={stopRecording} style={{ width: "100%", marginBottom: "10px", backgroundColor: "red", color: "white" }}>
            녹음 중지
          </button>
        </div>
      )}
      <p>인식 텍스트: {transcription}</p>
      <p>점수: {score}</p>
      <p>메시지: {message}</p>
    </div>
  );
}

export default ForbiddenWordGame;
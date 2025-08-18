import React, { useRef, useEffect, useState } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import Webcam from "react-webcam";

function WebAiTest() {
  const webcamRef = useRef(null);
  const [status, setStatus] = useState("대기 중...");
  const [eventMessage, setEventMessage] = useState("");
  const faceMeshRef = useRef(null);
  const cameraRef = useRef(null);
  const eyesClosedRef = useRef(false);
  const [memoryInfo, setMemoryInfo] = useState({
    usedJSHeapSize: 0,
    totalJSHeapSize: 0,
    jsHeapSizeLimit: 0,
  });
  const [cacheSize, setCacheSize] = useState("Calculating...");
  const [modelLoadSize, setModelLoadSize] = useState("Calculating...");
  const [forbiddenWord, setForbiddenWord] = useState("");
  const forbiddenWordRef = useRef("");
  const [transcription, setTranscription] = useState("");
  const finalTranscriptionRef = useRef("");
  const [gameMessage, setGameMessage] = useState("");
  const [score, setScore] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const [targetTime, setTargetTime] = useState("");
  const [currentTime, setCurrentTime] = useState(0.00);
  const [isRunning, setIsRunning] = useState(false);
  const [isTimerHidden, setIsTimerHidden] = useState(false);
  const [difference, setDifference] = useState(null);
  const [timingMessage, setTimingMessage] = useState("");
  const startTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // 반응 속도 게임 상태
  const [isReactionStarted, setIsReactionStarted] = useState(false);
  const [screenColor, setScreenColor] = useState("red");
  const [reactionTime, setReactionTime] = useState(null);
  const [reactionMessage, setReactionMessage] = useState("");
  const reactionStartTimeRef = useRef(null);
  const greenTimeRef = useRef(null);
  const timeoutRef = useRef(null);

  // Effect 1: MediaPipe FaceMesh 및 Camera 초기화
  useEffect(() => {
    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults((results) => {
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        const leftEyeUpper = landmarks[159];
        const leftEyeLower = landmarks[145];
        const leftDistance = Math.hypot(
          leftEyeUpper.x - leftEyeLower.x,
          leftEyeUpper.y - leftEyeLower.y,
          leftEyeUpper.z - leftEyeLower.z
        );
        const rightEyeUpper = landmarks[386];
        const rightEyeLower = landmarks[374];
        const rightDistance = Math.hypot(
          rightEyeUpper.x - rightEyeLower.x,
          rightEyeUpper.y - rightEyeLower.y,
          rightEyeUpper.z - rightEyeLower.z
        );
        const avgDistance = (leftDistance + rightDistance) / 2;
        const isClosed = avgDistance < 0.02;

        if (isClosed !== eyesClosedRef.current) {
          eyesClosedRef.current = isClosed;
          const status = isClosed ? "closed" : "opened";
          setEventMessage(status === "closed" ? "⚠️ 눈을 감았어요!" : "👍 눈을 떴어요!");
          setTimeout(() => setEventMessage(""), 3000);
        }

        setStatus(eyesClosedRef.current ? "눈 감음" : "눈 뜸");
      } else {
        setStatus("얼굴 미감지");
      }
    });

    faceMeshRef.current = faceMesh;

    if (webcamRef.current && webcamRef.current.video) {
      const camera = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          await faceMesh.send({ image: webcamRef.current.video });
        },
        width: 320,
        height: 240,
      });
      cameraRef.current = camera;
      camera.start();
    }

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
      }
    };
  }, []);

  // Effect 2: Web Speech API 초기화
  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = "ko-KR";
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event) => {
        let interimTranscript = '';
        let newFinalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            newFinalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        console.log("New final transcript:", newFinalTranscript);
        console.log("Interim transcript:", interimTranscript);

        if (newFinalTranscript) {
          const lowerNewFinal = newFinalTranscript.toLowerCase();
          const forbiddenLower = forbiddenWordRef.current.toLowerCase();

          if (lowerNewFinal.includes(forbiddenLower)) {
            setScore(prev => {
              const newScore = prev - 1;
              if (newScore <= 0) {
                setGameMessage("OUT! 점수가 0이 되었습니다.");
                if (recognitionRef.current) recognitionRef.current.stop();
                setIsListening(false);
                return 0;
              }
              setGameMessage("금지 단어 감지! 점수 -1");
              return newScore;
            });
          }

          finalTranscriptionRef.current += newFinalTranscript;
        }

        setTranscription(finalTranscriptionRef.current + interimTranscript);
      };

      recognitionRef.current.onend = () => {
        if (isListening) recognitionRef.current.start();
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setGameMessage("인식 오류: " + event.error);
      };
    } else {
      setGameMessage("브라우저에서 음성 인식을 지원하지 않습니다. Chrome을 사용하세요.");
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [isListening]);

  // Effect 3: 메모리 및 리소스 모니터링
  useEffect(() => {
    const memoryInterval = setInterval(() => {
      if ('memory' in performance) {
        setMemoryInfo({
          usedJSHeapSize: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
          totalJSHeapSize: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
          jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB',
        });
      } else {
        setMemoryInfo({ usedJSHeapSize: 'Not supported', totalJSHeapSize: '', jsHeapSizeLimit: '' });
      }
    }, 2000);

    const calculateCacheSize = async () => {
      if ('caches' in window) {
        let totalSize = 0;
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          const cache = await caches.open(name);
          const requests = await cache.keys();
          for (const request of requests) {
            const response = await cache.match(request);
            if (response) {
              const blob = await response.blob();
              totalSize += blob.size;
            }
          }
        }
        setCacheSize((totalSize / 1024 / 1024).toFixed(2) + ' MB');
      } else {
        setCacheSize('Not supported');
      }
    };
    calculateCacheSize();
    const cacheInterval = setInterval(calculateCacheSize, 5000);

    const calculateModelLoadSize = () => {
      const entries = performance.getEntriesByType("resource");
      let modelSize = 0;
      entries.forEach((entry) => {
        if (entry.name.includes("@mediapipe/face_mesh")) {
          modelSize += entry.transferSize || entry.decodedBodySize || 0;
        }
      });
      setModelLoadSize((modelSize / 1024 / 1024).toFixed(2) + ' MB');
    };

    calculateModelLoadSize();
    const observer = new PerformanceObserver((list) => {
      calculateModelLoadSize();
    });
    observer.observe({ entryTypes: ["resource"] });

    return () => {
      clearInterval(memoryInterval);
      clearInterval(cacheInterval);
      observer.disconnect();
    };
  }, []);

  // Effect 4: 타이밍 게임 로직
  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now();
      timerIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setCurrentTime(parseFloat(elapsed.toFixed(2)));

        if (elapsed >= 5) {
          setIsTimerHidden(true);
        }
      }, 10);
    } else {
      clearInterval(timerIntervalRef.current);
    }

    return () => clearInterval(timerIntervalRef.current);
  }, [isRunning]);

  // Effect 5: 스페이스바 이벤트 리스너
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === " " && isRunning && isTimerHidden) {
        handleStopTimer();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isRunning, isTimerHidden, currentTime, targetTime]);

  // Effect 6: 반응 속도 게임 로직
  useEffect(() => {
    if (isReactionStarted) {
      setScreenColor("red");
      setReactionTime(null);
      setReactionMessage("");
      reactionStartTimeRef.current = Date.now();

      // 랜덤 시간 (2-5초) 후 초록으로 변경
      const randomDelay = Math.floor(Math.random() * 3000) + 2000; // 2000ms ~ 5000ms
      timeoutRef.current = setTimeout(() => {
        setScreenColor("green");
        greenTimeRef.current = Date.now();
      }, randomDelay);
    } else {
      clearTimeout(timeoutRef.current);
    }

    return () => clearTimeout(timeoutRef.current);
  }, [isReactionStarted]);

  // 반응 속도 게임 시작
  const startReactionTest = () => {
    setIsReactionStarted(true);
  };

  // 반응 속도 게임 중지 (클릭 시)
  const handleReactionClick = () => {
    if (!isReactionStarted || screenColor === "red") {
      setReactionMessage("너무 일찍 클릭! 실격 - 재시작하세요.");
      setIsReactionStarted(false);
      return;
    }

    const timeTaken = (Date.now() - greenTimeRef.current) / 1000;
    setReactionTime(timeTaken.toFixed(2));
    setReactionMessage(`반응 속도: ${timeTaken.toFixed(2)}초 - ${timeTaken < 0.3 ? "승리! (빠름)" : "패배! (느림)"}`);
    setIsReactionStarted(false);
  };

  const handleSetWord = () => {
    if (forbiddenWord) {
      forbiddenWordRef.current = forbiddenWord;
      finalTranscriptionRef.current = "";
      setTranscription("");
      setScore(10);
      setGameMessage("금지 단어가 설정되었습니다: " + forbiddenWord);
      setIsListening(true);
      if (recognitionRef.current) recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsListening(false);
    finalTranscriptionRef.current = "";
    setTranscription("");
    setGameMessage("인식 중지");
  };

  const startTimer = () => {
    if (targetTime && parseFloat(targetTime) > 5) {
      setCurrentTime(0.00);
      setIsRunning(true);
      setIsTimerHidden(false);
      setDifference(null);
      setTimingMessage("");
    } else {
      setTimingMessage("타겟 시간을 5초 이상으로 입력하세요.");
    }
  };

  const handleStopTimer = () => {
    setIsRunning(false);
    const target = parseFloat(targetTime);
    const diff = parseFloat((currentTime - target).toFixed(2));
    const sign = diff >= 0 ? "+" : "-";
    setDifference(`${sign}${Math.abs(diff).toFixed(2)}`);
    setTimingMessage(
      `타겟: ${target.toFixed(2)}초, 실제: ${currentTime.toFixed(2)}초, 차이: ${sign}${Math.abs(diff).toFixed(2)}초 - ${
        Math.abs(diff) < 0.5 ? "승리!" : "패배!"
      }`
    );
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>🧠 WEB에 AI넣고 테스트</h1>
      <div style={{ border: "1px solid #ccc", padding: "1rem", width: "300px" }}>
        <h2>실시간 눈 감기 감지 (브라우저 전용)</h2>
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          width={320}
          height={240}
          videoConstraints={{ width: 320, height: 240, facingMode: "user" }}
        />
        <p>상태: {status}</p>
        {eventMessage && <p style={{ color: "red" }}>{eventMessage}</p>}
      </div>
      <div style={{ marginTop: "2rem" }}>
        <h3>리소스 사용 정보 (실시간 업데이트)</h3>
        <p>사용 중 메모리 (usedJSHeapSize): {memoryInfo.usedJSHeapSize}</p>
        <p>할당된 메모리 (totalJSHeapSize): {memoryInfo.totalJSHeapSize}</p>
        <p>메모리 한도 (jsHeapSizeLimit): {memoryInfo.jsHeapSizeLimit}</p>
        <p>캐시 크기 (Cache Storage): {cacheSize}</p>
        <p>MediaPipe Face Mesh 모델 로드/캐시 크기: {modelLoadSize}</p>
        <small>참고: 모델 부하는 네트워크(초기 로드) ~7-10 MB, 런타임 메모리 50-150 MB.</small>
      </div>
      <div style={{ marginTop: "2rem", border: "1px solid #ccc", padding: "1rem", width: "300px" }}>
        <h2>🚫 금지 단어 게임 (브라우저 AI)</h2>
        <input
          type="text"
          value={forbiddenWord}
          onChange={(e) => setForbiddenWord(e.target.value)}
          placeholder="금지 단어 입력 (예: 엄준식)"
          style={{ width: "100%", marginBottom: "10px" }}
        />
        <button onClick={handleSetWord} disabled={isListening} style={{ width: "100%", marginBottom: "10px" }}>
          금지 단어 설정 (자동 인식 시작)
        </button>
        {isListening && (
          <button onClick={stopListening} style={{ width: "100%", marginBottom: "10px", backgroundColor: "red", color: "white" }}>
            인식 중지
          </button>
        )}
        <p>인식 텍스트: {transcription}</p>
        <p>점수: {score}</p>
        <p>메시지: {gameMessage}</p>
      </div>
      <div style={{ marginTop: "2rem", border: "1px solid #ccc", padding: "1rem", width: "300px" }}>
        <h2>⏱️ 타이밍 게임 (브라우저 전용)</h2>
        <input
          type="number"
          value={targetTime}
          onChange={(e) => setTargetTime(e.target.value)}
          placeholder="타겟 초 입력 (예: 13)"
          step="0.01"
          style={{ width: "100%", marginBottom: "10px" }}
        />
        <button onClick={startTimer} disabled={isRunning} style={{ width: "100%", marginBottom: "10px" }}>
          시작 (타이머 실행)
        </button>
        {isRunning && (
          <button onClick={handleStopTimer} style={{ width: "100%", marginBottom: "10px", backgroundColor: "red", color: "white" }}>
            중지
          </button>
        )}
        <p>현재 시간: {isTimerHidden ? "숨김" : currentTime.toFixed(2)}초</p>
        {difference !== null && <p>차이: {difference}초</p>}
        <p>메시지: {timingMessage}</p>
        <small>스페이스바 또는 중지 버튼: 5초 후 숨김. 타겟과 0.5초 이내로 맞추면 승리!</small>
      </div>
      <div style={{ marginTop: "2rem", border: "1px solid #ccc", padding: "1rem", width: "300px" }}>
        <h2>⚡ 반응 속도 테스트 (브라우저 전용)</h2>
        <button onClick={startReactionTest} disabled={isReactionStarted} style={{ width: "100%", marginBottom: "10px" }}>
          시작 (빨간 화면 대기)
        </button>
        <div
          style={{
            width: "100%",
            height: "200px",
            backgroundColor: screenColor,
            marginBottom: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "1.5rem",
          }}
        >
          {screenColor === "red" ? "대기 중..." : "클릭하세요!"}
        </div>
        <button onClick={handleReactionClick} disabled={!isReactionStarted} style={{ width: "100%", marginBottom: "10px" }}>
          클릭!
        </button>
        {reactionTime !== null && <p>반응 속도: {reactionTime}초</p>}
        <p>메시지: {reactionMessage}</p>
        <small>빨간 화면에서 대기, 초록 되면 클릭. 가장 빠른 반응이 승리! (기준: 0.3초 미만 승리)</small>
      </div>
    </div>
  );
}

export default WebAiTest;
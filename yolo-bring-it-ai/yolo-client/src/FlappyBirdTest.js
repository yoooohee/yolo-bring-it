import React, { useRef, useEffect, useState } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import Webcam from "react-webcam";

function FlappyBirdTest() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [noseY, setNoseY] = useState(0.5);
  const [flappyScore, setFlappyScore] = useState(0);
  const [isFlappyGameOver, setIsFlappyGameOver] = useState(false);
  const [isFlappyStarted, setIsFlappyStarted] = useState(false);
  const [gameStatus, setGameStatus] = useState("카메라 준비 중...");
  const pipesRef = useRef([]);
  const gameIntervalRef = useRef(null);
  const faceMeshRef = useRef(null);
  const cameraRef = useRef(null);
  const frameRef = useRef(0);
  const birdYRef = useRef(250);
  const birdVelocityYRef = useRef(0);
  const lastNoseYRef = useRef(0.5);
  const [isFlapping, setIsFlapping] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const GRAVITY = 0.3;
  const FLAP_STRENGTH = -7;
  const FLAP_THRESHOLD = 0.02;

  const [pipeSpeed, setPipeSpeed] = useState(1.8);
  const [pipeFrequency, setPipeFrequency] = useState(1800);
  const gapHeight = 280;
  const lastGapCenterRef = useRef(250);
  const MAX_GAP_SHIFT = 80;

  useEffect(() => {
    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    
    faceMesh.onResults((results) => {
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        const noseTip = landmarks[1];
        setNoseY(parseFloat(noseTip.y.toFixed(3)));
      }
    });
    faceMeshRef.current = faceMesh;

    if (webcamRef.current && webcamRef.current.video) {
      const camera = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          if (webcamRef.current && webcamRef.current.video && faceMeshRef.current) {
             await faceMeshRef.current.send({ image: webcamRef.current.video });
          }
        },
        width: 320,
        height: 240,
      });
      cameraRef.current = camera;
      camera.start().then(() => {
        setGameStatus("얼굴 인식 완료! 게임을 시작하세요.");
      });
    }
    
    return () => {
      console.log("Cleaning up FaceMesh and Camera...");
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
        faceMeshRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isFlappyStarted || isFlappyGameOver) return;
    if (lastNoseYRef.current - noseY > FLAP_THRESHOLD) {
      birdVelocityYRef.current = FLAP_STRENGTH;
      setIsFlapping(true);
      setTimeout(() => setIsFlapping(false), 100);
    }
    lastNoseYRef.current = noseY;
  }, [noseY, isFlappyStarted, isFlappyGameOver]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const birdX = 80;
    const birdRadius = 20;
    const pipeWidth = 80;
    const minGapCenter = 150;
    const maxGapCenter = canvas.height - 150;

    const drawBird = (x, y) => { 
        ctx.save();
        ctx.translate(x, y);
        const angle = Math.min(birdVelocityYRef.current / 10, 0.5);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.arc(0, 0, birdRadius, 0, 2 * Math.PI);
        ctx.fillStyle = isFlapping ? "#FFDB58" : "yellow";
        ctx.fill();
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(birdRadius * 0.3, -birdRadius * 0.2, birdRadius * 0.15, 0, 2 * Math.PI);
        ctx.fillStyle = "black";
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(birdRadius * 0.7, 0);
        ctx.lineTo(birdRadius * 1.2, -birdRadius * 0.15);
        ctx.lineTo(birdRadius * 1.2, birdRadius * 0.15);
        ctx.closePath();
        ctx.fillStyle = "orange";
        ctx.fill();
        ctx.restore();
    };

    const drawPipe = (pipe) => {
        const { x, gapStart } = pipe;
        const gradient = ctx.createLinearGradient(x, 0, x + pipeWidth, 0);
        gradient.addColorStop(0, "#7CFC00");
        gradient.addColorStop(1, "#228B22");
        ctx.fillStyle = gradient;
        ctx.strokeStyle = "#006400";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, gapStart);
        ctx.lineTo(x + pipeWidth, gapStart);
        ctx.lineTo(x + pipeWidth, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, gapStart + gapHeight);
        ctx.lineTo(x + pipeWidth, gapStart + gapHeight);
        ctx.lineTo(x + pipeWidth, canvas.height);
        ctx.lineTo(x, canvas.height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    };

    const gameOver = () => {
      setIsFlappyGameOver(true);
      setIsFlappyStarted(false);
      setGameStatus("게임 오버");
      clearInterval(gameIntervalRef.current);
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#87CEEB";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (isFlappyStarted) {
        birdVelocityYRef.current += GRAVITY;
        birdYRef.current += birdVelocityYRef.current;

        if (birdYRef.current + birdRadius > canvas.height) {
          gameOver();
        }
        
        if (birdYRef.current - birdRadius < 0) {
            birdYRef.current = birdRadius;
            birdVelocityYRef.current = 0;
        }

        pipesRef.current.forEach((pipe, index) => {
          pipe.x -= pipeSpeed;
          drawPipe(pipe);

          if (
            birdX + birdRadius > pipe.x &&
            birdX - birdRadius < pipe.x + pipeWidth &&
            (birdYRef.current - birdRadius < pipe.gapStart ||
              birdYRef.current + birdRadius > pipe.gapStart + gapHeight)
          ) {
            gameOver();
          }

          if (pipe.x + pipeWidth < birdX && !pipe.passed) {
            pipe.passed = true;
            setFlappyScore((prev) => {
              const newScore = prev + 1;
              if (newScore > 0 && newScore % 5 === 0) {
                setPipeSpeed((prevSpeed) => prevSpeed + 0.1);
                setPipeFrequency((prevFreq) => Math.max(prevFreq - 8, 120));
              }
              return newScore;
            });
          }

          if (pipe.x + pipeWidth < 0) {
            pipesRef.current.splice(index, 1);
          }
        });

        if (frameRef.current % pipeFrequency === 0) {
          const delta = (Math.random() - 0.5) * MAX_GAP_SHIFT * 2;
          let newGapCenter = lastGapCenterRef.current + delta;
          
          newGapCenter = Math.max(minGapCenter, Math.min(maxGapCenter, newGapCenter));
          
          lastGapCenterRef.current = newGapCenter;
          const gapStart = newGapCenter - gapHeight / 2;
          pipesRef.current.push({ x: canvas.width, gapStart, passed: false });
        }

        frameRef.current++;
      }
      
      drawBird(birdX, birdYRef.current);

      if (countdown > 0) {
        ctx.font = "80px 'Press Start 2P', cursive";
        ctx.fillStyle = "white";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 8;
        ctx.textAlign = "center";
        ctx.strokeText(countdown, canvas.width / 2, canvas.height / 2);
        ctx.fillText(countdown, canvas.width / 2, canvas.height / 2);
        ctx.textAlign = "left";
      }
      
      if (isFlappyStarted) {
        ctx.font = "32px 'Press Start 2P', cursive";
        ctx.fillStyle = "white";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 4;
        ctx.strokeText(`Score: ${flappyScore}`, 10, 40);
        ctx.fillText(`Score: ${flappyScore}`, 10, 40);
      }

      // 게임 오버 시 배경 어두워지고 점수 표시
      if (isFlappyGameOver) {
        // 반투명 검은색 오버레이
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // 중앙에 점수 표시
        ctx.font = "50px 'Press Start 2P', cursive";
        ctx.fillStyle = "white";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 6;
        ctx.textAlign = "center";
        ctx.strokeText(`점수: ${flappyScore}`, canvas.width / 2, canvas.height / 2);
        ctx.fillText(`점수: ${flappyScore}`, canvas.width / 2, canvas.height / 2);
        ctx.textAlign = "left";
      }
    };

    gameIntervalRef.current = setInterval(draw, 16);
    return () => clearInterval(gameIntervalRef.current);
  }, [isFlappyStarted, pipeSpeed, pipeFrequency, isFlapping, countdown, isFlappyGameOver]);

  const startGame = () => {
    if (isFlappyStarted || countdown > 0) return;

    setPipeSpeed(1.8);
    setPipeFrequency(180);
    setIsFlappyGameOver(false);
    setFlappyScore(0);
    pipesRef.current = [];
    birdYRef.current = 250;
    birdVelocityYRef.current = 0;
    lastGapCenterRef.current = 250;
    frameRef.current = 0;

    setCountdown(3);
    setGameStatus("준비...");
    const countdownInterval = setInterval(() => {
        setCountdown(prev => {
            if (prev - 1 <= 0) {
                clearInterval(countdownInterval);
                setIsFlappyStarted(true);
                setGameStatus("게임 중!");
                return 0;
            }
            return prev - 1;
        });
    }, 1000);
  };

  return (
    <div style={{ padding: "2rem", textAlign: "center", fontFamily: "sans-serif" }}>
      <h1>🕊️ 플래피 페이스 (Flappy Face)</h1>
      <div style={{ display: "flex", justifyContent: "center", gap: "2rem", flexWrap: "wrap" }}>
        <Webcam
          audio={false}
          ref={webcamRef}
          width={320}
          height={240}
          videoConstraints={{ width: 320, height: 240, facingMode: "user" }}
          style={{ display: "none" }}
        />
        <div style={{ border: "2px solid #ccc", padding: "1rem", borderRadius: "8px", width: "500px", background: "#f9f9f9" }}>
          <canvas ref={canvasRef} width={500} height={500} style={{ border: "2px solid black", borderRadius: "8px", background: "#87CEEB" }}></canvas>
          <div style={{ marginTop: '1rem' }}>
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>상태: {gameStatus}</p>
            {isFlappyGameOver && <p style={{ color: "red", fontSize: '1.5rem', fontWeight: 'bold' }}>게임 오버! 최종 점수: {flappyScore}</p>}
          </div>
          <div style={{ marginTop: "10px" }}>
            {(!isFlappyStarted || isFlappyGameOver) && (
              <button
                onClick={startGame}
                disabled={countdown > 0}
                style={{
                  width: "100%",
                  padding: "15px",
                  fontSize: "1.2rem",
                  fontWeight: "bold",
                  backgroundColor: isFlappyGameOver ? "#2196F3" : "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: countdown > 0 ? "not-allowed" : "pointer",
                  opacity: countdown > 0 ? 0.6 : 1,
                  boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
                }}
              >
                {isFlappyGameOver ? "다시 시작" : "게임 시작"}
              </button>
            )}
          </div>
          <small style={{ display: "block", marginTop: "15px", lineHeight: "1.5" }}>
            <strong>조작법:</strong> 얼굴을 위로 <strong>'휙'</strong> 움직여서 새를 날아오르게 하세요.<br/>
            부드럽게 움직이는 파이프를 피해 최고 점수에 도전하세요!
          </small>
        </div>
      </div>
    </div>
  );
}

export default FlappyBirdTest;
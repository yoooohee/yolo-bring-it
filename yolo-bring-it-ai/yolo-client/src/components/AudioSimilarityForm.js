import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function AudioSimilarityForm() {
  const [targetFile, setTargetFile] = useState(null);
  const [userFile, setUserFile] = useState(null);
  const [language, setLanguage] = useState("ko-KR");
  const [targetText, setTargetText] = useState("");
  const [userText, setUserText] = useState("");
  const [textScore, setTextScore] = useState(null);
  const [audioScore, setAudioScore] = useState(null);
  const [overallScore, setOverallScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [targetDuration, setTargetDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(new Audio());
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const intervalRef = useRef(null);
  const [targetProsodyData, setTargetProsodyData] = useState([]); // {time: 초, intensity: 값}
  const [userProsodyData, setUserProsodyData] = useState([]); // {time: 초, intensity: 값}
  const [forceUpdate, setForceUpdate] = useState(0);
  const startTimeRef = useRef(0);

  const handleTargetChange = async (e) => {
    const file = e.target.files[0];
    setTargetFile(file);
    resetResults();
    if (file) {
      audioRef.current.src = URL.createObjectURL(file);
      audioRef.current.onloadedmetadata = () => {
        setTargetDuration(Math.ceil(audioRef.current.duration));
      };
      await analyzeTargetAudio(file);
    }
  };

  // 대상 오디오 분석 (프로소디: intensity만)
  const analyzeTargetAudio = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      const sampleRate = audioBuffer.sampleRate;
      const data = audioBuffer.getChannelData(0);
      const newProsodyData = [];

      const intervalMs = 10;
      const chunkSize = Math.floor(sampleRate * (intervalMs / 1000));
      for (let i = 0; i < data.length; i += chunkSize) {
        const time = i / sampleRate;
        const chunk = data.slice(i, i + chunkSize);
        const intensity = estimateProsody(chunk);
        newProsodyData.push({ time, intensity });
      }
      setTargetProsodyData(applyHold(newProsodyData, 'intensity'));
    } catch (err) {
      console.error("Target analysis failed:", err);
      setError("대상 오디오 분석 실패.");
    }
  };

  const handleStartRecording = async () => {
    if (!targetDuration) {
      setError("대상 파일의 길이를 확인할 수 없습니다.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/mp3') ? 'audio/mp3' : 'audio/webm';
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.includes('mp3') ? '.mp3' : '.webm';
        const file = new File([blob], `user_recording${ext}`, { type: mimeType });
        setUserFile(file);
        setIsRecording(false);
        setRemainingTime(0);
        if (intervalRef.current) clearInterval(intervalRef.current);
        setUserProsodyData((prev) => applyHold(prev, 'intensity'));
        setForceUpdate((prev) => prev + 1);
      };

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      source.connect(analyserRef.current);

      setUserProsodyData([]);
      setCountdown(3);
      startTimeRef.current = Date.now();
    } catch (err) {
      setError("마이크 접근 권한이 필요합니다.");
      console.error(err);
    }
  };

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && !isRecording && targetDuration > 0) {
      if (!mediaRecorderRef.current) {
        setError("녹음 장치 초기화 실패.");
        return;
      }

      setIsRecording(true);
      setRemainingTime(targetDuration);
      mediaRecorderRef.current.start();
      startTimeRef.current = Date.now();

      intervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        const timeDomainData = new Float32Array(analyserRef.current.fftSize);
        analyserRef.current.getFloatTimeDomainData(timeDomainData);
        const time = (Date.now() - startTimeRef.current) / 1000;
        const intensity = estimateProsody(timeDomainData);
        setUserProsodyData((prev) => [...prev, { time, intensity }]);
      }, 10);

      const interval = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            if (mediaRecorderRef.current) {
              mediaRecorderRef.current.stop();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, targetDuration * 1000);

      return () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
        }
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [countdown, targetDuration]);

  // 프로소디 추출: intensity (RMS)만
  const estimateProsody = (buffer) => {
    // Intensity (RMS)
    let sumSq = 0;
    for (let i = 0; i < buffer.length; i++) {
      sumSq += buffer[i] * buffer[i];
    }
    const intensity = Math.sqrt(sumSq / buffer.length) || 0;

    return intensity;
  };

  // 0을 이전 값으로 대체 (단일 키)
  const applyHold = (data, key) => {
    let lastValue = 0;
    return data.map((item) => {
      if (item[key] !== 0) {
        lastValue = item[key];
        return item;
      }
      return { ...item, [key]: lastValue };
    });
  };

  // 그래프 데이터 (프로소디: intensity만)
  const getChartData = (targetData, userData = null) => ({
    datasets: [
      {
        label: '대상 강도 (RMS)',
        data: targetData.map(d => ({ x: d.time, y: d.intensity })),
        borderColor: "rgba(75,192,192,1)",
        fill: false,
        pointRadius: 0,
      },
      ...(userData ? [
        {
          label: '내 강도 (RMS)',
          data: userData.map(d => ({ x: d.time, y: d.intensity })),
          borderColor: "rgba(255,99,132,1)",
          fill: false,
          pointRadius: 0,
        },
      ] : []),
    ],
  });

  const chartOptions = {
    scales: {
      y: {
        min: 0,
        max: 1,
        title: { display: true, text: "Intensity (RMS)" },
      },
      x: { 
        type: 'linear', 
        title: { display: true, text: "Time (s)" },
        max: targetDuration,
      },
    },
    elements: { line: { tension: 0.5 } },
    animation: false,
  };

  const resetResults = () => {
    setTargetText("");
    setUserText("");
    setTextScore(null);
    setAudioScore(null);
    setOverallScore(null);
    setError("");
    setUserFile(null);
    setTargetDuration(0);
    setCountdown(0);
    setIsRecording(false);
    setRemainingTime(0);
    setTargetProsodyData([]);
    setUserProsodyData([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetFile || !userFile) {
      setError("대상 파일과 녹음 파일이 필요합니다.");
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("target_file", targetFile);
    formData.append("user_file", userFile);

    try {
      const res = await axios.post(
        `http://localhost:8000/audio-similarity?language=${language}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      setTargetText(res.data.target_text || "인식 실패");
      setUserText(res.data.user_text || "인식 실패");
      setTextScore(res.data.text_score_percent);
      setAudioScore(res.data.audio_score_percent);
      setOverallScore(res.data.overall_score_percent);
    } catch (err) {
      console.error("❌ 요청 실패:", err);
      setError("서버 요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: "20px", padding: "20px", border: "1px solid #ddd", borderRadius: "8px", backgroundColor: "#f9f9f9", width: "800px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      <h2>🎤 명대사 따라하기 유사도 (강도 비교 중심)</h2>
      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", marginBottom: "10px" }}>
          대상 명대사 MP3:
          <input type="file" accept="audio/*" onChange={handleTargetChange} style={{ display: "block", width: "100%" }} />
        </label>
        {targetDuration > 0 && <p>대상 길이: {targetDuration}초</p>}
        {targetProsodyData.length > 0 && (
          <div style={{ marginBottom: "10px" }}>
            <h4>대상 강도 그래프 (RMS)</h4>
            <Line data={getChartData(targetProsodyData)} options={chartOptions} style={{ height: "300px" }} />
          </div>
        )}
        <button type="button" onClick={handleStartRecording} disabled={!targetDuration || isRecording || loading} style={{ width: "100%", marginBottom: "10px" }}>
          {isRecording ? "녹음 중..." : "녹음 시작 (자동 정지)"}
        </button>
        {countdown > 0 && <h3 style={{ textAlign: "center", color: "red" }}>준비: {countdown}</h3>}
        {isRecording && (
          <div>
            <p>남은 시간: {remainingTime}초</p>
            <progress value={(targetDuration - remainingTime) / targetDuration * 100} max="100" style={{ width: "100%" }} />
          </div>
        )}
        {userProsodyData.length > 0 && (
          <div style={{ marginTop: "10px", marginBottom: "10px" }}>
            <h4>실시간 강도 비교 그래프 (RMS)</h4>
            <Line data={getChartData(targetProsodyData, userProsodyData)} options={chartOptions} style={{ height: "300px" }} />
          </div>
        )}
        {userFile && <p>녹음 완료: {userFile.name}</p>}
        <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ marginBottom: "10px", width: "100%" }}>
          <option value="ko-KR">한국어</option>
          <option value="en-US">영어</option>
        </select>
        <button type="submit" disabled={loading || !userFile} style={{ width: "100%" }}>
          {loading ? "분석 중..." : "유사도 계산"}
        </button>
      </form>

      {error && <p style={{ color: "red", marginTop: "10px" }}>{error}</p>}

      {overallScore !== null && (
        <div style={{ marginTop: "15px" }}>
          <h4>📊 결과:</h4>
          <p>대상 텍스트: {targetText}</p>
          <p>내 텍스트: {userText}</p>
          <p>텍스트 유사도: <strong>{textScore}%</strong></p>
          <p>오디오(톤/피치) 유사도: <strong>{audioScore}%</strong></p>
          <p>종합 점수: <strong>{overallScore}%</strong></p>
          {targetProsodyData.length > 0 && userProsodyData.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <h4>강도 비교 그래프 (RMS)</h4>
              <Line data={getChartData(targetProsodyData, userProsodyData)} options={chartOptions} style={{ height: "300px" }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AudioSimilarityForm;
import React, { useState, useEffect, useRef } from 'react';
import { Room, createLocalVideoTrack } from 'livekit-client';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

interface Submission {
  identity: string;
  timestamp: number;
}

const tasks = ['phone', 'cup', 'book']; // 객체 탐지 모델 라벨과 맞춤 (e.g., 'phone' → 'Cell Phone')

const GameRoom: React.FC = () => {
  const [room, setRoom] = useState<Room | undefined>(undefined);
  const [videoTrack, setVideoTrack] = useState<any>(undefined);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [currentTask, setCurrentTask] = useState<string>('');
  const [score, setScore] = useState(0);
  const [submissions, setSubmissions] = useState<Submission[]>([]); // 모든 제출 데이터 모음
  const [rankings, setRankings] = useState<{ identity: string; timestamp: number; rank: number }[]>([]); // 등수 결과
  const [showResults, setShowResults] = useState(false); // 결과 표시 여부
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const token = localStorage.getItem('token');
  const name = localStorage.getItem('name');
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/'); // 토큰 없으면 로그인 페이지로
      return;
    }

    const joinRoom = async () => {
      setIsCameraLoading(true);
      const newRoom = new Room();
      try {
        await newRoom.connect('wss://192-168-100-56.openvidu-local.dev:7443', token);
        setRoom(newRoom);

        const track = await createLocalVideoTrack({ facingMode: 'user', resolution: { width: 640, height: 480 } });
        await newRoom.localParticipant.publishTrack(track);
        setVideoTrack(track);

        if (videoRef.current) track.attach(videoRef.current);
        setIsCameraLoading(false);

        // 데이터 메시지 리스닝 (제출 데이터 수신)
        newRoom.on('dataReceived', (payload: Uint8Array, participant) => {
          const decoder = new TextDecoder();
          const message = decoder.decode(payload);
          try {
            const data: Submission = JSON.parse(message);
            setSubmissions((prev) => {
              const updated = [...prev, data];
              // 모든 제출 완료 시 등수 계산
              if (updated.length === newRoom.numParticipants) {
                calculateRankings(updated);
              }
              return updated;
            });
          } catch (e) {
            console.error('Invalid data message:', e);
          }
        });

        startNewRound();
      } catch (err) {
        console.error('Join room error:', err);
        setError('방 연결 실패');
        setIsCameraLoading(false);
      }
    };

    joinRoom();

    return () => {
      room?.disconnect();
      videoTrack?.detach();
    };
  }, [token, navigate]);

  const startNewRound = () => {
    const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
    setCurrentTask(randomTask);
    setResults([]);
    setSubmissions([]);
    setRankings([]);
    setShowResults(false);
    setError(null);
  };

  const calculateRankings = (subs: Submission[]) => {
    // 시간 빠른 순으로 정렬하고 등수 매김
    const sorted = [...subs].sort((a, b) => a.timestamp - b.timestamp);
    const ranked = sorted.map((sub, index) => ({
      ...sub,
      rank: index + 1,
    }));
    setRankings(ranked);
    setShowResults(true);

    // 내 등수에 따라 점수 추가 (예: 1등 3점, 2등 2점 등)
    const myRank = ranked.find((r) => r.identity === name)?.rank;
    if (myRank) {
      setScore((prev) => prev + (ranked.length - myRank + 1)); // 1등이 가장 높은 점수
    }

    // 10초 후 새 라운드
    setTimeout(startNewRound, 10000);
  };

  const capturePhoto = async () => {
    if (!videoTrack || !videoRef.current || !canvasRef.current || !currentTask) {
      setError('카메라 또는 작업이 준비되지 않았습니다.');
      return;
    }

    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (blob) {
        const formData = new FormData();
        formData.append('file', blob, 'photo.jpg');

        try {
          const res = await axios.post('http://i13C207.p.ssafy.io:8001/api/predict-object', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          setResults(res.data.results);

          const isSuccess = res.data.results.some((obj: any) => obj.label.toLowerCase().includes(currentTask.toLowerCase()));
          if (isSuccess) {
            const timestamp = Date.now();
            const submission: Submission = { identity: name || 'anonymous', timestamp };
            const encoder = new TextEncoder();
            const data = encoder.encode(JSON.stringify(submission));
            await room?.localParticipant.publishData(data, { reliable: true });

            // 자신 제출도 submissions에 추가 (브로드캐스트 후 리스닝으로 들어오지만, 즉시 추가)
            setSubmissions((prev) => [...prev, submission]);
          } else {
            setError('탐지 실패: 올바른 객체가 아닙니다.');
          }
        } catch (error) {
          console.error('Error:', error);
          setError('객체 탐지 실패');
        }
      }
    }, 'image/jpeg');
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h1>게임 중: {currentTask}을(를) 찍어라!!</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <div style={{ marginRight: '20px' }}>
          {isCameraLoading && <p>카메라 로딩 중...</p>}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ width: '640px', height: '480px', border: '1px solid #ccc', display: isCameraLoading ? 'none' : 'block' }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
        <div>
          <h2>내 점수: {score}</h2>
          <h2>검출 결과:</h2>
          {results.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {results.map((obj, i) => (
                <li key={i}>
                  {obj.label} (신뢰도: {obj.confidence})
                </li>
              ))}
            </ul>
          ) : (
            <p>결과 없음</p>
          )}
        </div>
      </div>
      {!showResults ? (
        <button
          onClick={capturePhoto}
          disabled={isCameraLoading || !videoTrack}
          style={{
            margin: '10px',
            padding: '10px 20px',
            backgroundColor: videoTrack ? '#007bff' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: videoTrack ? 'pointer' : 'not-allowed',
          }}
        >
          촬영 및 검출
        </button>
      ) : (
        <div>
          <h2>라운드 결과 (10초 후 다음 라운드)</h2>
          <table style={{ margin: 'auto', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>등수</th>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>이름</th>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>제출 시간</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((r) => (
                <tr key={r.identity}>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>{r.rank}등</td>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>{r.identity}</td>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>{new Date(r.timestamp).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>내 탐지 결과: {results.map((r) => r.label).join(', ')} (사진은 로컬에서만 확인)</p>
        </div>
      )}
    </div>
  );
};

export default GameRoom;
import React, { useState, useEffect, useRef } from 'react';
import { Room, createLocalVideoTrack } from 'livekit-client';
import axios from 'axios';

const EmotionDetection: React.FC = () => {
  const [room, setRoom] = useState<Room | undefined>(undefined);
  const [videoTrack, setVideoTrack] = useState<any>(undefined);
  const [result, setResult] = useState<any>(null); // 배열 대신 단일 객체
  const [error, setError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const joinRoom = async () => {
      try {
        setIsCameraLoading(true);
        console.log('Requesting token...');
        const response = await axios.post('http://localhost:5000/api/get-token', {
          sessionId: 'my-session',
          participantName: 'user1',
        });
        const token = response.data.token;
        console.log('Token received:', token.substring(0, 20) + '...');

        const newRoom = new Room();
        await newRoom.connect('ws://localhost:7880', token);
        console.log('Connected to room');

        const track = await createLocalVideoTrack({
          facingMode: 'user',
          resolution: { width: 640, height: 480 },
        });
        await newRoom.localParticipant.publishTrack(track);
        setVideoTrack(track);
        setRoom(newRoom);

        if (videoRef.current) {
          track.attach(videoRef.current);
          console.log('Video track attached');
        }

        setIsCameraLoading(false);
      } catch (err) {
        console.error('Join room error:', err);
        setIsCameraLoading(false);
      }
    };

    joinRoom();
    return () => {
      if (room) {
        room.disconnect();
      }
      if (videoTrack) {
        videoTrack.detach();
      }
    };
  }, []);

  const capturePhoto = async () => {
    if (!videoTrack || !videoRef.current || !canvasRef.current) {
      setError('카메라가 준비되지 않았습니다.');
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
          const res = await axios.post('http://i13C207.p.ssafy.io:8001/api/analyze-emotion-nobg', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          console.log('API response:', res.data);
          setResult(res.data); // 단일 객체로 저장
          setError(null);
        } catch (error) {
          console.error('Error:', error);
        }
      }
    }, 'image/jpeg');
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h1>감정 탐지</h1>
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
          <h2>검출 결과:</h2>
          {result ? (
            result.success === false ? (
              <p>{result.message}</p> // 실패 메시지 표시
            ) : (
              <div>
                <p><strong>주요 감정:</strong> {result.dominant_emotion}</p>
                <p><strong>감정 점수:</strong></p>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {Object.entries(result.emotion_scores || {}).map(([emotion, score]) => (
                    <li key={emotion}>
                      {emotion}: {(score as number).toFixed(3)}
                    </li>
                  ))}
                </ul>
                <p><strong>얼굴 영역:</strong> x: {result.face_region?.x}, y: {result.face_region?.y}, w: {result.face_region?.w}, h: {result.face_region?.h}</p>
                {/* 배경 제거 이미지 표시 (선택) */}
                <img src={`data:image/jpeg;base64,${result.image_base64}`} alt="배경 제거 이미지" style={{ maxWidth: '200px', marginTop: '10px' }} />
              </div>
            )
          ) : (
            <p>결과 없음</p>
          )}
        </div>
      </div>
      <div>
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
      </div>
    </div>
  );
};

export default EmotionDetection;
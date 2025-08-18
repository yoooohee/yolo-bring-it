import React, { useState, useEffect, useRef } from 'react';
import { Room, createLocalVideoTrack } from 'livekit-client';
import axios from 'axios';

const ObjectDetection: React.FC = () => {
  const [room, setRoom] = useState<Room | undefined>(undefined);
  const [videoTrack, setVideoTrack] = useState<any>(undefined);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [phoneDetected, setPhoneDetected] = useState<{ label: string; confidence: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const joinRoom = async () => {
      try {
        setIsCameraLoading(true);
        console.log('Requesting token...');
        const response = await axios.post('http://192.168.100.56:5000/api/get-token', { // LAN IP로 변경
          sessionId: 'my-session',
          participantName: 'user1',
        });
        const token = response.data.token;
        console.log('Token received:', token.substring(0, 20) + '...');

        const newRoom = new Room();
        await newRoom.connect('wss://192-168-100-56.openvidu-local.dev:7443', token); // LAN URL
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
        setError('방 연결 실패');
        setIsCameraLoading(false);
      }
    };

    joinRoom();
    return () => {
      if (room) room.disconnect();
      if (videoTrack) videoTrack.detach();
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
          const res = await axios.post('http://i13C207.p.ssafy.io:8001/api/predict-object', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          setResults(res.data.results);

          // "Cell Phone" 탐지 확인
          const phoneResult = res.data.results.find((obj: any) =>
            obj.label.toLowerCase().includes('cell phone')
          );
          if (phoneResult) {
            setPhoneDetected({ label: '핸드폰', confidence: phoneResult.confidence });
          } else {
            setPhoneDetected(null);
          }

          setError(null);
        } catch (error) {
          console.error('Error:', error);
          setError('객체 탐지 실패');
          setPhoneDetected(null);
        }
      }
    }, 'image/jpeg');
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h1>객체 탐지</h1>
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
          {phoneDetected && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '2em', color: '#007bff' }}>{phoneDetected.label}</h3>
              <p>신뢰도: {(phoneDetected.confidence * 100).toFixed(2)}%</p>
            </div>
          )}
          {results.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {results.map((obj, i) => (
                <li key={i}>
                  {obj.label} (신뢰도: {(obj.confidence * 100).toFixed(2)}%)
                </li>
              ))}
            </ul>
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

export default ObjectDetection;
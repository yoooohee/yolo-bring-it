import React, { useState, useEffect } from 'react';
import { Room } from 'livekit-client';
import { useNavigate } from 'react-router-dom';

const WaitingRoom: React.FC = () => {
  const [room, setRoom] = useState<Room | undefined>(undefined);
  const [participantsCount, setParticipantsCount] = useState(1);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const sessionId = localStorage.getItem('sessionId');
  const name = localStorage.getItem('name');

  useEffect(() => {
    if (!token || !sessionId) {
      navigate('/');
      return;
    }

    const joinRoom = async () => {
      const newRoom = new Room();
      try {
        await newRoom.connect('wss://192-168-100-56.openvidu-local.dev:7443', token);
        setRoom(newRoom);

        // 참가자 수 업데이트
        newRoom.on('participantConnected', () => setParticipantsCount(newRoom.numParticipants));
        newRoom.on('participantDisconnected', () => setParticipantsCount(newRoom.numParticipants));

        setParticipantsCount(newRoom.numParticipants); // 자신 포함

        // 2명 되면 게임으로 이동
        if (newRoom.numParticipants >= 2) {
          navigate('/game');
        }
      } catch (err) {
        console.error('Join room error:', err);
      }
    };

    joinRoom();

    return () => {
      room?.disconnect();
    };
  }, [token, sessionId, navigate]);

  return (
    <div>
      <h2>대기 중... ({participantsCount}/2)</h2>
      <p>이름: {name}</p>
      {participantsCount < 2 && (
        <p>
          다른 사람이 들어올 때까지 기다려주세요. LAN URL 공유:{' '}
          <a href="http://192.168.100.56:3000">http://192.168.100.56:3000</a>
        </p>
      )}
    </div>
  );
};

export default WaitingRoom;
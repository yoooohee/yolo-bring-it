import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Login: React.FC = () => {
  const [name, setName] = useState('');
  const [sessionId] = useState('game-session');  // 고정 세션 ID, 또는 동적으로 생성
  const navigate = useNavigate();

  const handleJoin = async () => {
    if (!name) return;
    try {
      const response = await axios.post('http://192.168.100.56:5000/api/get-token', {  // localhost → IP 변경
        sessionId,
        participantName: name,
      });
      const token = response.data.token;
      localStorage.setItem('token', token);
      localStorage.setItem('name', name);
      localStorage.setItem('sessionId', sessionId);
      navigate('/waiting');
    } catch (err) {
      console.error('토큰 에러:', err);
    }
  };

  return (
    <div>
      <h2>이름 입력하고 게임 참여</h2>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="이름 입력"
      />
      <button onClick={handleJoin}>참여</button>
    </div>
  );
};

export default Login;
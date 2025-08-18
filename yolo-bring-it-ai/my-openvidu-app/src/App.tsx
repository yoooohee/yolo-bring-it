import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Login from './pages/Login';
import WaitingRoom from './pages/WaitingRoom';
import GameRoom from './pages/GameRoom';
import ObjectDetection from './pages/ObjectDetection';
import EmotionDetection from './pages/EmotionDetection';

const App: React.FC = () => {
  return (
    <Router>
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <h1>멀티플레이어 객체 탐지 게임</h1>
        <nav>
          <Link to="/object-detection">
            <button
              style={{
                margin: '10px',
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
              }}
            >
              객체 탐지
            </button>
          </Link>
        </nav>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/waiting" element={<WaitingRoom />} />
          <Route path="/game" element={<GameRoom />} />
          <Route path="/object-detection" element={<ObjectDetection />} />
          <Route path="/emotion-detection" element={<EmotionDetection />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { AccessToken } = require('livekit-server-sdk');

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'http://localhost:7880';

console.log(`LiveKit URL: ${LIVEKIT_URL}`);
console.log(`LiveKit API Key: ${LIVEKIT_API_KEY}`);
console.log(`LiveKit API Secret: ${LIVEKIT_API_SECRET.substring(0, 5)}...`);

app.post('/api/get-token', async (req, res) => {
  const { sessionId, participantName } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  try {
    console.log(`Creating token for session: ${sessionId}, participant: ${participantName || 'anonymous'}`);
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantName || 'user_' + Math.floor(Math.random() * 1000),
    });
    at.addGrant({ roomJoin: true, room: sessionId });
    const token = await at.toJwt();
    console.log('Token generated:', token.substring(0, 20) + '...');
    res.json({ token });
  } catch (error) {
    console.error('Error in get-token:', error.message, error.stack);
    res.status(500).json({ error: 'Token generation failed', details: error.message });
  }
});

app.listen(5000, '0.0.0.0', () => console.log('Backend running on http://0.0.0.0:5000'));  // 0.0.0.0 추가
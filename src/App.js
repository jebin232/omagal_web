import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import RandomVideoChat from './page/RandomVideoChat';

function Home() {
  const navigate = useNavigate();

  return (
    <div style={{ textAlign: 'center' }}>
      <h1>Random Video Chat</h1>
      <p>Welcome to the video chat app!</p>
      <button onClick={() => navigate('/chat')}>Get In</button>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chat" element={<RandomVideoChat />} />
      </Routes>
    </Router>
  );
}

export default App;

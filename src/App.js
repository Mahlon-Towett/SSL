// src/App.js - Main application component
import React from 'react';
import SignToTextModule from './components/SignToTextModule';
import SpeechToSignModule from './components/SpeechToSignModule';
import InfoPanel from './components/InfoPanel';
import './App.css';

function App() {
  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <h1 className="header-title">
          <span className="header-icon">🤟</span>
          AI Sign Language Translator
        </h1>
        <p className="header-subtitle">
          Real-time bidirectional translation between sign language and text/speech
        </p>
      </header>

      {/* Main Content Grid */}
      <div className="main-content">
        <div className="main-grid">
          {/* Sign to Text Module */}
          <SignToTextModule />
          
          {/* Speech to Sign Module */}
          <SpeechToSignModule />
        </div>

        {/* Info Panel */}
        <InfoPanel />
      </div>
    </div>
  );
}

export default App;
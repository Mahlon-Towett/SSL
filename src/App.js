// src/App.js - Main application component with proper imports
import React from 'react';
import SpeechToSignModule from './components/SpeechToSignModule';
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
          {/* Enhanced Speech to Sign Module */}
          <SpeechToSignModule />
          
          {/* You can add your SignToTextModule here if you have it */}
          {/* <SignToTextModule /> */}
        </div>

        {/* You can add InfoPanel here if you have it */}
        {/* <InfoPanel /> */}
      </div>
    </div>
  );
}

export default App;
// src/App.js - Updated with beautiful side-by-side layout
import React from 'react';
import SpeechToSignModule from './components/SpeechToSignModule';
import SignToTextModule from './components/SignToTextModule';
import './App.css';

function App() {
  return (
    <div className="app-container">
      {/* Enhanced Header */}
      <header className="app-header">
        <div className="header-content">
          <h1 className="header-title">
            <span className="header-icon">🤟</span>
            AI Sign Language Translator
            <span className="header-badge">v2.0</span>
          </h1>
          <p className="header-subtitle">
            Real-time bidirectional translation between sign language, text, and speech
          </p>
          <div className="header-features">
            <div className="feature-tag">
              <span className="feature-icon">🎤</span>
              Speech to Sign
            </div>
            <div className="feature-tag">
              <span className="feature-icon">👋</span>
              Sign to Text
            </div>
            <div className="feature-tag">
              <span className="feature-icon">🔊</span>
              Text to Speech
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Professional Grid Layout */}
        <div className="modules-grid">
          {/* Speech to Sign Module - Left Panel */}
          <div className="module-panel speech-to-sign-panel">
            <div className="panel-header">
              <div className="panel-icon speech-icon">🎤</div>
              <div className="panel-info">
                <h2 className="panel-title">Speech to Sign</h2>
                <p className="panel-description">Convert your speech into sign language animations</p>
              </div>
            </div>
            <div className="panel-content">
              <SpeechToSignModule />
            </div>
          </div>

          {/* Separator Line */}
          <div className="modules-separator">
            <div className="separator-line"></div>
            <div className="separator-icon">⚡</div>
            <div className="separator-line"></div>
          </div>

          {/* Sign to Text Module - Right Panel */}
          <div className="module-panel sign-to-text-panel">
            <div className="panel-header">
              <div className="panel-icon sign-icon">👋</div>
              <div className="panel-info">
                <h2 className="panel-title">Sign to Text</h2>
                <p className="panel-description">Detect sign language and convert to readable text</p>
              </div>
            </div>
            <div className="panel-content">
              <SignToTextModule />
            </div>
          </div>
        </div>

        {/* Bottom Info Panel */}
        <div className="info-panel">
          <div className="info-content">
            <h3 className="info-title">🚀 How to Use Both Modules</h3>
            <div className="info-grid">
              <div className="info-section">
                <h4 className="info-section-title">📢 Speech to Sign (Left)</h4>
                <ul className="info-list">
                  <li>Click "Start Speaking" to begin voice recognition</li>
                  <li>Speak clearly into your microphone</li>
                  <li>Watch as your words are converted to sign animations</li>
                  <li>Use quick sign buttons for common phrases</li>
                </ul>
              </div>
              <div className="info-section">
                <h4 className="info-section-title">👋 Sign to Text (Right)</h4>
                <ul className="info-list">
                  <li>Start your Python backend: <code>python web_fed_sign_translator.py</code></li>
                  <li>Click "Start Camera" to enable video feed</li>
                  <li>Click "Start Detection" to begin sign recognition</li>
                  <li>Use gestures in front of camera to see text output</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="app-footer">
          <div className="footer-content">
            <p className="footer-text">
              Built with ❤️ for accessible communication • Real-time AI translation • Open source
            </p>
            <div className="footer-tech">
              <span className="tech-badge">React</span>
              <span className="tech-badge">MediaPipe</span>
              <span className="tech-badge">Web Speech API</span>
              <span className="tech-badge">WebSocket</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
// src/components/InfoPanel.js - Information and tips panel
import React from 'react';
import { 
  Hand, Mic, MessageSquare, RefreshCw 
} from 'lucide-react';

const InfoPanel = () => {
  return (
    <div className="info-panel">
      <div className="feature-grid">
        <div className="feature-item">
          <Hand className="feature-icon feature-icon-yellow" />
          <div>
            <h4 className="feature-title">Real-time Detection</h4>
            <p className="feature-description">AI-powered sign recognition</p>
          </div>
        </div>
        <div className="feature-item">
          <Mic className="feature-icon feature-icon-cyan" />
          <div>
            <h4 className="feature-title">Speech Recognition</h4>
            <p className="feature-description">Convert speech to signs instantly</p>
          </div>
        </div>
        <div className="feature-item">
          <MessageSquare className="feature-icon feature-icon-pink" />
          <div>
            <h4 className="feature-title">150+ Signs</h4>
            <p className="feature-description">Comprehensive sign vocabulary</p>
          </div>
        </div>
        <div className="feature-item">
          <RefreshCw className="feature-icon feature-icon-green" />
          <div>
            <h4 className="feature-title">Bidirectional</h4>
            <p className="feature-description">Sign to text & text to sign</p>
          </div>
        </div>
      </div>

      {/* Usage Tips */}
      <div className="usage-tips">
        <h4 className="tips-title">💡 Usage Tips</h4>
        <ul className="tips-list">
          <li>Say "My name is [name]" to spell your name</li>
          <li>Say individual letters to fingerspell</li>
          <li>Use "Thank you", "Do not", "Cannot" for phrases</li>
          <li>Camera detects ASL signs in real-time</li>
        </ul>
      </div>
    </div>
  );
};

export default InfoPanel;
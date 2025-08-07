// src/components/SpeechToSignModule.jsx - Updated to use new enhanced avatar and queue system

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import EnhancedVideoAvatar from './EnhancedVideoAvatar';
import ErrorBoundary from './ErrorBoundary';
import Controls from './Controls';
import SignQueueManager from '../utils/SignQueueManager';
import AvatarStateMachine from '../utils/AvatarStateMachine';
import { getAllSigns } from '../constants/videoMappings';
import { 
  MessageSquare, Mic, MicOff, Play, ChevronRight, ChevronLeft,
  Pause, Square, SkipForward, AlertCircle
} from 'lucide-react';

const SpeechToSignModule = () => {
  // States
  const [currentSign, setCurrentSign] = useState('Hello');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);
  const [showAllSigns, setShowAllSigns] = useState(false);
  const [queueStatus, setQueueStatus] = useState(null);
  const [avatarState, setAvatarState] = useState('neutral');
  const [error, setError] = useState(null);
  
  // Refs
  const recognitionRef = useRef(null);

  // Complete list of available signs
  const signs = useMemo(() => getAllSigns(), []);

  // Managers (created once)
  const avatarStateMachine = useMemo(() => new AvatarStateMachine({
    debugMode: process.env.NODE_ENV === 'development'
  }), []);

  const queueManager = useMemo(() => new SignQueueManager(avatarStateMachine, {
    debugMode: process.env.NODE_ENV === 'development',
    autoStart: true,
    interSignDelay: 300,
    callbacks: {
      onQueueStart: (data) => {
        console.log('🚀 Queue started:', data);
        setIsPlaying(true);
      },
      onQueueComplete: (data) => {
        console.log('✅ Queue completed:', data);
        setIsPlaying(false);
      },
      onSignStart: (data) => {
        console.log('🎬 Sign started:', data.item.signName);
        setCurrentSign(data.item.signName);
      },
      onSignComplete: (data) => {
        console.log('✅ Sign completed:', data.item.signName);
      },
      onSignError: (data) => {
        console.error('❌ Sign error:', data.error);
        setError(`Sign error: ${data.item.signName}`);
      },
      onProgress: (data) => {
        setQueueStatus(data);
      }
    }
  }), [avatarStateMachine]);

  // Speech-to-sign mapping (only for existing videos)
  const speechToSignMapping = useMemo(() => ({
    // Basic mappings - only include signs that have videos
    'hello': 'Hello',
    'hi': 'Hello',
    'hey': 'Hello',
    'thank': 'Thank',
    'thanks': 'Thank_You',
    'yes': 'Yes',
    'help': 'Help',
    'good': 'Good',
    'great': 'Great',
    'love': 'Love',
    'friend': 'Friend',
    'beautiful': 'Beautiful',
    'better': 'Better',
    'happy': 'Happy',
    'name': 'Name',
    'my': 'My',
    'me': 'ME',
    'you': 'You',
    'your': 'Your',
    'yourself': 'Yourself',
    'i': 'I',
    'we': 'We',
    'us': 'Us',
    'they': 'They',
    'this': 'This',
    'that': 'That',
    'those': 'Those',
    'here': 'Here',
    'there': 'There',
    'where': 'Where',
    'what': 'What',
    'when': 'When',
    'why': 'Why',
    'who': 'Who',
    'how': 'How',
    'welcome': 'Welcome',
    'sorry': 'Sorry'
  }), []);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
      
      recognitionRef.current.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        setTranscript(interimTranscript);
        if (finalTranscript) {
          setFinalTranscript(prev => prev + finalTranscript);
          translateSpeechToSigns(finalTranscript);
        }
      };
      
      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setError(`Speech recognition error: ${event.error}`);
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
      
      setSpeechSupported(true);
    }
  }, []);

  // Translate speech to signs with improved logic
  const translateSpeechToSigns = useCallback((spokenText) => {
    console.log('🎙️ Translating speech:', spokenText);
    const words = spokenText.toLowerCase().trim().split(/\s+/);
    const foundSigns = [];

    // Check for "my name is" pattern
    const nameMatch = spokenText.match(/(?:my name is|i am) (\w+)/i);
    if (nameMatch && nameMatch[1]) {
      const name = nameMatch[1].toUpperCase();
      foundSigns.push('My', 'Name');
      
      // Add each letter of the name
      for (const letter of name) {
        if (letter.match(/[A-Z]/)) {
          foundSigns.push(letter);
        }
      }
    } else {
      // Check for multi-word phrases first
      const fullText = spokenText.toLowerCase();
      if (fullText.includes('thank you')) {
        foundSigns.push('Thank_You');
      }
      if (fullText.includes('do not') || fullText.includes("don't")) {
        foundSigns.push('Do_Not');
      }
      if (fullText.includes('does not') || fullText.includes("doesn't")) {
        foundSigns.push('Does_Not');
      }
      if (fullText.includes('cannot') || fullText.includes("can't")) {
        foundSigns.push('Cannot');
      }

      // Process individual words
      for (const word of words) {
        // Skip words that were already part of multi-word phrases
        if ((word === 'thank' && fullText.includes('thank you')) ||
            (word === 'you' && fullText.includes('thank you')) ||
            (word === 'do' && (fullText.includes('do not') || fullText.includes("don't"))) ||
            (word === 'does' && (fullText.includes('does not') || fullText.includes("doesn't"))) ||
            (word === 'not' && (fullText.includes('do not') || fullText.includes('does not')))) {
          continue;
        }

        // Check if it's a single letter
        if (word.length === 1 && word.match(/[a-z]/i)) {
          foundSigns.push(word.toUpperCase());
        } 
        // Check if it's a number
        else if (word.match(/^\d$/)) {
          foundSigns.push(word);
        }
        // Check word mapping
        else if (speechToSignMapping[word]) {
          const sign = speechToSignMapping[word];
          if (!foundSigns.includes(sign)) {
            foundSigns.push(sign);
          }
        }
      }
    }

    if (foundSigns.length > 0) {
      console.log('🎯 Found signs to translate:', foundSigns);
      // Clear any existing error
      setError(null);
      // Add to queue for processing
      queueManager.addSigns(foundSigns);
    } else {
      console.log('⚠️ No signs found for:', spokenText);
    }
  }, [speechToSignMapping, queueManager]);

  // Toggle speech recognition
  const toggleListening = useCallback(() => {
    if (!speechSupported) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      setFinalTranscript('');
      setError(null);
      
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('Failed to start recognition:', error);
        setError('Failed to start speech recognition. Please try again.');
      }
    }
  }, [speechSupported, isListening]);

  // Manual controls
  const playAnimation = useCallback(() => {
    if (!isPlaying) {
      queueManager.addSign(currentSign);
    }
  }, [currentSign, isPlaying, queueManager]);

  const pauseAnimation = useCallback(() => {
    queueManager.pause();
    setIsPlaying(false);
  }, [queueManager]);

  const stopAnimation = useCallback(() => {
    queueManager.stop();
    setIsPlaying(false);
  }, [queueManager]);

  const nextSign = useCallback(() => {
    const currentIndex = signs.indexOf(currentSign);
    const nextIndex = (currentIndex + 1) % signs.length;
    const nextSignName = signs[nextIndex];
    
    queueManager.clear(true);
    setCurrentSign(nextSignName);
  }, [currentSign, signs, queueManager]);

  const prevSign = useCallback(() => {
    const currentIndex = signs.indexOf(currentSign);
    const prevIndex = currentIndex === 0 ? signs.length - 1 : currentIndex - 1;
    const prevSignName = signs[prevIndex];
    
    queueManager.clear(true);
    setCurrentSign(prevSignName);
  }, [currentSign, signs, queueManager]);

  const selectSign = useCallback((signKey) => {
    queueManager.clear(true);
    setCurrentSign(signKey);
    setError(null);
  }, [queueManager]);

  // Handle avatar state changes
  const handleAvatarStateChange = useCallback((state, data) => {
    setAvatarState(state);
    if (state === 'error' && data?.error) {
      setError(`Avatar error: ${data.error}`);
    }
  }, []);

  // Handle video completion
  const handleVideoComplete = useCallback((signName) => {
    console.log('🎬 Video completed:', signName);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      queueManager.stop();
    };
  }, [queueManager]);

  return (
    <div className="module-card card-speech-to-sign">
      <div className="card-header">
        <h2 className="card-title">
          <MessageSquare className="icon-purple" />
          Speech to Sign Translation
        </h2>
        <div className="card-controls">
          {/* Queue status indicator */}
          {queueStatus && (
            <div className="queue-status-indicator">
              <span className="queue-progress">
                {Math.round(queueStatus.percentage)}%
              </span>
              <span className="queue-count">
                ({queueStatus.current}/{queueStatus.total})
              </span>
            </div>
          )}
          
          {/* Avatar state indicator */}
          <div className={`avatar-state-indicator state-${avatarState}`}>
            {avatarState === 'signing' && <Play size={14} />}
            {avatarState === 'loading' && <div className="loading-spinner" />}
            {avatarState === 'error' && <AlertCircle size={14} />}
            <span className="state-text">
              {avatarState.charAt(0).toUpperCase() + avatarState.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Enhanced Avatar Display */}
      <div className="avatar-container">
        <ErrorBoundary>
          <EnhancedVideoAvatar 
            currentSign={currentSign} 
            isPlaying={isPlaying}
            onVideoComplete={handleVideoComplete}
            onStateChange={handleAvatarStateChange}
            debugMode={process.env.NODE_ENV === 'development'}
          />
        </ErrorBoundary>
      </div>

      {/* Enhanced Controls */}
      <div className="enhanced-controls">
        <div className="control-group">
          <button
            onClick={playAnimation}
            className="btn-control btn-play"
            disabled={isPlaying}
            title="Play current sign"
          >
            <Play size={16} />
            Play
          </button>
          
          <button
            onClick={pauseAnimation}
            className="btn-control btn-pause"
            disabled={!isPlaying}
            title="Pause queue"
          >
            <Pause size={16} />
            Pause
          </button>
          
          <button
            onClick={stopAnimation}
            className="btn-control btn-stop"
            disabled={!isPlaying}
            title="Stop and clear queue"
          >
            <Square size={16} />
            Stop
          </button>
          
          <button
            onClick={prevSign}
            className="btn-control btn-nav"
            title="Previous sign"
          >
            <ChevronLeft size={16} />
          </button>
          
          <button
            onClick={nextSign}
            className="btn-control btn-nav"
            title="Next sign"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Speech Recognition Section */}
      <div className="speech-section">
        <button
          onClick={toggleListening}
          className={`btn-speech ${isListening ? 'btn-speech-active' : 'btn-speech-inactive'}`}
          disabled={!speechSupported}
        >
          {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          {isListening ? 'Stop Listening' : 'Start Speaking'}
        </button>

        {/* Live Transcript */}
        <div className="transcript-display">
          <div className="transcript-status">
            <span className={`status-dot ${isListening ? 'status-active' : 'status-inactive'}`} />
            {isListening ? 'Listening...' : speechSupported ? 'Click to start speaking' : 'Speech not supported'}
          </div>
          
          <div className="transcript-content">
            {(finalTranscript + transcript) || 'Your speech will appear here...'}
          </div>

          {/* Queue Status Display */}
          {queueStatus && queueStatus.total > 0 && (
            <div className="queue-status-display">
              <div className="queue-header">
                <span className="queue-label">
                  Processing Queue: {queueStatus.current}/{queueStatus.total}
                </span>
                <div className="queue-progress-bar">
                  <div 
                    className="queue-progress-fill" 
                    style={{ width: `${queueStatus.percentage}%` }}
                  />
                </div>
              </div>
              
              {queueStatus.remainingTime && (
                <div className="queue-eta">
                  ETA: {Math.round(queueStatus.remainingTime / 1000)}s
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-display">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button 
              onClick={() => setError(null)} 
              className="error-dismiss"
              title="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {/* Quick Sign Selector */}
        <div className="sign-selector">
          <div className="selector-header">
            <h4>Quick Select Signs</h4>
            <button 
              onClick={() => setShowAllSigns(!showAllSigns)}
              className="btn-toggle"
            >
              {showAllSigns ? 'Show Less' : 'Show All'}
              <ChevronRight className={`chevron ${showAllSigns ? 'chevron-down' : ''}`} />
            </button>
          </div>
          
          <div className="word-buttons">
            <div className="button-grid">
              {(showAllSigns ? signs : signs.filter(sign => 
                ['Hello', 'Thank_You', 'Yes', 'Help', 'Good', 'Love', 'Friend', 'Sorry'].includes(sign)
              )).map(sign => (
                <button
                  key={sign}
                  onClick={() => selectSign(sign)}
                  className={`word-btn ${currentSign === sign ? 'word-btn-active' : ''}`}
                >
                  {sign.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpeechToSignModule;
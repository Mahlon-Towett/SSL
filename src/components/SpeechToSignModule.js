// src/components/SpeechToSignModule.js - Speech to sign translation functionality
import React, { useState, useRef, useEffect, useCallback } from 'react';
import VideoBasedAvatar from './VideoBasedAvatar';
import Controls from './Controls';
import { 
  MessageSquare, Mic, MicOff, Play, ChevronRight, ChevronLeft
} from 'lucide-react';

const SpeechToSignModule = () => {
  // States
  const [currentSign, setCurrentSign] = useState('Hello');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [translationQueue, setTranslationQueue] = useState([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [isTranslating, setIsTranslating] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [showAllSigns, setShowAllSigns] = useState(false);
  
  // Refs
  const recognitionRef = useRef(null);
  const queueTimeoutRef = useRef(null);

  // Complete list of available signs
  const signs = [
    // Numbers
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    // Letters A-Z
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    // Common words
    'Hello', 'Welcome', 'Thank_You', 'Thank', 'Beautiful', 'Better', 'Happy', 'Good', 
    'Great', 'Name', 'My', 'ME', 'You', 'Your', 'Yourself', 'I', 'We', 'Us', 'They',
    'This', 'That', 'Those', 'Here', 'There', 'Where', 'What', 'When', 'Why', 'Who',
    'Which', 'Whose', 'How', 'Time', 'Day', 'Home', 'Work', 'Study', 'Learn', 'Help',
    'Go', 'Come', 'Stay', 'Walk', 'See', 'Look', 'Talk', 'Say', 'Ask', 'Eat', 'Drink',
    'Sleep', 'Sad', 'Angry', 'Love', 'Like', 'Want', 'Need', 'Have', 'Do',
    'Does_Not', 'Do_Not', 'Cannot', 'Will', 'Can', 'Be', 'Am', 'Is', 'Are', 'Was'
  ];

  // Speech-to-Sign mapping
  const speechToSignMapping = {
    'hello': 'Hello',
    'hi': 'Hello',
    'hey': 'Hello',
    'welcome': 'Welcome',
    'thank you': 'Thank_You',
    'thanks': 'Thank_You',
    'beautiful': 'Beautiful',
    'pretty': 'Beautiful',
    'happy': 'Happy',
    'glad': 'Happy',
    'good': 'Good',
    'great': 'Great',
    'better': 'Better',
    'name': 'Name',
    'my': 'My',
    'me': 'ME',
    'you': 'You',
    'your': 'Your',
    'i': 'I',
    'we': 'We',
    'they': 'They',
    'what': 'What',
    'where': 'Where',
    'when': 'When',
    'why': 'Why',
    'who': 'Who',
    'how': 'How',
    'help': 'Help',
    'work': 'Work',
    'home': 'Home',
    'time': 'Time',
    'day': 'Day',
    'go': 'Go',
    'come': 'Come',
    'see': 'See',
    'look': 'Look',
    'walk': 'Walk',
    'talk': 'Talk',
    'say': 'Say',
    'ask': 'Ask',
    'eat': 'Eat',
    'drink': 'Drink',
    'sleep': 'Sleep',
    'sad': 'Sad',
    'angry': 'Angry',
    'love': 'Love',
    'like': 'Like',
    'want': 'Want',
    'need': 'Need',
    'have': 'Have',
    'do': 'Do',
    'can': 'Can',
    'will': 'Will',
    'be': 'Be',
    'am': 'Am',
    'is': 'Is',
    'are': 'Are',
    'was': 'Was'
  };

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
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
      
      setSpeechSupported(true);
    }
  }, []);

  // Translate speech to signs
  const translateSpeechToSigns = useCallback((spokenText) => {
    console.log('Translating:', spokenText);
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
      console.log('Found signs to translate:', foundSigns);
      startTranslationSequence(foundSigns);
    }
  }, []);

  // Start translation sequence
  const startTranslationSequence = useCallback((signs) => {
    console.log('Starting translation sequence:', signs);
    
    // Clear any existing timeout
    if (queueTimeoutRef.current) {
      clearTimeout(queueTimeoutRef.current);
      queueTimeoutRef.current = null;
    }
    
    setTranslationQueue(signs);
    setCurrentQueueIndex(0);
    setIsTranslating(true);
    
    // Process the queue
    processQueue(signs, 0);
  }, []);

  // Process queue one sign at a time
  const processQueue = useCallback((queue, index) => {
    if (index >= queue.length) {
      console.log('Translation sequence completed');
      setIsTranslating(false);
      setTranslationQueue([]);
      setCurrentQueueIndex(0);
      return;
    }

    const sign = queue[index];
    console.log(`Playing sign ${index + 1}/${queue.length}: ${sign}`);
    
    setCurrentQueueIndex(index);
    setCurrentSign(sign);
    setIsPlaying(true);

    // Adjust timing based on sign type
    const duration = (sign.length === 1 || sign.match(/^\d$/)) ? 1500 : 2500;

    // Move to next sign after duration
    queueTimeoutRef.current = setTimeout(() => {
      setIsPlaying(false);
      
      // Small delay before next sign for smooth transition
      setTimeout(() => {
        processQueue(queue, index + 1);
      }, 300);
    }, duration);
  }, []);

  // Toggle speech recognition
  const toggleListening = () => {
    if (!speechSupported) {
      alert('Speech recognition not supported in this browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      setFinalTranscript('');
      
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('Failed to start recognition:', error);
        alert('Failed to start speech recognition. Please try again.');
      }
    }
  };

  // Manual controls
  const playAnimation = () => {
    if (queueTimeoutRef.current) {
      clearTimeout(queueTimeoutRef.current);
      queueTimeoutRef.current = null;
    }
    
    setIsTranslating(false);
    setTranslationQueue([]);
    setIsPlaying(true);
  };

  const pauseAnimation = () => {
    setIsPlaying(false);
  };

  const nextSign = () => {
    const currentIndex = signs.indexOf(currentSign);
    const nextIndex = (currentIndex + 1) % signs.length;
    
    if (queueTimeoutRef.current) {
      clearTimeout(queueTimeoutRef.current);
      queueTimeoutRef.current = null;
    }
    
    setIsTranslating(false);
    setTranslationQueue([]);
    setIsPlaying(false);
    setCurrentSign(signs[nextIndex]);
  };

  const prevSign = () => {
    const currentIndex = signs.indexOf(currentSign);
    const prevIndex = currentIndex === 0 ? signs.length - 1 : currentIndex - 1;
    
    if (queueTimeoutRef.current) {
      clearTimeout(queueTimeoutRef.current);
      queueTimeoutRef.current = null;
    }
    
    setIsTranslating(false);
    setTranslationQueue([]);
    setIsPlaying(false);
    setCurrentSign(signs[prevIndex]);
  };

  const selectSign = (signKey) => {
    if (queueTimeoutRef.current) {
      clearTimeout(queueTimeoutRef.current);
      queueTimeoutRef.current = null;
    }
    
    setIsTranslating(false);
    setTranslationQueue([]);
    setIsPlaying(false);
    setCurrentSign(signKey);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (queueTimeoutRef.current) {
        clearTimeout(queueTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="module-card card-speech-to-sign">
      <div className="card-header">
        <h2 className="card-title">
          <MessageSquare className="icon-purple" />
          Speech to Sign Translation
        </h2>
        <div className="card-controls">
          {isPlaying && (
            <div className="playing-indicator">
              <Play size={14} />
              Playing
            </div>
          )}
        </div>
      </div>

      {/* 3D Avatar Display */}
      <div className="avatar-container">
        <VideoBasedAvatar 
          currentSign={currentSign} 
          isPlaying={isPlaying}
        />
      </div>

      {/* Controls */}
      <Controls 
        isPlaying={isPlaying}
        onPlay={playAnimation}
        onPause={pauseAnimation}
        onNext={nextSign}
        onPrev={prevSign}
        currentSign={currentSign}
        animationTime={0}
        signDatabase={{}}
        availableSigns={signs}
      />

      {/* Speech Recognition Section */}
      <div className="speech-section">
        <button
          onClick={toggleListening}
          className={`btn-speech ${isListening ? 'btn-speech-active' : 'btn-speech-inactive'}`}
        >
          {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          {isListening ? 'Stop Listening' : 'Start Speaking'}
        </button>

        {/* Live Transcript */}
        <div className="transcript-display">
          <div className="transcript-status">
            <span className={`status-dot ${isListening ? 'status-active' : 'status-inactive'}`} />
            {isListening ? 'Listening...' : 'Click to start speaking'}
          </div>
          
          <div className="transcript-content">
            {(finalTranscript + transcript) || 'Your speech will appear here...'}
          </div>

          {/* Translation Queue Status */}
          {isTranslating && translationQueue.length > 0 && (
            <div className="translation-status">
              <span className="translation-label">
                Translating: {currentQueueIndex + 1}/{translationQueue.length}
              </span>
              <div className="translation-queue">
                {translationQueue.map((sign, index) => (
                  <span 
                    key={index}
                    className={`queue-sign ${index === currentQueueIndex ? 'queue-sign-active' : ''}`}
                  >
                    {sign.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

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
                ['Hello', 'Thank_You', 'Yes', 'No', 'Help', 'Good', 'Love', 'Friend'].includes(sign)
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
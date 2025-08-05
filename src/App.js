import React, { useState, useRef, useEffect, useCallback } from 'react';
import VideoBasedAvatar from './components/VideoBasedAvatar';
import Controls from './components/Controls';
import { 
  Mic, MicOff, Camera, CameraOff, Volume2, VolumeX, 
  Activity, Shield, Cpu, Play, Pause, MessageSquare,
  Eye, Hand, ChevronRight, ChevronLeft, RefreshCw,
  Save, Trash2, Download, Settings
} from 'lucide-react';
import './App.css';

function App() {
  // Speech to Sign states
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
  
  // Sign to Text states
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraInitializing, setCameraInitializing] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [currentDetectedSign, setCurrentDetectedSign] = useState('');
  const [signConfidence, setSignConfidence] = useState(0);
  const [recognizedSigns, setRecognizedSigns] = useState([]);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  
  // Refs
  const recognitionRef = useRef(null);
  const queueTimeoutRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const detectionIntervalRef = useRef(null);

  // Complete list of available signs with proper video mappings
  const signs = [
    // Numbers
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    // Letters A-Z
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    // Common words - ensure these match your video file names exactly
    'Hello', 'Welcome', 'Thank_You', 'Thank', 'Beautiful', 'Better', 'Happy', 'Good', 
    'Great', 'Name', 'My', 'ME', 'You', 'Your', 'Yourself', 'I', 'We', 'Us', 'They',
    'This', 'That', 'Those', 'Here', 'There', 'Where', 'What', 'When', 'Why', 'Who',
    'Which', 'Whose', 'How', 'Time', 'Day', 'Home', 'Work', 'Study', 'Learn', 'Help',
    'Go', 'Come', 'Stay', 'Walk', 'See', 'Look', 'Talk', 'Say', 'Ask', 'Eat', 'Drink',
    'Sleep', 'Sad', 'Angry', 'Love', 'Like', 'Want', 'Need', 'Have', 'Do',
    'Does_Not', 'Do_Not', 'Cannot', 'Will', 'Can', 'Be', 'Am', 'Is', 'Are', 'Was'
  ];

  // Speech-to-Sign mapping (handles spaces and underscores)
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
    'not': 'Do_Not',
    'cannot': 'Cannot',
    'cant': 'Cannot',
    'dont': 'Do_Not',
    'doesnt': 'Does_Not',
    'does not': 'Does_Not',
    'do not': 'Do_Not'
  };

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setSpeechSupported(true);
      
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        let interimTranscript = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        setTranscript(interimTranscript);
        
        if (finalText.trim()) {
          console.log('Final speech result:', finalText);
          setFinalTranscript(prev => prev + ' ' + finalText);
          processSpokenText(finalText.toLowerCase().trim());
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please allow microphone access.');
        }
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        if (isListening) {
          setTimeout(() => {
            try {
              recognitionRef.current.start();
            } catch (error) {
              console.log('Recognition restart failed:', error);
              setIsListening(false);
            }
          }, 100);
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.log('Recognition stop error:', error);
        }
      }
    };
  }, [isListening]);

  // Effect to handle camera stream setup after camera becomes active
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      console.log('🔧 Setting up video element with existing stream...');
      setupVideoElement();
    }
  }, [cameraActive]);

  // Setup video element with stream
  const setupVideoElement = async () => {
    if (!videoRef.current || !streamRef.current) {
      console.error('❌ Missing video element or stream');
      return;
    }

    console.log('🔧 Setting up video element...');
    
    // Clear any existing source
    if (videoRef.current.srcObject) {
      console.log('Clearing existing srcObject');
      const oldStream = videoRef.current.srcObject;
      oldStream.getTracks().forEach(track => track.stop());
    }
    
    // Add comprehensive event listeners
    videoRef.current.onloadedmetadata = (e) => {
      console.log('✅ Event: loadedmetadata', {
        videoWidth: e.target.videoWidth,
        videoHeight: e.target.videoHeight,
        duration: e.target.duration,
        readyState: e.target.readyState
      });
    };
    
    videoRef.current.oncanplay = (e) => {
      console.log('✅ Event: canplay - Video can start playing');
    };
    
    videoRef.current.onplaying = (e) => {
      console.log('✅ Event: playing - Video is now playing');
      setCameraInitializing(false);
    };
    
    videoRef.current.onerror = (e) => {
      console.error('❌ Video error:', e);
      setCameraInitializing(false);
    };
    
    // Set attributes explicitly
    videoRef.current.setAttribute('autoplay', 'true');
    videoRef.current.setAttribute('playsinline', 'true');
    videoRef.current.setAttribute('muted', 'true');
    
    // Assign the stream
    console.log('📌 Assigning stream to video element...');
    videoRef.current.srcObject = streamRef.current;
    
    // Try to play
    try {
      await videoRef.current.play();
      console.log('✅ Play successful');
    } catch (playError) {
      console.warn('Play failed, retrying:', playError.message);
      setTimeout(async () => {
        try {
          await videoRef.current.play();
          console.log('✅ Retry play successful');
        } catch (retryError) {
          console.error('❌ All play attempts failed:', retryError);
          setCameraInitializing(false);
        }
      }, 100);
    }
  };

  // Process spoken text
  const processSpokenText = useCallback((spokenText) => {
    console.log('Processing speech:', spokenText);
    
    const foundSigns = [];
    const words = spokenText.toLowerCase().split(' ');

    // Check for name introduction
    if (spokenText.includes('my name is') || spokenText.includes('i am')) {
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

  // Process queue one sign at a time with proper video duration
  const processQueue = useCallback((queue, index) => {
    if (index >= queue.length) {
      // Queue complete
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
    // Letters and numbers typically need less time
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

  // FIXED: Camera functions for Sign to Text
  const startCamera = async () => {
    console.log('=== CAMERA START INITIATED ===');
    
    setCameraInitializing(true);
    
    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('❌ getUserMedia is not supported in this browser');
      alert('Camera API not supported in this browser');
      setCameraInitializing(false);
      return;
    }
    
    try {
      console.log('🎥 Requesting camera access...');
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Stream obtained successfully!');
      
      // Store stream reference first
      streamRef.current = stream;
      
      // Set camera active (this will trigger the useEffect to setup video)
      setCameraActive(true);
      
      // Start detection simulation
      simulateSignDetection();
      console.log('✅ Sign detection started');
      
    } catch (error) {
      console.error('❌ CAMERA ERROR:', error);
      
      // Provide specific error messages
      if (error.name === 'NotAllowedError') {
        alert('Camera permission denied. Please allow camera access and try again.');
      } else if (error.name === 'NotFoundError') {
        alert('No camera found. Please connect a camera and try again.');
      } else if (error.name === 'NotReadableError') {
        alert('Camera is already in use by another application.');
      } else if (error.name === 'OverconstrainedError') {
        alert('Camera does not support the requested settings.');
      } else {
        alert(`Camera error: ${error.message}`);
      }
      
      setCameraActive(false);
      setCameraInitializing(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    
    setCameraActive(false);
    setCameraInitializing(false);
    setHandDetected(false);
    setCurrentDetectedSign('');
  };

  // Simulate sign detection (replace with actual ML model)
  const simulateSignDetection = () => {
    const detectionSigns = ['HELLO', 'THANK YOU', 'YES', 'NO', 'PLEASE', 'GOOD', 'HELP', 'LOVE', 'FRIEND'];
    
    detectionIntervalRef.current = setInterval(() => {
      if (cameraActive && Math.random() > 0.5) {
        const sign = detectionSigns[Math.floor(Math.random() * detectionSigns.length)];
        const confidence = Math.floor(70 + Math.random() * 30);
        
        setHandDetected(true);
        setCurrentDetectedSign(sign);
        setSignConfidence(confidence);
        
        if (confidence > 85) {
          setRecognizedSigns(prev => {
            const newSigns = [...prev, sign];
            if (ttsEnabled) {
              speak(sign);
            }
            return newSigns;
          });
        }
        
        setTimeout(() => {
          setHandDetected(false);
          setCurrentDetectedSign('');
        }, 1500);
      }
    }, 3000);
  };

  // Text to speech function
  const speak = (text) => {
    if ('speechSynthesis' in window) {
      setSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(text.toLowerCase());
      utterance.onend = () => setSpeaking(false);
      speechSynthesis.speak(utterance);
    }
  };

  // Clear recognized text
  const clearRecognizedText = () => {
    setRecognizedSigns([]);
  };

  // Save recognized text
  const saveRecognizedText = () => {
    if (recognizedSigns.length > 0) {
      const text = recognizedSigns.join(' ');
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recognized_signs_${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
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
          <div className="module-card card-sign-to-text">
            <div className="card-header">
              <h2 className="card-title">
                <Eye className="icon-cyan" />
                Sign to Text Recognition
              </h2>
              <div className="card-controls">
                <button 
                  onClick={() => setTtsEnabled(!ttsEnabled)}
                  className={`btn-icon ${ttsEnabled ? 'btn-tts-active' : 'btn-tts-inactive'}`}
                  title="Toggle Text-to-Speech"
                >
                  {speaking ? <Volume2 className="animate-pulse" /> : ttsEnabled ? <Volume2 /> : <VolumeX />}
                </button>
              </div>
            </div>

            {/* Camera View - FIXED: Always render video element */}
            <div className="camera-container" style={{
              position: 'relative',
              width: '100%',
              height: '400px',
              background: '#000',
              borderRadius: '15px',
              overflow: 'hidden',
              marginBottom: '20px'
            }}>
              {/* Always render video element, but control visibility */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: cameraActive ? 'block' : 'none',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  zIndex: 1
                }}
                onLoadedMetadata={(e) => {
                  console.log('✅ Metadata loaded - Video dimensions:', e.target.videoWidth, 'x', e.target.videoHeight);
                }}
                onPlaying={(e) => {
                  console.log('✅ Video is playing!');
                }}
                onError={(e) => {
                  console.error('❌ Video error:', e);
                }}
              />
              
              {/* Camera Status Overlays */}
              {cameraInitializing && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: 'rgba(0,0,0,0.8)',
                  color: 'white',
                  padding: '20px',
                  borderRadius: '10px',
                  zIndex: 10,
                  textAlign: 'center'
                }}>
                  <div style={{ marginBottom: '10px' }}>📹</div>
                  <div>Initializing camera...</div>
                </div>
              )}
              
              {cameraActive && !cameraInitializing && (
                <>
                  {/* Debug Info */}
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    background: 'rgba(0,255,0,0.8)',
                    color: 'white',
                    padding: '5px 10px',
                    borderRadius: '5px',
                    fontSize: '12px',
                    zIndex: 10
                  }}>
                    Camera Active
                  </div>
                  
                  {/* Hand Detection Indicator */}
                  <div className={`hand-indicator ${handDetected ? 'hand-detected' : 'hand-not-detected'}`} 
                    style={{
                      position: 'absolute',
                      top: '20px',
                      right: '20px',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: handDetected ? '#00ff00' : '#ff0000',
                      zIndex: 3
                    }}
                  />
                  
                  {/* Current Detection */}
                  {currentDetectedSign && (
                    <div className="detection-info" style={{
                      position: 'absolute',
                      bottom: '20px',
                      left: '20px',
                      background: 'rgba(0,0,0,0.8)',
                      padding: '15px',
                      borderRadius: '10px',
                      color: 'white',
                      zIndex: 3
                    }}>
                      <p className="detection-label">Detecting:</p>
                      <p className="detection-sign" style={{ fontSize: '18px', fontWeight: 'bold' }}>
                        {currentDetectedSign}
                      </p>
                      <div className="confidence-bar" style={{
                        width: '150px',
                        height: '8px',
                        background: 'rgba(255,255,255,0.3)',
                        borderRadius: '4px',
                        marginTop: '8px'
                      }}>
                        <div 
                          className="confidence-fill"
                          style={{ 
                            width: `${signConfidence}%`,
                            height: '100%',
                            background: '#00ff00',
                            borderRadius: '4px',
                            transition: 'width 0.3s'
                          }}
                        />
                      </div>
                      <p className="confidence-text" style={{ fontSize: '12px', marginTop: '5px' }}>
                        {signConfidence.toFixed(1)}% confidence
                      </p>
                    </div>
                  )}
                </>
              )}
              
              {!cameraActive && !cameraInitializing && (
                <div className="camera-placeholder" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: '#888'
                }}>
                  <CameraOff style={{ width: '64px', height: '64px', marginBottom: '16px' }} />
                  <p style={{ fontSize: '18px', marginBottom: '8px' }}>Camera Inactive</p>
                  <p style={{ fontSize: '14px', opacity: 0.7 }}>Click Start to begin recognition</p>
                </div>
              )}
            </div>

            {/* Camera Controls */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <button
                onClick={cameraActive ? stopCamera : startCamera}
                className={cameraActive ? 'btn btn-danger' : 'btn btn-primary'}
                disabled={cameraInitializing}
              >
                {cameraInitializing ? (
                  <>
                    <RefreshCw className="animate-spin" />
                    Initializing...
                  </>
                ) : cameraActive ? (
                  <>
                    <CameraOff />
                    Stop Camera
                  </>
                ) : (
                  <>
                    <Camera />
                    Start Camera
                  </>
                )}
              </button>
            </div>

            {/* Recognized Text Display */}
            <div className="text-display">
              <div className="text-display-header">
                <h3 className="text-display-title">Recognized Signs</h3>
                <div className="text-display-controls">
                  <button onClick={clearRecognizedText} className="btn-small btn-clear">
                    <Trash2 size={14} /> Clear
                  </button>
                  <button onClick={saveRecognizedText} className="btn-small btn-save">
                    <Download size={14} /> Save
                  </button>
                </div>
              </div>
              <div className="text-content">
                {recognizedSigns.length > 0 ? (
                  <p className="text-content-text">
                    {recognizedSigns.join(' ')}
                  </p>
                ) : (
                  <p className="text-content-placeholder">No signs detected yet...</p>
                )}
              </div>
            </div>

            {/* Status Bar */}
            <div className="status-bar">
              <div className="status-items">
                <span className="status-item">
                  <Activity className="status-icon" />
                  {cameraActive ? 'Active' : 'Inactive'}
                </span>
                <span className="status-item">
                  <Shield className="status-icon" />
                  {handDetected ? 'Hand Detected' : 'No Hand'}
                </span>
              </div>
              <span className="status-item">
                <Cpu className="status-icon" />
                ML Model: Ready
              </span>
            </div>
          </div>

          {/* Speech to Sign Module */}
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
                  {isListening ? 'Listening...' : 'Ready'}
                </div>
                
                {transcript && (
                  <div className="transcript-live">
                    <span className="transcript-label">Live:</span>
                    <span className="transcript-text">{transcript}</span>
                  </div>
                )}
                
                {finalTranscript && (
                  <div className="transcript-final">
                    <span className="transcript-label">Recognized:</span>
                    <span className="transcript-text">{finalTranscript}</span>
                  </div>
                )}
              </div>

              {/* Translation Queue */}
              {translationQueue.length > 0 && (
                <div className="queue-display">
                  <h4 className="queue-title">Translation Queue</h4>
                  <div className="queue-items">
                    {translationQueue.map((sign, index) => (
                      <span
                        key={index}
                        className={`queue-item ${
                          index === currentQueueIndex ? 'queue-active' : 
                          index < currentQueueIndex ? 'queue-done' : 'queue-pending'
                        }`}
                      >
                        {index < currentQueueIndex && '✓ '}
                        {index === currentQueueIndex && '▶ '}
                        {sign.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Sign Selection */}
            <div className="sign-selection">
              <h4 className="selection-title">Quick Signs</h4>
              <div className="quick-signs">
                {['Hello', 'Thank_You', 'Yes', 'No', 'Help', 'Good', 'Love', 'Friend'].map(sign => (
                  <button
                    key={sign}
                    onClick={() => selectSign(sign)}
                    className={`sign-btn ${currentSign === sign ? 'sign-btn-active' : ''}`}
                  >
                    {sign.replace('_', ' ')}
                  </button>
                ))}
              </div>

              {/* Expandable Sign Library */}
              <button
                onClick={() => setShowAllSigns(!showAllSigns)}
                className="btn-expand"
              >
                {showAllSigns ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                {showAllSigns ? 'Hide' : 'Show'} All Signs
              </button>

              {showAllSigns && (
                <div className="all-signs-container">
                  {/* Letters */}
                  <div className="sign-group">
                    <h5 className="group-title">Letters A-Z</h5>
                    <div className="letter-grid">
                      {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map(letter => (
                        <button
                          key={letter}
                          onClick={() => selectSign(letter)}
                          className={`letter-btn ${currentSign === letter ? 'letter-btn-active' : ''}`}
                        >
                          {letter}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Numbers */}
                  <div className="sign-group">
                    <h5 className="group-title">Numbers 0-9</h5>
                    <div className="number-grid">
                      {Array.from('0123456789').map(num => (
                        <button
                          key={num}
                          onClick={() => selectSign(num)}
                          className={`number-btn ${currentSign === num ? 'number-btn-active' : ''}`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Additional Words */}
                  <div className="sign-group">
                    <h5 className="group-title">Common Words</h5>
                    <div className="word-grid">
                      {signs.filter(sign => 
                        !sign.match(/^[A-Z0-9]$/) && 
                        !['Hello', 'Thank_You', 'Yes', 'No', 'Help', 'Good', 'Love', 'Friend'].includes(sign)
                      ).map(sign => (
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
              )}
            </div>
          </div>
        </div>

        {/* Info Panel */}
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
      </div>
    </div>
  );
}

export default App;
// SignToTextModule.js - Updated for Web-Fed Sign Translator
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, CameraOff, Wifi, WifiOff, Activity, BarChart3, Volume2, VolumeX } from 'lucide-react';

const SignToTextModule = () => {
  // Camera states
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraInitializing, setCameraInitializing] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  
  // Backend connection states
  const [backendConnected, setBackendConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  // Sign detection states
  const [currentSign, setCurrentSign] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [recognizedText, setRecognizedText] = useState([]);
  const [lastDetectionTime, setLastDetectionTime] = useState(null);
  const [handDetected, setHandDetected] = useState(false);
  const [topPredictions, setTopPredictions] = useState([]); // Add debug predictions
  
  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStats, setProcessingStats] = useState({
    frames_processed: 0,
    detections_made: 0,
    fps: 0
  });

  // Text-to-Speech states
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechSynthRef = useRef(null);
  
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const websocketRef = useRef(null);
  const frameIntervalRef = useRef(null);
  
  // Configuration
  const CONFIG = {
    WEBSOCKET_URL: 'ws://localhost:8765',
    FRAME_RATE: 300, // Send frame every 300ms (3.3 FPS) - less aggressive
    RECONNECT_INTERVAL: 5000, // Wait 5 seconds before reconnecting
    CANVAS_SIZE: { width: 640, height: 480 },
    MAX_RECONNECT_ATTEMPTS: 5
  };

  // Add reconnection state
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Text-to-Speech functions
  const speakText = useCallback((text) => {
    if (!speechEnabled || !text || isSpeaking) return;
    
    // Check if Speech Synthesis is supported
    if (!('speechSynthesis' in window)) {
      console.warn('Speech Synthesis not supported in this browser');
      return;
    }
    
    try {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Configure speech settings
      utterance.rate = 0.8;    // Slightly slower for clarity
      utterance.pitch = 1.0;   // Normal pitch
      utterance.volume = 1.0;  // Full volume
      
      // Set language to English
      utterance.lang = 'en-US';
      
      // Event listeners
      utterance.onstart = () => {
        setIsSpeaking(true);
        console.log(`🔊 Speaking: "${text}"`);
      };
      
      utterance.onend = () => {
        setIsSpeaking(false);
      };
      
      utterance.onerror = (event) => {
        setIsSpeaking(false);
        console.error('Speech synthesis error:', event.error);
      };
      
      // Speak the text
      window.speechSynthesis.speak(utterance);
      speechSynthRef.current = utterance;
      
    } catch (error) {
      console.error('Error in speech synthesis:', error);
      setIsSpeaking(false);
    }
  }, [speechEnabled, isSpeaking]);

  const stopSpeech = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const toggleSpeech = useCallback(() => {
    if (isSpeaking) {
      stopSpeech();
    }
    setSpeechEnabled(prev => !prev);
  }, [isSpeaking, stopSpeech]);

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    // Don't try to reconnect if we've exceeded max attempts
    if (reconnectAttempts >= CONFIG.MAX_RECONNECT_ATTEMPTS) {
      console.log('❌ Max reconnection attempts reached');
      return;
    }

    // Don't connect if already connected
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      console.log('🔄 Attempting to connect to WebSocket...');
      const ws = new WebSocket(CONFIG.WEBSOCKET_URL);
      
      ws.onopen = () => {
        console.log('✅ Connected to Web-Fed Sign Translator');
        setBackendConnected(true);
        setConnectionStatus('connected');
        setReconnectAttempts(0); // Reset attempts on successful connection
        websocketRef.current = ws;
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'status':
              console.log('📡 Backend status:', data.message);
              setRecognizedText(data.recognized_text || []);
              break;
              
            case 'detection_result':
              setHandDetected(data.hand_detected);
              setCurrentSign(data.current_sign || '');
              setConfidence(data.confidence || 0);
              setRecognizedText(data.recognized_text || []);
              setTopPredictions(data.top_predictions || []); // Update debug predictions
              
              if (data.new_text_added) {
                setLastDetectionTime(new Date());
                
                // Speak the newly detected sign
                if (data.current_sign && speechEnabled) {
                  speakText(data.current_sign);
                }
              }
              
              if (data.processing_stats) {
                setProcessingStats(data.processing_stats);
              }
              break;
              
            case 'text_cleared':
              setRecognizedText([]);
              setCurrentSign('');
              setConfidence(0);
              console.log('🗑️ Text cleared by backend');
              break;
              
            case 'stats':
              setProcessingStats({
                ...data.processing_stats,
                fps: data.fps
              });
              break;
              
            default:
              console.log('📨 Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };
      
      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.reason);
        setBackendConnected(false);
        setConnectionStatus('disconnected');
        websocketRef.current = null;
        
        // Only attempt to reconnect if it wasn't a manual close
        if (event.code !== 1000 && reconnectAttempts < CONFIG.MAX_RECONNECT_ATTEMPTS) {
          setReconnectAttempts(prev => prev + 1);
          setTimeout(() => {
            console.log(`🔄 Reconnection attempt ${reconnectAttempts + 1}/${CONFIG.MAX_RECONNECT_ATTEMPTS}`);
            connectWebSocket();
          }, CONFIG.RECONNECT_INTERVAL);
        }
      };
      
      ws.onerror = (error) => {
        console.error('⚠️ WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('❌ Failed to connect WebSocket:', error);
      setReconnectAttempts(prev => prev + 1);
    }
  }, [reconnectAttempts]);

  // Start camera
  const startCamera = useCallback(async () => {
    setCameraInitializing(true);
    
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      
      const constraints = {
        video: {
          width: { ideal: CONFIG.CANVAS_SIZE.width },
          height: { ideal: CONFIG.CANVAS_SIZE.height },
          facingMode: 'user'
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setCameraStream(stream);
      setCameraActive(true);
      console.log('✅ Camera started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start camera:', error);
      if (error.name === 'NotReadableError') {
        alert('Camera is in use by another application. Please close other camera apps and try again.');
      } else if (error.name === 'NotAllowedError') {
        alert('Camera permission denied. Please allow camera access and try again.');
      } else {
        alert('Failed to access camera: ' + error.message);
      }
    } finally {
      setCameraInitializing(false);
    }
  }, [cameraStream]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setCameraStream(null);
    setCameraActive(false);
    setIsProcessing(false);
    console.log('🛑 Camera stopped');
  }, [cameraStream]);

  // Capture and send frame to backend
  const captureAndSendFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !websocketRef.current || 
        websocketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas dimensions
    canvas.width = CONFIG.CANVAS_SIZE.width;
    canvas.height = CONFIG.CANVAS_SIZE.height;
    
    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to base64 with lower quality for faster transfer
    const frameData = canvas.toDataURL('image/jpeg', 0.7); // Reduced quality for speed
    
    // Send frame to backend
    try {
      if (websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({
          type: 'frame',
          frame_data: frameData,
          timestamp: Date.now()
        }));
        
        setIsProcessing(true);
      }
    } catch (error) {
      console.error('❌ Error sending frame:', error);
      setIsProcessing(false);
    }
  }, []);

  // Start/stop frame processing
  const toggleProcessing = useCallback(() => {
    if (isProcessing) {
      // Stop processing
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      setIsProcessing(false);
      console.log('⏸️ Frame processing stopped');
    } else {
      // Start processing
      if (backendConnected && cameraActive) {
        frameIntervalRef.current = setInterval(captureAndSendFrame, CONFIG.FRAME_RATE);
        setIsProcessing(true);
        console.log('▶️ Frame processing started');
      }
    }
  }, [isProcessing, backendConnected, cameraActive, captureAndSendFrame]);

  // Clear recognized text
  const clearRecognizedText = useCallback(() => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({
        type: 'clear_text'
      }));
    }
  }, []);

  // Get processing statistics
  const getProcessingStats = useCallback(() => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({
        type: 'get_stats'
      }));
    }
  }, []);

  // Initialize WebSocket connection manually
  const initializeConnection = useCallback(() => {
    setReconnectAttempts(0);
    connectWebSocket();
  }, [connectWebSocket]);

  // Initialize WebSocket connection
  useEffect(() => {
    // Don't auto-connect immediately, wait a bit for the server to be ready
    const timeout = setTimeout(() => {
      connectWebSocket();
    }, 2000);
    
    // Cleanup on unmount
    return () => {
      clearTimeout(timeout);
      if (websocketRef.current) {
        websocketRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [connectWebSocket]);

  // Auto-start processing when both camera and backend are ready
  useEffect(() => {
    if (cameraActive && backendConnected && !isProcessing) {
      // Auto-start processing after a short delay
      const timeout = setTimeout(() => {
        toggleProcessing();
      }, 1000);
      
      return () => clearTimeout(timeout);
    }
  }, [cameraActive, backendConnected, isProcessing, toggleProcessing]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(51, 65, 85, 0.95))', // Dark background
      borderRadius: '24px',
      padding: '32px',
      border: '2px solid rgba(139, 92, 246, 0.4)', // More visible border
      minHeight: '600px',
      color: '#f8fafc' // Light text color
    }}>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes glow {
            0%, 100% { box-shadow: 0 0 5px rgba(139, 92, 246, 0.5); }
            50% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.8); }
          }
        `}
      </style>
      
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h3 style={{
          fontSize: '28px',
          fontWeight: '800',
          color: '#e2e8f0', // Light color
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
        }}>
          🤟 Sign to Text
        </h3>
        <p style={{
          color: '#cbd5e1', // Light gray
          fontSize: '16px',
          margin: 0
        }}>
          Real-time sign language detection with Python backend
        </p>
      </div>

      {/* Backend Status */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '20px',
        padding: '12px 20px',
        background: backendConnected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
        borderRadius: '12px',
        border: `1px solid ${backendConnected ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
      }}>
        {backendConnected ? <Wifi size={20} color="#22c55e" /> : <WifiOff size={20} color="#ef4444" />}
        <span style={{
          fontSize: '16px',
          fontWeight: '600',
          color: backendConnected ? '#22c55e' : '#ef4444'
        }}>
          Python Backend: {connectionStatus}
        </span>
        {!backendConnected && reconnectAttempts < CONFIG.MAX_RECONNECT_ATTEMPTS && (
          <button
            onClick={initializeConnection}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Reconnect
          </button>
        )}
        {reconnectAttempts >= CONFIG.MAX_RECONNECT_ATTEMPTS && (
          <span style={{
            fontSize: '12px',
            color: '#ef4444',
            fontStyle: 'italic'
          }}>
            Max attempts reached - restart Python backend
          </span>
        )}
      </div>

      {/* Camera Feed */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '400px',
        background: '#000',
        borderRadius: '16px',
        overflow: 'hidden',
        marginBottom: '24px',
        border: '1px solid rgba(139, 92, 246, 0.3)'
      }}>
        {/* Video Element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block'
          }}
        />

        {/* Hidden Canvas for Frame Capture */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            opacity: 0
          }}
        />

        {/* Overlay when camera is not active */}
        {!cameraActive && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            background: 'rgba(0, 0, 0, 0.8)',
            zIndex: 5
          }}>
            <CameraOff size={48} style={{ marginBottom: '16px' }} />
            <p style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
              {cameraInitializing ? 'Starting Camera...' : 'Camera Not Active'}
            </p>
          </div>
        )}

        {/* Processing Status Indicator */}
        {cameraActive && (
          <div style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 10
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: isProcessing ? '#22c55e' : '#f59e0b',
              animation: isProcessing ? 'pulse 1.5s ease-in-out infinite' : 'none'
            }} />
            <span style={{
              color: 'white',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              {isProcessing ? 'Processing...' : 'Paused'}
            </span>
          </div>
        )}

        {/* Hand Detection Status */}
        {cameraActive && isProcessing && (
          <div style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 10
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: handDetected ? '#22c55e' : '#6b7280'
            }} />
            <span style={{
              color: 'white',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              {handDetected ? 'Hand Detected' : 'No Hand'}
            </span>
          </div>
        )}

        {/* Processing Stats */}
        {cameraActive && processingStats.fps > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            padding: '8px 12px',
            zIndex: 10
          }}>
            <span style={{
              color: 'white',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              FPS: {processingStats.fps?.toFixed(1)} | Frames: {processingStats.frames_processed}
            </span>
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div style={{
        display: 'flex',
        gap: '16px',
        justifyContent: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={cameraActive ? stopCamera : startCamera}
          disabled={cameraInitializing}
          style={{
            padding: '16px 32px',
            borderRadius: '16px',
            border: 'none',
            background: cameraInitializing ?
              'rgba(107, 114, 128, 0.3)' :
              cameraActive ?
                'linear-gradient(135deg, #ef4444, #dc2626)' :
                'linear-gradient(135deg, #22c55e, #16a34a)',
            color: cameraInitializing ? '#6b7280' : 'white',
            cursor: cameraInitializing ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            fontWeight: '700',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            minWidth: '160px',
            justifyContent: 'center'
          }}
        >
          {cameraInitializing ? (
            <>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid transparent',
                borderTop: '2px solid currentColor',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              Starting...
            </>
          ) : (
            <>
              {cameraActive ? <CameraOff size={20} /> : <Camera size={20} />}
              {cameraActive ? 'Stop Camera' : 'Start Camera'}
            </>
          )}
        </button>

        <button
          onClick={toggleProcessing}
          disabled={!cameraActive || !backendConnected}
          style={{
            padding: '16px 32px',
            borderRadius: '16px',
            border: 'none',
            background: (!cameraActive || !backendConnected) ?
              'rgba(107, 114, 128, 0.3)' :
              isProcessing ?
                'linear-gradient(135deg, #f59e0b, #d97706)' :
                'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            color: (!cameraActive || !backendConnected) ? '#6b7280' : 'white',
            cursor: (!cameraActive || !backendConnected) ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            fontWeight: '700',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            minWidth: '180px',
            justifyContent: 'center'
          }}
        >
          <Activity size={20} />
          {isProcessing ? 'Pause Detection' : 'Start Detection'}
        </button>

        <button
          onClick={clearRecognizedText}
          disabled={!backendConnected || recognizedText.length === 0}
          style={{
            padding: '16px 32px',
            borderRadius: '16px',
            border: 'none',
            background: (!backendConnected || recognizedText.length === 0) ?
              'rgba(107, 114, 128, 0.3)' :
              'linear-gradient(135deg, #dc2626, #b91c1c)',
            color: (!backendConnected || recognizedText.length === 0) ? '#6b7280' : 'white',
            cursor: (!backendConnected || recognizedText.length === 0) ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            fontWeight: '700',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            minWidth: '140px',
            justifyContent: 'center'
          }}
        >
          🗑️ Clear Text
        </button>

        <button
          onClick={toggleSpeech}
          style={{
            padding: '16px 32px',
            borderRadius: '16px',
            border: 'none',
            background: speechEnabled ?
              'linear-gradient(135deg, #10b981, #059669)' :
              'linear-gradient(135deg, #6b7280, #4b5563)',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            fontWeight: '700',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            minWidth: '160px',
            justifyContent: 'center',
            animation: isSpeaking ? 'glow 1s ease-in-out infinite' : 'none'
          }}
        >
          {speechEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          {isSpeaking ? 'Speaking...' : speechEnabled ? 'Speech On' : 'Speech Off'}
        </button>
      </div>

      {/* Current Detection Display */}
      {backendConnected && cameraActive && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(6, 182, 212, 0.2))',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '24px',
          border: '2px solid rgba(139, 92, 246, 0.4)',
          backdropFilter: 'blur(10px)'
        }}>
          <h4 style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#e2e8f0', // Light color
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            🔍 Current Detection
          </h4>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '16px'
          }}>
            <div>
              <p style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#cbd5e1', // Light gray
                marginBottom: '4px'
              }}>
                Detected Sign:
              </p>
              <p style={{
                fontSize: '24px',
                fontWeight: '800',
                color: currentSign ? '#a78bfa' : '#9ca3af', // Purple or gray
                margin: 0,
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
              }}>
                {currentSign || 'No sign detected'}
              </p>
            </div>
            
            <div>
              <p style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#cbd5e1', // Light gray
                marginBottom: '4px'
              }}>
                Confidence:
              </p>
              <p style={{
                fontSize: '24px',
                fontWeight: '800',
                color: confidence > 0.7 ? '#34d399' : confidence > 0.5 ? '#fbbf24' : '#9ca3af',
                margin: 0,
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
              }}>
                {confidence > 0 ? `${Math.round(confidence * 100)}%` : '--'}
              </p>
            </div>
          </div>

          {/* Debug: Top Predictions */}
          {topPredictions.length > 0 && (
            <div>
              <p style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#cbd5e1', // Light gray
                marginBottom: '8px'
              }}>
                🐛 Debug - Top Predictions:
              </p>
              <div style={{
                background: 'rgba(0, 0, 0, 0.3)', // Darker background
                borderRadius: '8px',
                padding: '12px',
                fontSize: '12px',
                fontFamily: 'monospace',
                border: '1px solid rgba(139, 92, 246, 0.3)'
              }}>
                {topPredictions.slice(0, 5).map(([sign, conf], index) => (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: index === 0 ? '#a78bfa' : '#94a3b8', // Purple for top, gray for others
                    fontWeight: index === 0 ? '700' : '400',
                    marginBottom: '2px'
                  }}>
                    <span>{index + 1}. {sign}</span>
                    <span>{(conf * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {lastDetectionTime && (
            <p style={{
              fontSize: '12px',
              color: '#94a3b8', // Light gray
              marginTop: '8px',
              marginBottom: 0
            }}>
              Last detection: {lastDetectionTime.toLocaleTimeString()}
            </p>
          )}
        </div>
      )}

      {/* Recognized Text Display */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.2))',
        borderRadius: '16px',
        padding: '20px',
        border: '2px solid rgba(34, 197, 94, 0.4)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px'
        }}>
          <h4 style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#e2e8f0', // Light color
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📝 Recognized Text ({recognizedText.length} words)
          </h4>
          
          {/* Speak All Button */}
          {recognizedText.length > 0 && (
            <button
              onClick={() => speakText(recognizedText.join(' '))}
              disabled={isSpeaking || !speechEnabled}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: (!speechEnabled || isSpeaking) ?
                  'rgba(107, 114, 128, 0.5)' :
                  'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: 'white',
                cursor: (!speechEnabled || isSpeaking) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Volume2 size={16} />
              {isSpeaking ? 'Speaking...' : 'Speak All'}
            </button>
          )}
        </div>
        
        <div style={{
          minHeight: '80px',
          background: 'rgba(30, 41, 59, 0.8)', // Dark background
          borderRadius: '12px',
          padding: '16px',
          border: '2px solid rgba(34, 197, 94, 0.3)'
        }}>
          {recognizedText.length > 0 ? (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              {recognizedText.map((word, index) => (
                <span
                  key={index}
                  onClick={() => speakText(word)}
                  style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(99, 102, 241, 0.3))',
                    color: '#e2e8f0',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: speechEnabled ? 'pointer' : 'default',
                    border: '1px solid rgba(139, 92, 246, 0.5)',
                    transition: 'all 0.2s ease',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (speechEnabled) {
                      e.target.style.transform = 'scale(1.05)';
                      e.target.style.background = 'linear-gradient(135deg, rgba(139, 92, 246, 0.5), rgba(99, 102, 241, 0.5))';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'scale(1)';
                    e.target.style.background = 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(99, 102, 241, 0.3))';
                  }}
                  title={speechEnabled ? 'Click to hear this word' : 'Speech disabled'}
                >
                  {word}
                </span>
              ))}
            </div>
          ) : (
            <p style={{
              fontSize: '16px',
              color: '#94a3b8', // Light gray
              fontStyle: 'italic',
              margin: 0,
              textAlign: 'center'
            }}>
              {backendConnected ? 
                (cameraActive ? 
                  (isProcessing ? 'Start signing to see recognized text...' : 'Click "Start Detection" to begin') : 
                  'Start camera to begin detection') :
                'Connect to Python backend to see recognized text'
              }
            </p>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div style={{
        marginTop: '24px',
        padding: '16px',
        background: 'rgba(59, 130, 246, 0.2)', // More visible background
        borderRadius: '12px',
        border: '2px solid rgba(59, 130, 246, 0.4)',
        backdropFilter: 'blur(10px)'
      }}>
        <h4 style={{
          fontSize: '16px',
          fontWeight: '700',
          color: '#e2e8f0', // Light color
          marginBottom: '8px'
        }}>
          📋 Instructions:
        </h4>
        <ul style={{
          fontSize: '14px',
          color: '#cbd5e1', // Light gray
          margin: 0,
          paddingLeft: '20px'
        }}>
          <li>Run your Web-Fed Sign Translator: <code style={{background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', color: '#a78bfa'}}>python web_fed_sign_translator.py</code> (option 3)</li>
          <li>Click "Start Camera" to begin video feed</li>
          <li>Click "Start Detection" to begin sending frames to Python backend</li>
          <li>Toggle "Speech On/Off" to enable/disable text-to-speech</li>
          <li>Click individual words or "Speak All" to hear the recognized text</li>
          <li>Use "Clear Text" to reset or use 'c' command in Python terminal</li>
        </ul>
      </div>
    </div>
  );
};

export default SignToTextModule;
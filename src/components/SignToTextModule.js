// src/components/SignToTextModule.js - Enhanced Sign recognition functionality
import React, { useState, useRef, useEffect } from 'react';
import { 
  Eye, Volume2, VolumeX, Camera, CameraOff, 
  Activity, Shield, Cpu, Save, Trash2, Download,
  Settings, RefreshCw, Play, Pause
} from 'lucide-react';

const SignToTextModule = () => {
  // States
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraInitializing, setCameraInitializing] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [currentDetectedSign, setCurrentDetectedSign] = useState('');
  const [signConfidence, setSignConfidence] = useState(0);
  const [recognizedSigns, setRecognizedSigns] = useState([]);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [detectionActive, setDetectionActive] = useState(true);
  const [signHistory, setSignHistory] = useState([]);
  const [currentSession, setCurrentSession] = useState('');
  
  // Refs
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const canvasRef = useRef(null);

  // Enhanced sign detection signs
  const detectionSigns = [
    'HELLO', 'THANK_YOU', 'YES', 'NO', 'PLEASE', 'SORRY', 'GOOD', 'BAD',
    'HELP', 'LOVE', 'FRIEND', 'FAMILY', 'WATER', 'EAT', 'DRINK', 'MORE',
    'FINISH', 'WORK', 'HOME', 'SCHOOL', 'HAPPY', 'SAD', 'ANGRY', 'TIRED'
  ];

  // Enhanced camera startup
  const startCamera = async () => {
    console.log('=== CAMERA START INITIATED ===');
    setCameraInitializing(true);
    
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
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30, min: 15 }
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Stream obtained successfully!');
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Wait for video to load
        videoRef.current.onloadedmetadata = () => {
          setCameraActive(true);
          setCameraInitializing(false);
          if (detectionActive) {
            startDetection();
          }
        };
      }
    } catch (error) {
      console.error('❌ Camera access failed:', error);
      
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
    console.log('=== STOPPING CAMERA ===');
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    stopDetection();
    setCameraActive(false);
    setHandDetected(false);
    setCurrentDetectedSign('');
  };

  // Enhanced detection simulation (replace with actual ML model)
  const startDetection = () => {
    console.log('🔍 Starting sign detection...');
    
    detectionIntervalRef.current = setInterval(() => {
      if (cameraActive && detectionActive && Math.random() > 0.4) {
        const sign = detectionSigns[Math.floor(Math.random() * detectionSigns.length)];
        const confidence = Math.floor(75 + Math.random() * 25); // 75-100% confidence
        
        setHandDetected(true);
        setCurrentDetectedSign(sign);
        setSignConfidence(confidence);
        
        // Add to history for better tracking
        setSignHistory(prev => [...prev.slice(-10), {
          sign,
          confidence,
          timestamp: new Date().toLocaleTimeString()
        }]);
        
        // Only add to recognized signs if confidence is high enough
        if (confidence > 85) {
          const formattedSign = sign.replace('_', ' ');
          setRecognizedSigns(prev => {
            const newSigns = [...prev, formattedSign];
            
            // Update current session
            setCurrentSession(newSigns.join(' '));
            
            // Text-to-speech if enabled
            if (ttsEnabled) {
              speak(formattedSign);
            }
            
            return newSigns;
          });
        }
        
        // Reset detection display after delay
        setTimeout(() => {
          setHandDetected(false);
          setCurrentDetectedSign('');
          setSignConfidence(0);
        }, 2000);
      }
    }, 2500); // Slightly slower for better UX
  };

  const stopDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  };

  // Enhanced text-to-speech
  const speak = (text) => {
    if ('speechSynthesis' in window && ttsEnabled) {
      // Stop any current speech
      speechSynthesis.cancel();
      
      setSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(text.toLowerCase());
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;
      
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      
      speechSynthesis.speak(utterance);
    }
  };

  // Enhanced utility functions
  const clearRecognizedText = () => {
    setRecognizedSigns([]);
    setCurrentSession('');
    setSignHistory([]);
  };

  const saveRecognizedText = () => {
    if (recognizedSigns.length > 0) {
      const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_');
      const content = `Sign Language Recognition Session - ${timestamp}\n\nRecognized Text:\n${recognizedSigns.join(' ')}\n\nDetection History:\n${signHistory.map(h => `${h.timestamp}: ${h.sign} (${h.confidence}%)`).join('\n')}`;
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sign_recognition_${timestamp}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const toggleDetection = () => {
    setDetectionActive(!detectionActive);
    if (!detectionActive && cameraActive) {
      startDetection();
    } else {
      stopDetection();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="module-card card-sign-to-text">
      <div className="card-header">
        <h2 className="card-title">
          <Eye className="icon-cyan" />
          Sign to Text Recognition
        </h2>
        <div className="card-controls">
          <button 
            onClick={toggleDetection}
            className={`btn-icon ${detectionActive ? 'btn-detection-active' : 'btn-detection-inactive'}`}
            title="Toggle Detection"
            disabled={!cameraActive}
          >
            {detectionActive ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button 
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={`btn-icon ${ttsEnabled ? 'btn-tts-active' : 'btn-tts-inactive'}`}
            title="Toggle Text-to-Speech"
          >
            {speaking ? <Volume2 className="animate-pulse" size={16} /> : ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
      </div>

      {/* Enhanced Camera View */}
      <div className="camera-container" style={{
        position: 'relative',
        width: '100%',
        height: '400px',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        borderRadius: '20px',
        overflow: 'hidden',
        marginBottom: '20px',
        border: '2px solid rgba(6, 182, 212, 0.3)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Video Element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: cameraActive ? 'block' : 'none'
          }}
        />

        {/* Camera Overlay Elements */}
        {cameraActive && (
          <>
            {/* Hand Detection Indicator */}
            <div 
              className={`hand-indicator ${handDetected ? 'hand-detected' : 'hand-not-detected'}`}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: handDetected ? '#22c55e' : '#ef4444',
                boxShadow: handDetected ? '0 0 20px #22c55e' : '0 0 20px #ef4444',
                zIndex: 3,
                animation: handDetected ? 'pulse 1s infinite' : 'none'
              }}
            />

            {/* Detection Status */}
            <div style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              background: 'rgba(0, 0, 0, 0.8)',
              padding: '12px 16px',
              borderRadius: '12px',
              color: 'white',
              fontSize: '14px',
              zIndex: 3,
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: detectionActive ? '#22c55e' : '#ef4444',
                  animation: detectionActive ? 'pulse 2s infinite' : 'none'
                }} />
                {detectionActive ? 'Detection Active' : 'Detection Paused'}
              </div>
            </div>
            
            {/* Current Detection Display */}
            {currentDetectedSign && (
              <div style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                background: 'rgba(0, 0, 0, 0.9)',
                padding: '20px',
                borderRadius: '16px',
                color: 'white',
                zIndex: 3,
                backdropFilter: 'blur(15px)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{ marginBottom: '8px', fontSize: '12px', color: '#9ca3af' }}>
                  Detecting:
                </div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px' }}>
                  {currentDetectedSign.replace('_', ' ')}
                </div>
                
                {/* Enhanced Confidence Bar */}
                <div style={{
                  width: '180px',
                  height: '6px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '3px',
                  marginBottom: '8px',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    width: `${signConfidence}%`,
                    height: '100%',
                    background: signConfidence > 85 ? '#22c55e' : signConfidence > 70 ? '#f59e0b' : '#ef4444',
                    borderRadius: '3px',
                    transition: 'all 0.3s ease-in-out'
                  }} />
                </div>
                
                <div style={{ fontSize: '12px', color: '#d1d5db' }}>
                  {signConfidence}% confidence
                </div>
              </div>
            )}

            {/* Corner UI Elements */}
            <div style={{
              position: 'absolute',
              top: '15px',
              left: '15px',
              width: '20px',
              height: '20px',
              border: '3px solid rgba(6, 182, 212, 0.8)',
              borderRight: 'none',
              borderBottom: 'none',
              borderRadius: '4px 0 0 0'
            }} />
            <div style={{
              position: 'absolute',
              top: '15px',
              right: '15px',
              width: '20px',
              height: '20px',
              border: '3px solid rgba(6, 182, 212, 0.8)',
              borderLeft: 'none',
              borderBottom: 'none',
              borderRadius: '0 4px 0 0'
            }} />
            <div style={{
              position: 'absolute',
              bottom: '15px',
              left: '15px',
              width: '20px',
              height: '20px',
              border: '3px solid rgba(6, 182, 212, 0.8)',
              borderRight: 'none',
              borderTop: 'none',
              borderRadius: '0 0 0 4px'
            }} />
            <div style={{
              position: 'absolute',
              bottom: '15px',
              right: '15px',
              width: '20px',
              height: '20px',
              border: '3px solid rgba(6, 182, 212, 0.8)',
              borderLeft: 'none',
              borderTop: 'none',
              borderRadius: '0 0 4px 0'
            }} />
          </>
        )}

        {/* Camera Placeholder */}
        {!cameraActive && !cameraInitializing && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#9ca3af'
          }}>
            <CameraOff style={{ width: '64px', height: '64px', marginBottom: '16px', color: '#6b7280' }} />
            <p style={{ fontSize: '18px', marginBottom: '8px', fontWeight: '500' }}>Camera Inactive</p>
            <p style={{ fontSize: '14px', opacity: 0.7 }}>Click "Start Camera" to begin recognition</p>
          </div>
        )}

        {/* Loading State */}
        {cameraInitializing && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#06b6d4'
          }}>
            <Activity style={{ width: '48px', height: '48px', marginBottom: '16px' }} className="animate-spin" />
            <p style={{ fontSize: '16px', fontWeight: '500' }}>Starting Camera...</p>
          </div>
        )}
      </div>

      {/* Enhanced Camera Controls */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          onClick={cameraActive ? stopCamera : startCamera}
          disabled={cameraInitializing}
          className={`btn-camera ${cameraActive ? 'btn-camera-active' : 'btn-camera-inactive'}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            borderRadius: '12px',
            border: 'none',
            fontSize: '14px',
            fontWeight: '500',
            cursor: cameraInitializing ? 'not-allowed' : 'pointer',
            background: cameraActive ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #06b6d4, #0891b2)',
            color: 'white',
            transition: 'all 0.3s ease',
            opacity: cameraInitializing ? 0.5 : 1
          }}
        >
          {cameraInitializing ? (
            <Activity size={16} className="animate-spin" />
          ) : cameraActive ? (
            <CameraOff size={16} />
          ) : (
            <Camera size={16} />
          )}
          {cameraInitializing ? 'Starting...' : cameraActive ? 'Stop Camera' : 'Start Camera'}
        </button>

        {cameraActive && (
          <button
            onClick={toggleDetection}
            className={`btn-detection ${detectionActive ? 'btn-detection-active' : 'btn-detection-inactive'}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              borderRadius: '12px',
              border: 'none',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              background: detectionActive ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'linear-gradient(135deg, #6b7280, #4b5563)',
              color: 'white',
              transition: 'all 0.3s ease'
            }}
          >
            {detectionActive ? <Pause size={16} /> : <Play size={16} />}
            {detectionActive ? 'Pause Detection' : 'Resume Detection'}
          </button>
        )}
      </div>

      {/* Enhanced Recognition Output */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '20px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>
            Recognized Text
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={saveRecognizedText}
              disabled={recognizedSigns.length === 0}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                background: recognizedSigns.length > 0 ? 'rgba(6, 182, 212, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                color: recognizedSigns.length > 0 ? '#06b6d4' : '#6b7280',
                cursor: recognizedSigns.length > 0 ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s ease'
              }}
              title="Save Text"
            >
              <Save size={16} />
            </button>
            <button
              onClick={clearRecognizedText}
              disabled={recognizedSigns.length === 0}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                background: recognizedSigns.length > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                color: recognizedSigns.length > 0 ? '#ef4444' : '#6b7280',
                cursor: recognizedSigns.length > 0 ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s ease'
              }}
              title="Clear Text"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        
        <div style={{
          minHeight: '80px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          padding: '16px',
          color: recognizedSigns.length > 0 ? 'white' : '#9ca3af',
          fontSize: '16px',
          lineHeight: '1.6',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          {recognizedSigns.length > 0 ? (
            <p style={{ margin: 0 }}>{recognizedSigns.join(' ')}</p>
          ) : (
            <p style={{ margin: 0, fontStyle: 'italic' }}>
              Start the camera and show signs to see recognized text here...
            </p>
          )}
        </div>

        {/* Word Count */}
        {recognizedSigns.length > 0 && (
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#9ca3af' }}>
            Words recognized: {recognizedSigns.length}
          </div>
        )}
      </div>

      {/* Enhanced Status Indicators */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '16px',
        padding: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} style={{ color: cameraActive ? '#22c55e' : '#ef4444' }} />
            <span style={{ color: '#d1d5db', fontSize: '14px' }}>
              Camera: {cameraActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={16} style={{ color: handDetected ? '#22c55e' : '#6b7280' }} />
            <span style={{ color: '#d1d5db', fontSize: '14px' }}>
              {handDetected ? 'Hand Detected' : 'No Hand'}
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={16} style={{ color: '#06b6d4' }} />
            <span style={{ color: '#d1d5db', fontSize: '14px' }}>
              AI Model: Ready
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignToTextModule;
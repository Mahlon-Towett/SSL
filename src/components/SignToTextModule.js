// SignToTextModule.js - Part 1: Component Logic and Functions
import React, { useState, useRef, useEffect } from 'react';
import { 
  Eye, Volume2, VolumeX, Camera, CameraOff, 
  Activity, Shield, Cpu, Save, Trash2, Download,
  Settings, RefreshCw, Play, Pause, Wifi, WifiOff,
  AlertCircle, CheckCircle
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
  const [apiConnected, setApiConnected] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');
  
  // Refs
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const canvasRef = useRef(null);

  // API Configuration
  const API_BASE_URL = 'http://localhost:5000/api';

  // Debug logger
  const debugLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setDebugInfo(prev => prev + '\n' + logMessage);
  };

  // Check API health on component mount
  useEffect(() => {
    debugLog('Component mounted, checking API health...');
    checkApiHealth();
    getModelInfo();
  }, []);

  const checkApiHealth = async () => {
    try {
      debugLog('Attempting to connect to Flask API...');
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();
      
      debugLog(`API Response: ${JSON.stringify(data)}`);
      
      if (data.status === 'healthy' && data.detector_loaded) {
        setApiConnected(true);
        setApiError(null);
        debugLog('✅ API connected successfully');
      } else {
        throw new Error('API detector not loaded');
      }
    } catch (error) {
      debugLog(`❌ API connection failed: ${error.message}`);
      setApiConnected(false);
      setApiError('Failed to connect to Flask API. Please ensure the server is running on port 5000.');
    }
  };

  const getModelInfo = async () => {
    try {
      debugLog('Fetching model information...');
      const response = await fetch(`${API_BASE_URL}/model-info`);
      const data = await response.json();
      
      if (data.success) {
        setModelInfo(data);
        debugLog(`📊 Model info loaded: ${data.total_signs} signs supported`);
      }
    } catch (error) {
      debugLog(`Failed to get model info: ${error.message}`);
    }
  };

  // Enhanced camera startup
  const startCamera = async () => {
    debugLog('=== CAMERA START INITIATED ===');
    setCameraInitializing(true);
    
    if (!apiConnected) {
      alert('API not connected. Please ensure the Flask server is running on port 5000.');
      setCameraInitializing(false);
      return;
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      debugLog('❌ getUserMedia is not supported in this browser');
      alert('Camera API not supported in this browser');
      setCameraInitializing(false);
      return;
    }
    
    try {
      debugLog('🎥 Requesting camera access...');
      const constraints = {
        video: {
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 },
          facingMode: 'user',
          frameRate: { ideal: 30, min: 15 }
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      debugLog('✅ Stream obtained successfully!');
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Wait for video to load
        videoRef.current.onloadedmetadata = () => {
          debugLog(`Video loaded: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
          setCameraActive(true);
          setCameraInitializing(false);
          
          // Start detection after a small delay to ensure state updates
          setTimeout(() => {
            if (detectionActive) {
              debugLog('🕐 Starting detection after camera state update...');
              startDetection();
            }
          }, 100);
        };
      }
    } catch (error) {
      debugLog(`❌ Camera access failed: ${error.message}`);
      
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
    debugLog('=== STOPPING CAMERA ===');
    
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

  // Capture frame from video and send to API
  const captureAndDetect = async () => {
    debugLog('🎯 captureAndDetect called');
    
    if (!videoRef.current) {
      debugLog('❌ videoRef.current is null');
      return;
    }
    
    if (!apiConnected) {
      debugLog('❌ API not connected');
      return;
    }
    
    debugLog('✅ Prerequisites met, proceeding with capture');

    try {
      debugLog('📸 Starting frame capture...');
      
      // Check video element properties
      const video = videoRef.current;
      debugLog(`📺 Video element - readyState: ${video.readyState}, videoWidth: ${video.videoWidth}, videoHeight: ${video.videoHeight}`);
      debugLog(`📺 Video element - currentTime: ${video.currentTime}, paused: ${video.paused}, ended: ${video.ended}`);
      
      if (video.readyState < 2) {
        debugLog('⚠️ Video not ready yet (readyState < 2)');
        return;
      }
      
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        debugLog('⚠️ Video dimensions are 0');
        return;
      }
      
      // Create canvas to capture frame
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
        debugLog('🎨 Created new canvas element');
      }
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      debugLog(`🎨 Canvas dimensions set to: ${canvas.width}x${canvas.height}`);
      
      // Draw current video frame to canvas
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        debugLog('✅ Frame drawn to canvas successfully');
      } catch (drawError) {
        debugLog(`❌ Error drawing to canvas: ${drawError.message}`);
        return;
      }
      
      // Convert to base64
      let imageData;
      try {
        imageData = canvas.toDataURL('image/jpeg', 0.8);
        debugLog(`📊 Image data length: ${imageData.length} characters`);
        debugLog(`📊 Image data starts with: ${imageData.substring(0, 50)}...`);
      } catch (dataError) {
        debugLog(`❌ Error converting to base64: ${dataError.message}`);
        return;
      }
      
      // Send to API
      debugLog('🚀 Sending frame to Flask API...');
      debugLog(`🌐 API URL: ${API_BASE_URL}/detect-sign-base64`);
      
      const requestBody = { image: imageData };
      debugLog(`📤 Request body size: ${JSON.stringify(requestBody).length} characters`);
      
      const response = await fetch(`${API_BASE_URL}/detect-sign-base64`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      debugLog(`📥 Response status: ${response.status} ${response.statusText}`);
      debugLog(`📥 Response headers: ${JSON.stringify([...response.headers.entries()])}`);
      
      if (!response.ok) {
        debugLog(`❌ HTTP error: ${response.status}`);
        const errorText = await response.text();
        debugLog(`❌ Error response body: ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      debugLog(`📋 API Response: ${JSON.stringify(result)}`);
      
      if (result.success) {
        // Update UI with detection results
        setHandDetected(result.hand_detected);
        debugLog(`👋 Hand detected: ${result.hand_detected}`);
        
        if (result.hand_detected && result.sign) {
          setCurrentDetectedSign(result.sign);
          // Remove confidence display by not setting signConfidence
          debugLog(`🎯 Sign detected: ${result.sign}`);
          
          // Add to history without confidence
          setSignHistory(prev => [...prev.slice(-10), {
            sign: result.sign,
            timestamp: new Date().toLocaleTimeString()
          }]);
          
          // Add to recognized signs if confidence is high enough for real-time functionality
          if (result.confidence > 0.70) {
            const formattedSign = result.sign.replace('_', ' ');
            debugLog(`🔊 Real-time sign detected: ${formattedSign}`);
            
            // Always speak immediately for real-time functionality
            if (ttsEnabled) {
              speak(formattedSign);
            }
            
            // Only add to permanent text if it's a new sign (to avoid repetition in text)
            if (result.new_sign_added) {
              debugLog(`➕ Adding new sign to permanent text: ${formattedSign}`);
              setRecognizedSigns(prev => {
                const newSigns = [...prev, formattedSign];
                setCurrentSession(newSigns.join(' '));
                return newSigns;
              });
            }
          }
        } else {
          debugLog('👋 No hand detected or no sign recognized');
          // Reset detection display after delay
          setTimeout(() => {
            setHandDetected(false);
            setCurrentDetectedSign('');
            setSignConfidence(0);
          }, 1500);
        }
      } else {
        debugLog(`❌ API detection failed: ${result.error}`);
        setApiError(result.error);
      }
    } catch (error) {
      debugLog(`❌ Detection error: ${error.message}`);
      debugLog(`❌ Error stack: ${error.stack}`);
      setApiError('Detection failed. Please check API connection.');
    }
  };

  // Real-time detection using Flask API
  const startDetection = () => {
    debugLog('🔍 Starting real-time sign detection with Flask API...');
    debugLog(`🔄 Detection interval: 2000ms`);
    
    detectionIntervalRef.current = setInterval(() => {
      debugLog('⏰ Detection interval triggered');
      
      // Check actual video state instead of React state
      const isVideoReady = videoRef.current && 
                          videoRef.current.readyState >= 2 && 
                          videoRef.current.videoWidth > 0 && 
                          videoRef.current.videoHeight > 0;
      
      debugLog(`📊 Status check:`);
      debugLog(`   - videoReady: ${isVideoReady}`);
      debugLog(`   - detectionActive: ${detectionActive}`);
      debugLog(`   - apiConnected: ${apiConnected}`);
      debugLog(`   - cameraActive (React state): ${cameraActive}`);
      
      if (isVideoReady && detectionActive && apiConnected) {
        debugLog('✅ All conditions met, calling captureAndDetect');
        captureAndDetect();
      } else {
        debugLog('⚠️ Conditions not met for detection');
      }
    }, 2000); // Detect every 2 seconds for better performance
    
    debugLog(`🎯 Detection interval started with ID: ${detectionIntervalRef.current}`);
  };

  const stopDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
      debugLog('🛑 Detection stopped');
    }
  };

  // Enhanced text-to-speech with better voice and animation
  const speak = (text) => {
    if ('speechSynthesis' in window && ttsEnabled) {
      // Stop any current speech
      speechSynthesis.cancel();
      
      setSpeaking(true);
      debugLog(`🔊 Speaking: "${text}"`);
      
      const utterance = new SpeechSynthesisUtterance(text.toLowerCase());
      
      // Enhanced voice settings for better clarity
      utterance.rate = 0.8;
      utterance.pitch = 1.1;
      utterance.volume = 0.9;
      
      // Try to use a more natural voice if available
      const voices = speechSynthesis.getVoices();
      const preferredVoices = voices.filter(voice => 
        voice.name.includes('Google') || 
        voice.name.includes('Microsoft') || 
        voice.name.includes('Natural') ||
        voice.lang.startsWith('en')
      );
      
      if (preferredVoices.length > 0) {
        utterance.voice = preferredVoices[0];
        debugLog(`🎙️ Using voice: ${utterance.voice.name}`);
      }
      
      utterance.onstart = () => {
        debugLog('🔊 Speech started');
        setSpeaking(true);
      };
      
      utterance.onend = () => {
        debugLog('🔇 Speech ended');
        setSpeaking(false);
      };
      
      utterance.onerror = (error) => {
        debugLog(`❌ Speech error: ${error.error}`);
        setSpeaking(false);
      };
      
      speechSynthesis.speak(utterance);
    }
  };

  // API utility functions
  const clearRecognizedText = async () => {
    try {
      debugLog('Clearing recognized text...');
      const response = await fetch(`${API_BASE_URL}/clear-recognized-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        setRecognizedSigns([]);
        setCurrentSession('');
        setSignHistory([]);
        debugLog('✅ Recognized text cleared');
      }
    } catch (error) {
      debugLog(`Failed to clear recognized text: ${error.message}`);
    }
    
    // Also clear local state
    setRecognizedSigns([]);
    setCurrentSession('');
    setSignHistory([]);
  };

  const saveRecognizedText = () => {
    if (recognizedSigns.length > 0) {
      const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_');
      const content = `Sign Language Recognition Session - ${timestamp}\n\nRecognized Text:\n${recognizedSigns.join(' ')}\n\nDetection History:\n${signHistory.map(h => `${h.timestamp}: ${h.sign} (${h.confidence}%)`).join('\n')}\n\nDebug Log:\n${debugInfo}`;
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sign_recognition_${timestamp}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      debugLog('💾 Session saved to file');
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

  // PART 1 ENDS HERE - Continue with Part 2
  return (
<div style={{
      background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(14, 165, 233, 0.12), rgba(59, 130, 246, 0.08))',
      border: '1px solid rgba(6, 182, 212, 0.25)',
      borderRadius: '28px',
      padding: '32px',
      backdropFilter: 'blur(25px)',
      position: 'relative',
      overflow: 'hidden',
      maxWidth: '1400px',
      margin: '0 auto',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1), 0 0 80px rgba(6, 182, 212, 0.05)',
      WebkitBackdropFilter: 'blur(25px)'
    }}>
      
      {/* Add CSS animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        @keyframes wave {
          0% { height: 5px; }
          100% { height: 20px; }
        }
        
        @keyframes glow {
          0%, 100% { 
            text-shadow: 0 0 5px rgba(6, 182, 212, 0.3);
          }
          50% { 
            text-shadow: 0 0 20px rgba(6, 182, 212, 0.6), 0 0 30px rgba(6, 182, 212, 0.4);
          }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <h2 style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          color: 'white',
          fontSize: '28px',
          fontWeight: '700',
          margin: 0,
          textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
            borderRadius: '12px',
            padding: '8px',
            animation: 'float 3s ease-in-out infinite'
          }}>
            <Eye size={32} style={{ color: 'white' }} />
          </div>
          <span style={{
            background: 'linear-gradient(135deg, #06b6d4, #0891b2, #3b82f6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            AI Sign Language Recognition
          </span>
        </h2>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* API Status Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            borderRadius: '16px',
            background: apiConnected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            border: `1px solid ${apiConnected ? '#22c55e' : '#ef4444'}`,
            boxShadow: apiConnected ? '0 4px 12px rgba(34, 197, 94, 0.2)' : '0 4px 12px rgba(239, 68, 68, 0.2)'
          }}>
            {apiConnected ? <CheckCircle size={18} style={{ color: '#22c55e' }} /> : <AlertCircle size={18} style={{ color: '#ef4444' }} />}
            <span style={{ color: apiConnected ? '#22c55e' : '#ef4444', fontSize: '14px', fontWeight: '600' }}>
              {apiConnected ? 'AI Ready' : 'AI Offline'}
            </span>
          </div>

          {/* Camera Control */}
          <button 
            onClick={cameraActive ? stopCamera : startCamera}
            disabled={cameraInitializing || !apiConnected}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 24px',
              borderRadius: '16px',
              border: 'none',
              fontSize: '15px',
              fontWeight: '600',
              cursor: (cameraInitializing || !apiConnected) ? 'not-allowed' : 'pointer',
              background: cameraActive ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #06b6d4, #0891b2)',
              color: 'white',
              transition: 'all 0.3s ease',
              opacity: (cameraInitializing || !apiConnected) ? 0.5 : 1,
              boxShadow: cameraActive ? '0 4px 12px rgba(239, 68, 68, 0.3)' : '0 4px 12px rgba(6, 182, 212, 0.3)'
            }}
          >
            {cameraInitializing ? (
              <Activity size={18} className="animate-spin" />
            ) : cameraActive ? (
              <CameraOff size={18} />
            ) : (
              <Camera size={18} />
            )}
            {cameraInitializing ? 'Initializing...' : cameraActive ? 'Stop Camera' : 'Start Camera'}
          </button>

          {/* Detection Toggle */}
          {cameraActive && (
            <button
              onClick={toggleDetection}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '14px 24px',
                borderRadius: '16px',
                border: 'none',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                background: detectionActive ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'linear-gradient(135deg, #6b7280, #4b5563)',
                color: 'white',
                transition: 'all 0.3s ease',
                boxShadow: detectionActive ? '0 4px 12px rgba(34, 197, 94, 0.3)' : '0 4px 12px rgba(107, 114, 128, 0.3)'
              }}
            >
              {detectionActive ? <Pause size={18} /> : <Play size={18} />}
              {detectionActive ? 'Pause Detection' : 'Resume Detection'}
            </button>
          )}

          {/* Retry API Button */}
          {!apiConnected && (
            <button
              onClick={checkApiHealth}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '14px 24px',
                borderRadius: '16px',
                border: 'none',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: 'white',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
              }}
            >
              <RefreshCw size={18} />
              Retry Connection
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {apiError && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
        }}>
          <AlertCircle size={24} style={{ color: '#ef4444' }} />
          <span style={{ color: '#ef4444', fontSize: '15px', fontWeight: '500', flex: 1 }}>{apiError}</span>
          <button
            onClick={checkApiHealth}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              background: '#ef4444',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* VERTICAL LAYOUT - Video on Top, Information Below */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Video Feed Section */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{ position: 'relative', maxWidth: '700px', width: '100%' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                maxWidth: '700px',
                height: 'auto',
                aspectRatio: '4/3',
                borderRadius: '20px',
                background: cameraActive ? 'transparent' : 'linear-gradient(135deg, #1f2937, #374151)',
                objectFit: 'cover',
                border: '3px solid rgba(6, 182, 212, 0.4)',
                boxShadow: '0 12px 24px rgba(0, 0, 0, 0.2), 0 0 40px rgba(6, 182, 212, 0.1)',
                transition: 'all 0.3s ease'
              }}
            />
            
            {/* Video Overlay */}
            {!cameraActive && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.8)',
                borderRadius: '20px',
                color: 'white'
              }}>
                <Camera size={64} style={{ color: '#6b7280', marginBottom: '16px', animation: 'float 3s ease-in-out infinite' }} />
                <p style={{ fontSize: '18px', color: '#9ca3af', textAlign: 'center', margin: 0, fontWeight: '500' }}>
                  {!apiConnected ? 'Connect to AI first' : 'Click "Start Camera" to begin recognition'}
                </p>
              </div>
            )}

            {/* Current Detection Overlay - Enhanced */}
            {currentDetectedSign && cameraActive && (
              <div style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                right: '20px',
                background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(30, 30, 30, 0.95))',
                padding: '24px',
                borderRadius: '20px',
                color: 'white',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
                transform: speaking ? 'scale(1.02)' : 'scale(1)',
                transition: 'all 0.3s ease'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '16px',
                  marginBottom: '12px' 
                }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: '#22c55e',
                    animation: 'pulse 2s infinite',
                    boxShadow: '0 0 12px rgba(34, 197, 94, 0.6)'
                  }} />
                  <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: '600' }}>
                    Recognized Sign
                  </span>
                  {speaking && (
                    <div style={{
                      marginLeft: 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#22c55e',
                      fontSize: '13px',
                      fontWeight: '600',
                      background: 'rgba(34, 197, 94, 0.1)',
                      padding: '6px 12px',
                      borderRadius: '12px',
                      border: '1px solid rgba(34, 197, 94, 0.3)'
                    }}>
                      <Volume2 size={16} />
                      <span>Speaking...</span>
                    </div>
                  )}
                </div>
                
                <div style={{ 
                  fontSize: '28px', 
                  fontWeight: 'bold', 
                  marginBottom: '12px',
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  {currentDetectedSign.replace('_', ' ')}
                </div>
                
                {/* Animated wave pattern when speaking */}
                {speaking && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    marginTop: '16px',
                    justifyContent: 'center'
                  }}>
                    {[...Array(25)].map((_, i) => (
                      <div
                        key={i}
                        style={{
                          width: '4px',
                          height: `${Math.random() * 25 + 8}px`,
                          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                          borderRadius: '2px',
                          animation: `wave 1.2s infinite ${i * 0.04}s ease-in-out alternate`
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Status Indicators */}
            <div style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                background: 'rgba(0, 0, 0, 0.8)',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: detectionActive ? '#22c55e' : '#ef4444',
                  animation: detectionActive ? 'pulse 2s infinite' : 'none',
                  boxShadow: detectionActive ? '0 0 8px rgba(34, 197, 94, 0.6)' : '0 0 8px rgba(239, 68, 68, 0.6)'
                }} />
                <span style={{ color: 'white' }}>
                  {detectionActive ? 'Detecting' : 'Paused'}
                </span>
              </div>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                background: 'rgba(0, 0, 0, 0.8)',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)'
              }}>
                <Shield size={14} style={{ color: handDetected ? '#22c55e' : '#6b7280' }} />
                <span style={{ color: 'white' }}>
                  {handDetected ? 'Hand Detected' : 'No Sign'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Information Grid - Below Video */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', 
          gap: '28px' 
        }}>
          
          {/* Recognized Text Display - Enhanced */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.4), rgba(30, 30, 30, 0.4))',
            borderRadius: '24px',
            padding: '28px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
            backdropFilter: 'blur(25px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ 
                color: 'white', 
                fontSize: '22px', 
                fontWeight: '700', 
                margin: 0,
                background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                Recognized Speech
              </h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setTtsEnabled(!ttsEnabled)}
                  style={{
                    padding: '12px',
                    borderRadius: '14px',
                    border: 'none',
                    background: ttsEnabled ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'rgba(107, 114, 128, 0.3)',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    transform: speaking ? 'scale(1.1)' : 'scale(1)',
                    boxShadow: speaking ? '0 6px 16px rgba(34, 197, 94, 0.4)' : ttsEnabled ? '0 4px 12px rgba(34, 197, 94, 0.3)' : 'none'
                  }}
                  title={ttsEnabled ? 'Disable Text-to-Speech' : 'Enable Text-to-Speech'}
                >
                  {ttsEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button>
                <button
                  onClick={saveRecognizedText}
                  disabled={recognizedSigns.length === 0}
                  style={{
                    padding: '12px',
                    borderRadius: '14px',
                    border: 'none',
                    background: recognizedSigns.length > 0 ? 'linear-gradient(135deg, #06b6d4, #0891b2)' : 'rgba(107, 114, 128, 0.3)',
                    color: 'white',
                    cursor: recognizedSigns.length > 0 ? 'pointer' : 'not-allowed',
                    transition: 'all 0.3s ease',
                    opacity: recognizedSigns.length > 0 ? 1 : 0.5,
                    boxShadow: recognizedSigns.length > 0 ? '0 4px 12px rgba(6, 182, 212, 0.3)' : 'none'
                  }}
                  title="Save Session"
                >
                  <Save size={20} />
                </button>
                <button
                  onClick={clearRecognizedText}
                  disabled={recognizedSigns.length === 0}
                  style={{
                    padding: '12px',
                    borderRadius: '14px',
                    border: 'none',
                    background: recognizedSigns.length > 0 ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'rgba(107, 114, 128, 0.3)',
                    color: 'white',
                    cursor: recognizedSigns.length > 0 ? 'pointer' : 'not-allowed',
                    transition: 'all 0.3s ease',
                    opacity: recognizedSigns.length > 0 ? 1 : 0.5,
                    boxShadow: recognizedSigns.length > 0 ? '0 4px 12px rgba(239, 68, 68, 0.3)' : 'none'
                  }}
                  title="Clear Text"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
            
            <div style={{
              minHeight: '100px',
              padding: '24px',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03))',
              borderRadius: '18px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'white',
              fontSize: '20px',
              lineHeight: '1.6',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: currentSession ? 'flex-start' : 'center',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {currentSession ? (
                <span style={{ 
                  animation: speaking ? 'glow 2s infinite ease-in-out' : 'none',
                  textShadow: speaking ? '0 0 10px rgba(6, 182, 212, 0.5)' : 'none'
                }}>
                  {currentSession}
                </span>
              ) : (
                <span style={{ 
                  color: '#9ca3af', 
                  fontStyle: 'italic',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  fontSize: '18px'
                }}>
                  <Eye size={28} style={{ opacity: 0.5, animation: 'float 3s ease-in-out infinite' }} />
                  Show your hand signs to see text appear here...
                </span>
              )}
              
              {/* Speaking indicator overlay */}
              {speaking && currentSession && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'rgba(34, 197, 94, 0.2)',
                  border: '1px solid #22c55e',
                  borderRadius: '24px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  color: '#22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  animation: 'pulse 2s infinite',
                  fontWeight: '600'
                }}>
                  <Volume2 size={16} />
                  Speaking
                </div>
              )}
            </div>
          </div>

          {/* Model Info */}
          {modelInfo && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.4), rgba(30, 30, 30, 0.4))',
              borderRadius: '24px',
              padding: '28px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
              backdropFilter: 'blur(25px)'
            }}>
              <h4 style={{ 
                color: 'white', 
                fontSize: '20px', 
                fontWeight: '700', 
                marginBottom: '20px',
                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                AI Model Information
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', fontSize: '16px' }}>
                <div style={{ 
                  padding: '16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <span style={{ color: '#9ca3af', fontWeight: '600' }}>Model Type:</span>
                  <span style={{ color: 'white', marginLeft: '12px', fontWeight: '700' }}>{modelInfo.model_type}</span>
                </div>
                <div style={{ 
                  padding: '16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <span style={{ color: '#9ca3af', fontWeight: '600' }}>Signs Supported:</span>
                  <span style={{ color: 'white', marginLeft: '12px', fontWeight: '700' }}>{modelInfo.total_signs}</span>
                </div>
              </div>
              
              {/* Supported Signs List */}
              <div style={{ marginTop: '20px' }}>
                <span style={{ color: '#9ca3af', fontSize: '16px', fontWeight: '600' }}>Available Signs:</span>
                <div style={{
                  marginTop: '12px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  {modelInfo.signs_supported?.slice(0, 8).map((sign, index) => (
                    <span
                      key={index}
                      style={{
                        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.2))',
                        color: '#06b6d4',
                        padding: '8px 16px',
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: '700',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        animation: 'float 3s ease-in-out infinite',
                        animationDelay: `${index * 0.2}s`
                      }}
                    >
                      {sign.replace('_', ' ')}
                    </span>
                  ))}
                  {modelInfo.signs_supported?.length > 8 && (
                    <span style={{
                      color: '#9ca3af',
                      fontSize: '14px',
                      padding: '8px 16px',
                      background: 'rgba(107, 114, 128, 0.2)',
                      borderRadius: '10px',
                      border: '1px solid rgba(107, 114, 128, 0.3)',
                      fontWeight: '600'
                    }}>
                      +{modelInfo.signs_supported.length - 8} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* System Status */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.4), rgba(30, 30, 30, 0.4))',
            borderRadius: '24px',
            padding: '28px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
            backdropFilter: 'blur(25px)',
            gridColumn: modelInfo ? 'auto' : 'span 2'
          }}>
            <h4 style={{ 
              color: 'white', 
              fontSize: '20px', 
              fontWeight: '700', 
              marginBottom: '24px',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              System Status
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '16px',
                padding: '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: apiConnected ? '#22c55e' : '#ef4444',
                  animation: apiConnected ? 'pulse 2s infinite' : 'none',
                  boxShadow: apiConnected ? '0 0 12px rgba(34, 197, 94, 0.5)' : '0 0 12px rgba(239, 68, 68, 0.5)'
                }} />
                <span style={{ color: '#d1d5db', fontSize: '16px', fontWeight: '600' }}>
                  Flask API: {apiConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '16px',
                padding: '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: cameraActive ? '#22c55e' : '#6b7280',
                  animation: cameraActive ? 'pulse 2s infinite' : 'none',
                  boxShadow: cameraActive ? '0 0 12px rgba(34, 197, 94, 0.5)' : 'none'
                }} />
                <span style={{ color: '#d1d5db', fontSize: '16px', fontWeight: '600' }}>
                  Camera: {cameraActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '16px',
                padding: '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                  borderRadius: '8px',
                  padding: '6px'
                }}>
                  <Cpu size={16} style={{ color: 'white' }} />
                </div>
                <span style={{ color: '#d1d5db', fontSize: '16px', fontWeight: '600' }}>
                  Detection: {detectionActive ? 'Running' : 'Paused'}
                </span>
              </div>

              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '16px',
                padding: '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <span style={{ color: '#9ca3af', fontSize: '16px', fontWeight: '600' }}>
                  Signs Recognized: </span>
                <span style={{ 
                  color: '#22c55e', 
                  fontSize: '16px', 
                  fontWeight: '700',
                  background: 'rgba(34, 197, 94, 0.1)',
                  padding: '6px 12px',
                  borderRadius: '8px'
                }}>
                  {recognizedSigns.length}
                </span>
              </div>

              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '16px',
                padding: '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <span style={{ color: '#9ca3af', fontSize: '16px', fontWeight: '600' }}>
                  Last Detection: </span>
                <span style={{ color: '#06b6d4', fontSize: '16px', fontWeight: '700' }}>
                  {signHistory.length > 0 ? signHistory[signHistory.length - 1].timestamp : 'None'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignToTextModule;
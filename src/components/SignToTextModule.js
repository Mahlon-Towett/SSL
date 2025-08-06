// SignToTextModule.js - REVERTED to original styling with optimized detection
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, CameraOff, Hand } from 'lucide-react';

// OPTIMIZED Detection Manager Hook - Only the logic is optimized, no styling changes
const useDetectionManager = (debugMode = false) => {
  const [detectionStatus, setDetectionStatus] = useState('inactive');
  const [apiConnected, setApiConnected] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [currentSign, setCurrentSign] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [detectionError, setDetectionError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const canvasRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const lastProcessTime = useRef(0);

  // OPTIMIZED CONFIG - Much faster detection
  const CONFIG = {
    API_BASE_URL: 'http://localhost:5000',
    DETECTION_INTERVAL: 150,    // ✅ 5x FASTER: 150ms instead of 800ms
    MIN_CONFIDENCE: 0.7,        // ✅ Match sign_translator.py exactly
    DETECTION_TIMEOUT: 3000,    // ✅ Faster timeout
    MAX_FRAME_WIDTH: 640,
    MAX_FRAME_HEIGHT: 480,
    JPEG_QUALITY: 0.8,
    SKIP_PROCESSING_IF_BUSY: true,
    ENABLE_DEBUG_LOGS: false
  };

  const debugLog = useCallback((message, data = null, level = 'info') => {
    if (CONFIG.ENABLE_DEBUG_LOGS && (debugMode || level === 'error')) {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] Detection: ${message}`, data || '');
    }
  }, [debugMode, CONFIG.ENABLE_DEBUG_LOGS]);

  const testApiConnection = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/health`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        setApiConnected(true);
        setDetectionError('');
        return true;
      } else {
        throw new Error(`API returned ${response.status}`);
      }
    } catch (error) {
      setApiConnected(false);
      setDetectionError('API connection failed');
      return false;
    }
  }, [CONFIG.API_BASE_URL]);

  const captureFrame = useCallback((videoElement) => {
    if (!videoElement || !canvasRef.current) return null;

    try {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      const width = Math.min(videoElement.videoWidth, CONFIG.MAX_FRAME_WIDTH);
      const height = Math.min(videoElement.videoHeight, CONFIG.MAX_FRAME_HEIGHT);
      
      canvas.width = width;
      canvas.height = height;
      context.drawImage(videoElement, 0, 0, width, height);
      
      return new Promise(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', CONFIG.JPEG_QUALITY);
      });
    } catch (error) {
      return null;
    }
  }, [CONFIG.MAX_FRAME_WIDTH, CONFIG.MAX_FRAME_HEIGHT, CONFIG.JPEG_QUALITY]);

  const sendDetectionRequest = useCallback(async (blob) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.DETECTION_TIMEOUT);
    
    try {
      const formData = new FormData();
      formData.append('image', blob, `frame_${Date.now()}.jpg`);
      
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/detect-sign`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }, [CONFIG.API_BASE_URL, CONFIG.DETECTION_TIMEOUT]);

  const processDetectionResult = useCallback((result) => {
    try {
      const handPresent = result.hand_detected || false;
      setHandDetected(handPresent);
      
      if (handPresent && result.sign && result.confidence >= CONFIG.MIN_CONFIDENCE) {
        setCurrentSign(result.sign);
        setConfidence(parseFloat(result.confidence));
      } else if (handPresent) {
        setCurrentSign('');
        setConfidence(result.confidence || 0);
      } else {
        setCurrentSign('');
        setConfidence(0);
      }
    } catch (error) {
      debugLog('❌ Error processing result:', error, 'error');
    }
  }, [CONFIG.MIN_CONFIDENCE, debugLog]);

  const detectFromVideo = useCallback(async (videoElement) => {
    if (CONFIG.SKIP_PROCESSING_IF_BUSY && isProcessing) return;
    if (!videoElement || detectionStatus !== 'active') return;
    
    const currentTime = Date.now();
    if (currentTime - lastProcessTime.current < CONFIG.DETECTION_INTERVAL) {
      return;
    }
    lastProcessTime.current = currentTime;
    
    setIsProcessing(true);
    
    try {
      if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) return;
      
      const blob = await captureFrame(videoElement);
      if (!blob) return;
      
      const result = await sendDetectionRequest(blob);
      processDetectionResult(result);
    } catch (error) {
      if (error.name !== 'AbortError') {
        setDetectionError(`Detection error: ${error.message}`);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, detectionStatus, captureFrame, sendDetectionRequest, processDetectionResult, CONFIG]);

  const startDetection = useCallback(async (videoElement) => {
    try {
      if (detectionStatus === 'active') return;
      if (!videoElement) throw new Error('Video element required');
      
      if (!apiConnected) {
        const connected = await testApiConnection();
        if (!connected) throw new Error('API connection failed');
      }
      
      setDetectionStatus('active');
      setDetectionError('');
      
      // OPTIMIZED: Much faster interval!
      detectionIntervalRef.current = setInterval(() => {
        detectFromVideo(videoElement);
      }, CONFIG.DETECTION_INTERVAL);
      
    } catch (error) {
      setDetectionStatus('error');
      setDetectionError(`Failed to start: ${error.message}`);
    }
  }, [detectionStatus, apiConnected, testApiConnection, detectFromVideo, CONFIG.DETECTION_INTERVAL]);

  const stopDetection = useCallback(() => {
    setDetectionStatus('inactive');
    
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    
    setHandDetected(false);
    setCurrentSign('');
    setConfidence(0);
    setIsProcessing(false);
    setDetectionError('');
  }, []);

  const initialize = useCallback(async () => {
    await testApiConnection();
  }, [testApiConnection]);

  return {
    canvasRef,
    detectionStatus,
    apiConnected,
    handDetected,
    currentSign,
    confidence,
    detectionError,
    isProcessing,
    initialize,
    startDetection,
    stopDetection,
    testApiConnection,
    isActive: detectionStatus === 'active',
    hasError: detectionStatus === 'error'
  };
};

// Main Component with ORIGINAL styling
const SignToTextModule = () => {
  // States
  const [cameraStatus, setCameraStatus] = useState('inactive');
  const [videoReady, setVideoReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [recognizedSigns, setRecognizedSigns] = useState([]);
  const [currentSession, setCurrentSession] = useState('');

  // Refs
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Use optimized detection manager
  const detection = useDetectionManager(false);

  // Derived states
  const cameraActive = cameraStatus === 'active';
  const cameraInitializing = cameraStatus === 'initializing';
  const detectionActive = detection.isActive;

  // Initialize detection manager
  useEffect(() => {
    detection.initialize();
  }, [detection]);

  // Handle camera initialization
  const initializeCamera = useCallback(async () => {
    try {
      setCameraStatus('initializing');
      setCameraError('');

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera not supported');
      }

      const constraints = {
        video: {
          width: { ideal: 640, max: 800 },
          height: { ideal: 480, max: 600 },
          facingMode: 'user',
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }

      setTimeout(() => {
        if (videoRef.current && videoRef.current.videoWidth > 0) {
          setVideoReady(true);
          setCameraStatus('active');
        } else {
          setCameraError('Video failed to display');
          setCameraStatus('error');
        }
      }, 1000);

    } catch (error) {
      setCameraStatus('error');
      setCameraError(error.message);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraStatus('inactive');
    setVideoReady(false);
    setCameraError('');
  }, []);

  // Handle sign detection updates
  useEffect(() => {
    if (detection.currentSign && detection.confidence > 0.7) {
      setRecognizedSigns(prev => {
        if (prev.length === 0 || prev[prev.length - 1] !== detection.currentSign) {
          const newSigns = [...prev, detection.currentSign];
          setCurrentSession(newSigns.join(' '));
          return newSigns;
        }
        return prev;
      });
    }
  }, [detection.currentSign, detection.confidence]);

  return (
    <div>
      {/* Camera Section - ORIGINAL styling preserved */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.4), rgba(30, 30, 30, 0.4))',
        borderRadius: '24px',
        padding: '32px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
        marginBottom: '32px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <h3 style={{
            color: 'white',
            fontSize: '24px',
            fontWeight: '700',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Camera size={28} style={{ color: '#8b5cf6' }} />
            Camera & Detection
            <span style={{
              background: 'rgba(34, 197, 94, 0.2)',
              color: '#4ade80',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              ⚡ 6.7 FPS (150ms intervals)
            </span>
          </h3>
        </div>

        {/* Camera Container - ORIGINAL styling */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '400px',
          background: '#000',
          borderRadius: '20px',
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

          {/* Hidden Canvas for Detection */}
          <canvas
            ref={detection.canvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              opacity: 0
            }}
          />

          {/* Overlay when not active */}
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
                {cameraInitializing ? 'Initializing Camera...' : 'Camera Not Active'}
              </p>
            </div>
          )}

          {/* Hand Detection Indicator - ORIGINAL styling */}
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
                background: detection.handDetected ? '#22c55e' : '#6b7280',
                boxShadow: detection.handDetected ? '0 0 20px rgba(34, 197, 94, 0.6)' : 'none'
              }} />
              <span style={{
                color: 'white',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                {detection.handDetected ? 
                  `${detection.currentSign || 'Detecting...'} ${detection.confidence > 0 ? `(${Math.round(detection.confidence * 100)}%)` : ''}` : 
                  'No Hand Detected'
                }
              </span>
            </div>
          )}

          {/* Detection Status Indicator - ORIGINAL styling */}
          {cameraActive && (
            <div style={{
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              background: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(10px)',
              borderRadius: '12px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              zIndex: 10
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: detectionActive ? '#22c55e' : '#f59e0b',
                animation: detectionActive ? 'pulse 1.5s ease-in-out infinite' : 'none'
              }} />
              <span style={{ color: 'white', fontSize: '12px', fontWeight: '600' }}>
                Detection: {detectionActive ? 'Active' : 'Inactive'}
                {detection.isProcessing && ' • Processing...'}
              </span>
            </div>
          )}
        </div>

        {/* Control Buttons - ORIGINAL styling */}
        <div style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={cameraActive ? stopCamera : initializeCamera}
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
            onClick={detectionActive ? detection.stopDetection : () => detection.startDetection(videoRef.current)}
            disabled={!cameraActive || !detection.apiConnected}
            style={{
              padding: '16px 32px',
              borderRadius: '16px',
              border: 'none',
              background: (!cameraActive || !detection.apiConnected) ?
                'rgba(107, 114, 128, 0.3)' :
                detectionActive ?
                  'linear-gradient(135deg, #f59e0b, #d97706)' :
                  'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              color: (!cameraActive || !detection.apiConnected) ? '#6b7280' : 'white',
              cursor: (!cameraActive || !detection.apiConnected) ? 'not-allowed' : 'pointer',
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
            <Hand size={20} />
            {detectionActive ? 'Stop Detection' : 'Start Detection'}
          </button>
        </div>
      </div>

      {/* Recognized Text Section - ORIGINAL styling */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.4), rgba(30, 30, 30, 0.4))',
        borderRadius: '24px',
        padding: '32px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <h3 style={{
            color: 'white',
            fontSize: '24px',
            fontWeight: '700',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Hand size={28} style={{ color: '#06b6d4' }} />
            Recognized Signs
            {recognizedSigns.length > 0 && (
              <span style={{
                background: 'rgba(6, 182, 212, 0.2)',
                color: '#67e8f9',
                padding: '6px 12px',
                borderRadius: '16px',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                {recognizedSigns.length} signs
              </span>
            )}
          </h3>
          
          <button
            onClick={() => {
              setRecognizedSigns([]);
              setCurrentSession('');
            }}
            style={{
              padding: '12px 20px',
              borderRadius: '14px',
              border: 'none',
              background: 'rgba(107, 114, 128, 0.3)',
              color: '#d1d5db',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Clear Text
          </button>
        </div>
        
        <div style={{
          minHeight: '120px',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          {currentSession ? (
            <p style={{
              color: 'white',
              fontSize: '20px',
              lineHeight: '1.6',
              margin: 0,
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              {currentSession}
            </p>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#6b7280',
              textAlign: 'center'
            }}>
              <Hand size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <p style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                Start signing to see recognized text here
              </p>
              <p style={{ fontSize: '14px', margin: '8px 0 0 0', opacity: 0.8 }}>
                Camera and detection must both be active
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Debug Info - ORIGINAL styling */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '16px',
        padding: '20px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        marginTop: '24px'
      }}>
        <h4 style={{ color: 'white', margin: '0 0 12px 0' }}>Debug Info:</h4>
        <div style={{ color: '#94a3b8', fontSize: '14px', fontFamily: 'monospace' }}>
          <div>Camera: {cameraStatus} | Video Ready: {videoReady.toString()}</div>
          <div>Detection: {detection.detectionStatus} | API: {detection.apiConnected.toString()}</div>
          <div>Hand: {detection.handDetected.toString()} | Processing: {detection.isProcessing.toString()}</div>
          <div>Current Sign: {detection.currentSign || 'None'} | Confidence: {detection.confidence.toFixed(3)}</div>
          <div>⚡ Optimizations: 150ms intervals, 0.7 confidence threshold, 640x480 max frames</div>
          {videoRef.current && (
            <div>Video: {videoRef.current.videoWidth}x{videoRef.current.videoHeight} | Ready State: {videoRef.current.readyState}</div>
          )}
        </div>
      </div>

      {/* CSS Animations - inline styles preserved */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default SignToTextModule;
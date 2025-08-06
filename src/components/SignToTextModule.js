import React, { useState, useEffect } from 'react';
import { Camera, CameraOff, Hand, Activity } from 'lucide-react';

// Camera Manager Hook
const useCameraManager = (debugMode = true) => {
  const [cameraStatus, setCameraStatus] = useState('inactive');
  const [videoReady, setVideoReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);

  const debugLog = React.useCallback((message, data = null, level = 'info') => {
    if (debugMode || level === 'error') {
      const timestamp = new Date().toLocaleTimeString();
      const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '📝';
      console.log(`[${timestamp}] ${prefix} Camera: ${message}`, data || '');
    }
  }, [debugMode]);

  const initializeCamera = React.useCallback(async () => {
    try {
      debugLog('🎥 Starting camera initialization...');
      setCameraStatus('initializing');
      setCameraError('');
      setVideoReady(false);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      debugLog('📹 Getting media stream...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          facingMode: 'user' 
        },
        audio: false
      });

      debugLog('✅ Stream obtained');
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        throw new Error('Video element not found');
      }

      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;

      debugLog('🔗 Assigning stream...');
      video.srcObject = stream;

      try {
        await video.play();
        debugLog('🎬 Video play started');
      } catch (playError) {
        debugLog('⚠️ Play failed but continuing:', playError, 'warn');
      }

      setTimeout(() => {
        debugLog(`📊 Video state: readyState=${video.readyState}, dimensions=${video.videoWidth}x${video.videoHeight}, paused=${video.paused}`);
        
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          debugLog('✅ Camera ready!');
          setVideoReady(true);
          setCameraStatus('active');
        } else {
          debugLog('❌ Video dimensions still zero');
          setCameraError('Video failed to display');
          setCameraStatus('error');
        }
      }, 1500);

    } catch (error) {
      debugLog('❌ Camera init failed:', error, 'error');
      setCameraStatus('error');
      setCameraError(error.message);
    }
  }, [debugLog]);

  const stopCamera = React.useCallback(() => {
    debugLog('🛑 Stopping camera');
    
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
  }, [debugLog]);

  return {
    videoRef,
    cameraStatus,
    videoReady,
    cameraError,
    initializeCamera,
    stopCamera,
    isActive: cameraStatus === 'active',
    isInitializing: cameraStatus === 'initializing'
  };
};

// Detection Manager Hook
const useDetectionManager = (debugMode = true) => {
  const [detectionStatus, setDetectionStatus] = useState('inactive');
  const [apiConnected, setApiConnected] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [currentSign, setCurrentSign] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [detectionError, setDetectionError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const canvasRef = React.useRef(null);
  const detectionIntervalRef = React.useRef(null);

  const CONFIG = {
    API_BASE_URL: 'http://localhost:5000',
    DETECTION_INTERVAL: 800,
    MIN_CONFIDENCE: 0.65,
    DETECTION_TIMEOUT: 6000
  };

  const debugLog = React.useCallback((message, data = null, level = 'info') => {
    if (debugMode || level === 'error') {
      const timestamp = new Date().toLocaleTimeString();
      const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '📝';
      console.log(`[${timestamp}] ${prefix} Detection: ${message}`, data || '');
    }
  }, [debugMode]);

  const testApiConnection = React.useCallback(async () => {
    try {
      debugLog('🔌 Testing API connection...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/health`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        debugLog('✅ API connected:', data);
        setApiConnected(true);
        setDetectionError('');
        return true;
      } else {
        throw new Error(`API returned ${response.status}`);
      }
      
    } catch (error) {
      debugLog('❌ API connection failed:', error, 'error');
      setApiConnected(false);
      setDetectionError('API connection failed. Check if server is running.');
      return false;
    }
  }, [debugLog]);

  const captureFrame = React.useCallback((videoElement) => {
    if (!videoElement || !canvasRef.current) {
      debugLog('❌ Missing video element or canvas for frame capture', null, 'error');
      return null;
    }

    try {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Check video readiness
      if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
        debugLog(`❌ Video not ready - dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`, null, 'error');
        return null;
      }
      
      // Set canvas size to match video
      canvas.width = Math.min(videoElement.videoWidth, 640);
      canvas.height = Math.min(videoElement.videoHeight, 480);
      
      debugLog(`🎨 Canvas set to: ${canvas.width}x${canvas.height}, video: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
      
      // Clear canvas and draw video frame
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      // Check if we actually drew something
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const pixelData = imageData.data;
      
      // Calculate average brightness to see if image has content
      let totalBrightness = 0;
      for (let i = 0; i < pixelData.length; i += 4) {
        // Calculate grayscale value
        totalBrightness += (pixelData[i] + pixelData[i + 1] + pixelData[i + 2]) / 3;
      }
      const avgBrightness = totalBrightness / (pixelData.length / 4);
      
      debugLog(`💡 Captured frame brightness: ${avgBrightness.toFixed(2)}`);
      
      if (avgBrightness < 1) {
        debugLog('⚠️ Captured frame appears to be black/empty', null, 'warn');
      }
      
      // Convert to blob with higher quality
      return new Promise(resolve => {
        canvas.toBlob((blob) => {
          if (blob) {
            debugLog(`📦 Blob created successfully: ${blob.size} bytes, type: ${blob.type}`);
          } else {
            debugLog('❌ Failed to create blob from canvas', null, 'error');
          }
          resolve(blob);
        }, 'image/jpeg', 0.95); // Higher quality
      });
    } catch (error) {
      debugLog('❌ Frame capture failed:', error, 'error');
      return null;
    }
  }, [debugLog]);

  const sendDetectionRequest = React.useCallback(async (blob) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.DETECTION_TIMEOUT);
    
    try {
      debugLog(`📤 Sending detection request - blob size: ${blob.size} bytes, type: ${blob.type}`);
      
      const formData = new FormData();
      formData.append('image', blob, `frame_${Date.now()}.jpg`);
      
      // Log FormData contents
      debugLog(`📋 FormData created with image file`);
      
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/detect-sign`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        // Don't set Content-Type header - let browser set it with boundary
      });
      
      clearTimeout(timeoutId);
      
      debugLog(`📥 Response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        debugLog(`❌ API error response: ${errorText}`, null, 'error');
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      debugLog(`✅ Detection result received:`, result);
      return result;
      
    } catch (error) {
      clearTimeout(timeoutId);
      debugLog(`❌ Detection request failed: ${error.message}`, error, 'error');
      throw error;
    }
  }, [debugLog]);

  const processDetectionResult = React.useCallback((result) => {
    try {
      const handPresent = result.hand_detected || 
                         (result.landmarks && result.landmarks.length > 0) ||
                         (result.confidence && result.confidence > 0.3);
      
      setHandDetected(handPresent);
      
      if (handPresent && result.sign && result.confidence > CONFIG.MIN_CONFIDENCE) {
        setCurrentSign(result.sign);
        setConfidence(parseFloat(result.confidence));
        debugLog(`✅ Detected: ${result.sign} (${(result.confidence * 100).toFixed(1)}%)`);
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
  }, [debugLog]);

  const detectFromVideo = React.useCallback(async (videoElement) => {
    // Get current detection status directly from component state
    const currentDetectionStatus = detectionStatus;
    
    if (isProcessing || !videoElement || currentDetectionStatus !== 'active') {
      debugLog(`⚠️ Skipping detection - processing: ${isProcessing}, video: ${!!videoElement}, status: ${currentDetectionStatus}`);
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Enhanced video readiness check
      if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
        debugLog(`⚠️ Video dimensions invalid: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
        return;
      }
      
      if (videoElement.paused || videoElement.ended) {
        debugLog(`⚠️ Video not playing - paused: ${videoElement.paused}, ended: ${videoElement.ended}`);
        return;
      }
      
      if (videoElement.readyState < 2) {
        debugLog(`⚠️ Video not ready - readyState: ${videoElement.readyState} (need >= 2)`);
        return;
      }
      
      debugLog(`🎬 Video check passed - ${videoElement.videoWidth}x${videoElement.videoHeight}, readyState: ${videoElement.readyState}`);
      
      const blob = await captureFrame(videoElement);
      if (!blob) {
        debugLog('❌ Failed to capture frame - blob is null');
        return;
      }
      
      debugLog(`🚀 Sending ${blob.size} byte image to API...`);
      const result = await sendDetectionRequest(blob);
      debugLog(`📥 API response:`, result);
      
      processDetectionResult(result);
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        debugLog('❌ Detection error:', error, 'error');
        setDetectionError(`Detection error: ${error.message}`);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, detectionStatus, captureFrame, sendDetectionRequest, processDetectionResult, debugLog]);

  const startDetection = React.useCallback(async (videoElement) => {
    try {
      debugLog('🎯 Starting detection...');
      
      if (detectionStatus === 'active') {
        debugLog('⚠️ Detection already active');
        return;
      }
      
      if (!videoElement) {
        throw new Error('Video element required');
      }
      
      if (!apiConnected) {
        debugLog('🔌 API not connected, testing connection...');
        const connected = await testApiConnection();
        if (!connected) {
          throw new Error('API connection failed');
        }
      }
      
      debugLog('🎯 Setting detection status to active...');
      setDetectionStatus('active');
      setDetectionError('');
      
      // Clear any existing interval
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      
      // Start interval immediately - don't wait for state update
      detectionIntervalRef.current = setInterval(() => {
        // Check video element directly, not state
        if (!videoElement || 
            videoElement.videoWidth === 0 || 
            videoElement.videoHeight === 0 ||
            videoElement.paused || 
            videoElement.ended ||
            videoElement.readyState < 2) {
          debugLog(`⚠️ Video not ready for detection`);
          return;
        }
        
        // Don't check React state here - just process
        debugLog(`🔄 Processing detection frame...`);
        processDetectionFrame(videoElement);
      }, CONFIG.DETECTION_INTERVAL);
      
      debugLog('✅ Detection started successfully');
      
    } catch (error) {
      debugLog('❌ Failed to start detection:', error, 'error');
      setDetectionStatus('error');
      setDetectionError(`Failed to start: ${error.message}`);
    }
  }, [detectionStatus, apiConnected, testApiConnection, debugLog]);
  
  // Separate function that doesn't depend on state
  const processDetectionFrame = React.useCallback(async (videoElement) => {
    if (isProcessing) {
      debugLog('⚠️ Already processing frame, skipping...');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      debugLog(`🎬 Processing frame from video ${videoElement.videoWidth}x${videoElement.videoHeight}`);
      
      const blob = await captureFrame(videoElement);
      if (!blob) {
        debugLog('❌ Failed to capture frame');
        return;
      }
      
      debugLog(`🚀 Sending ${blob.size} byte image to API...`);
      const result = await sendDetectionRequest(blob);
      debugLog(`📥 API response:`, result);
      
      processDetectionResult(result);
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        debugLog('❌ Detection frame processing error:', error, 'error');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, captureFrame, sendDetectionRequest, processDetectionResult, debugLog]);

  const stopDetection = React.useCallback(() => {
    debugLog('🛑 Stopping detection...');
    
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
    
    debugLog('✅ Detection stopped');
  }, [debugLog]);

  const initialize = React.useCallback(async () => {
    debugLog('🚀 Initializing detection manager...');
    await testApiConnection();
  }, [testApiConnection, debugLog]);

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

// Main Component
const SignToTextModule = () => {
  // Use working camera manager
  const {
    videoRef,
    cameraStatus,
    videoReady,
    cameraError,
    initializeCamera,
    stopCamera,
    isActive: cameraActive,
    isInitializing: cameraInitializing
  } = useCameraManager(true);

  // Use detection manager
  const {
    canvasRef,
    detectionStatus,
    apiConnected,
    handDetected,
    currentSign,
    confidence,
    detectionError,
    isProcessing,
    initialize: initializeDetection,
    startDetection,
    stopDetection,
    isActive: detectionActive
  } = useDetectionManager(true);

  // Simple recognized text state
  const [recognizedSigns, setRecognizedSigns] = useState([]);
  const [currentSession, setCurrentSession] = useState('');

  // Initialize detection on mount
  useEffect(() => {
    initializeDetection();
  }, [initializeDetection]);

  // Auto-start detection when camera becomes ready
  useEffect(() => {
    if (videoReady && apiConnected && !detectionActive) {
      console.log('🚀 Auto-starting detection - camera ready and API connected');
      startDetection(videoRef.current);
    }
  }, [videoReady, apiConnected, detectionActive, startDetection]);

  // Handle sign recognition (simplified for now)
  useEffect(() => {
    if (currentSign && confidence > 0.7) {
      // Simple duplicate prevention
      const lastSign = recognizedSigns[recognizedSigns.length - 1];
      if (lastSign !== currentSign) {
        setRecognizedSigns(prev => {
          const newSigns = [...prev, currentSign];
          setCurrentSession(newSigns.join(' '));
          return newSigns;
        });
      }
    }
  }, [currentSign, confidence, recognizedSigns]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
      padding: '24px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{
            color: 'white',
            fontSize: '32px',
            fontWeight: '800',
            marginBottom: '8px',
            background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            🎯 Sign Language Detection
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '16px', margin: 0 }}>
            Real-time AI-powered sign language recognition
          </p>
        </div>

        {/* Status Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          {/* Camera Status */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: cameraActive ? '#22c55e' : 
                          cameraInitializing ? '#f59e0b' : '#ef4444'
            }} />
            <div>
              <div style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>
                Camera: {cameraStatus}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                {cameraActive ? 'Active' : cameraInitializing ? 'Starting...' : 'Inactive'}
              </div>
            </div>
          </div>

          {/* API Status */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: apiConnected ? '#22c55e' : '#ef4444'
            }} />
            <div>
              <div style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>
                API: {apiConnected ? 'Connected' : 'Disconnected'}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                {apiConnected ? 'Ready' : 'Check server'}
              </div>
            </div>
          </div>

          {/* Detection Status */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Activity size={16} style={{ 
              color: detectionActive ? '#22c55e' : '#f59e0b' 
            }} />
            <div>
              <div style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>
                Detection: {detectionStatus}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                {detectionActive ? 'Running' : 'Stopped'}
              </div>
            </div>
          </div>

          {/* Hand Status */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Hand size={16} style={{ 
              color: handDetected ? '#22c55e' : '#6b7280' 
            }} />
            <div>
              <div style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>
                Hand: {handDetected ? 'Detected' : 'None'}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                {currentSign || 'No sign'}
                {confidence > 0 && ` (${Math.round(confidence * 100)}%)`}
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {(cameraError || detectionError) && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            color: '#fca5a5',
            fontSize: '14px'
          }}>
            ❌ {cameraError || detectionError}
          </div>
        )}

        {/* Video Section */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '20px',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '24px'
        }}>
          <h3 style={{
            color: 'white',
            fontSize: '20px',
            fontWeight: '700',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Camera size={24} style={{ color: '#06b6d4' }} />
            Live Detection Feed
            {cameraActive && (
              <span style={{
                background: 'rgba(34, 197, 94, 0.2)',
                color: '#22c55e',
                padding: '4px 8px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                LIVE
              </span>
            )}
          </h3>

          <div style={{
            position: 'relative',
            background: '#000',
            borderRadius: '16px',
            overflow: 'hidden',
            aspectRatio: '4/3',
            minHeight: '300px'
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
                display: 'block'
              }}
            />

            {/* Hidden Canvas for Detection */}
            <canvas
              ref={canvasRef}
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

            {/* Hand Detection Indicator */}
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
                  background: handDetected ? '#22c55e' : '#6b7280',
                  boxShadow: handDetected ? '0 0 20px rgba(34, 197, 94, 0.6)' : 'none'
                }} />
                <span style={{
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  {handDetected ? 
                    `${currentSign || 'Detecting...'} ${confidence > 0 ? `(${Math.round(confidence * 100)}%)` : ''}` : 
                    'No Hand Detected'
                  }
                </span>
              </div>
            )}

            {/* Detection Status */}
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
                  {isProcessing && ' • Processing...'}
                </span>
              </div>
            )}
          </div>
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
            onClick={detectionActive ? stopDetection : () => startDetection(videoRef.current)}
            disabled={!cameraActive || !apiConnected}
            style={{
              padding: '16px 32px',
              borderRadius: '16px',
              border: 'none',
              background: (!cameraActive || !apiConnected) ?
                'rgba(107, 114, 128, 0.3)' :
                detectionActive ?
                  'linear-gradient(135deg, #f59e0b, #d97706)' :
                  'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              color: (!cameraActive || !apiConnected) ? '#6b7280' : 'white',
              cursor: (!cameraActive || !apiConnected) ? 'not-allowed' : 'pointer',
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

        {/* Recognized Text Section */}
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

      {/* Debug Info */}
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
          <div>Detection: {detectionStatus} | API: {apiConnected.toString()}</div>
          <div>Hand: {handDetected.toString()} | Processing: {isProcessing.toString()}</div>
          <div>Current Sign: {currentSign || 'None'} | Confidence: {confidence.toFixed(3)}</div>
          {videoRef.current && (
            <div>Video: {videoRef.current.videoWidth}x{videoRef.current.videoHeight} | Ready State: {videoRef.current.readyState}</div>
          )}
        </div>
      </div>

      {/* CSS Animations */}
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
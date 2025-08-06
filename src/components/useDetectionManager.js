// useDetectionManager.js - Optimized Detection Hook for Sign Language Recognition
import { useState, useRef, useCallback } from 'react';

/**
 * OPTIMIZED Detection Manager Hook
 * 
 * Key Optimizations:
 * - 5.3x faster detection rate (150ms vs 800ms intervals)
 * - Matches sign_translator.py confidence settings (0.7 threshold)
 * - 2x faster API timeouts (3s vs 6s)
 * - Optimized frame processing (640x480 max, 80% JPEG quality)
 * - Smart frame skipping to prevent queue buildup
 * - Production-ready with minimal logging overhead
 */
export const useDetectionManager = (debugMode = false) => {
  // ============================================
  // STATE MANAGEMENT
  // ============================================
  
  const [detectionStatus, setDetectionStatus] = useState('inactive'); // 'inactive' | 'active' | 'error'
  const [apiConnected, setApiConnected] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [currentSign, setCurrentSign] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [detectionError, setDetectionError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // ============================================
  // REFS FOR PERFORMANCE
  // ============================================
  
  const canvasRef = useRef(null);                // Hidden canvas for frame capture
  const detectionIntervalRef = useRef(null);     // Interval timer reference
  const lastProcessTime = useRef(0);             // Rate limiting tracker

  // ============================================
  // OPTIMIZED CONFIGURATION
  // ============================================
  
  const CONFIG = {
    // API Settings
    API_BASE_URL: 'http://localhost:5000',
    
    // PERFORMANCE OPTIMIZATIONS
    DETECTION_INTERVAL: 150,      // 🚀 150ms = ~6.7 FPS (was 800ms = 1.25 FPS)
    MIN_CONFIDENCE: 0.7,          // 🎯 Exact match with sign_translator.py
    DETECTION_TIMEOUT: 3000,      // ⚡ 3 seconds (was 6s)
    
    // Frame Processing Optimizations
    MAX_FRAME_WIDTH: 640,         // 📏 Optimal resolution for speed
    MAX_FRAME_HEIGHT: 480,
    JPEG_QUALITY: 0.8,           // 🎨 Good quality, fast encoding
    
    // Processing Optimizations
    SKIP_PROCESSING_IF_BUSY: true, // 🚫 Prevent queue buildup
    ENABLE_DEBUG_LOGS: false,      // 🔇 Silent for production speed
    
    // Rate Limiting
    MIN_FRAME_INTERVAL: 100       // 📊 Absolute minimum between frames
  };

  // ============================================
  // OPTIMIZED DEBUG LOGGING
  // ============================================
  
  const debugLog = useCallback((message, data = null, level = 'info') => {
    // Only log in debug mode or for errors, and only if enabled
    if (CONFIG.ENABLE_DEBUG_LOGS && (debugMode || level === 'error')) {
      const timestamp = new Date().toLocaleTimeString();
      const emoji = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '📝';
      console.log(`[${timestamp}] ${emoji} Detection: ${message}`, data || '');
    }
  }, [debugMode]);

  // ============================================
  // API CONNECTION MANAGEMENT
  // ============================================
  
  const testApiConnection = useCallback(async () => {
    try {
      debugLog('🔌 Testing API connection...');
      
      // Fast timeout for connection test
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        debugLog('✅ API connected successfully', data);
        setApiConnected(true);
        setDetectionError('');
        return true;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      debugLog('❌ API connection failed', error, 'error');
      setApiConnected(false);
      
      if (error.name === 'AbortError') {
        setDetectionError('API connection timeout - server may be down');
      } else {
        setDetectionError(`API connection failed: ${error.message}`);
      }
      
      return false;
    }
  }, [CONFIG.API_BASE_URL, debugLog]);

  // ============================================
  // OPTIMIZED FRAME CAPTURE
  // ============================================
  
  const captureFrame = useCallback((videoElement) => {
    // Validation
    if (!videoElement || !canvasRef.current) {
      debugLog('⚠️ Missing video element or canvas for frame capture', null, 'warn');
      return null;
    }

    try {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Get optimized dimensions
      const sourceWidth = videoElement.videoWidth;
      const sourceHeight = videoElement.videoHeight;
      
      if (sourceWidth === 0 || sourceHeight === 0) {
        debugLog('⚠️ Video dimensions not ready', null, 'warn');
        return null;
      }
      
      // Calculate optimal target dimensions (maintain aspect ratio)
      let targetWidth = Math.min(sourceWidth, CONFIG.MAX_FRAME_WIDTH);
      let targetHeight = Math.min(sourceHeight, CONFIG.MAX_FRAME_HEIGHT);
      
      // Maintain aspect ratio
      const aspectRatio = sourceWidth / sourceHeight;
      if (targetWidth / targetHeight > aspectRatio) {
        targetWidth = targetHeight * aspectRatio;
      } else {
        targetHeight = targetWidth / aspectRatio;
      }
      
      // Set canvas dimensions
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      // Draw video frame to canvas
      context.drawImage(videoElement, 0, 0, targetWidth, targetHeight);
      
      // Convert to blob with optimized settings
      return new Promise((resolve) => {
        canvas.toBlob(
          resolve,
          'image/jpeg',
          CONFIG.JPEG_QUALITY
        );
      });
      
    } catch (error) {
      debugLog('❌ Frame capture error', error, 'error');
      return null;
    }
  }, [CONFIG.MAX_FRAME_WIDTH, CONFIG.MAX_FRAME_HEIGHT, CONFIG.JPEG_QUALITY, debugLog]);

  // ============================================
  // OPTIMIZED API REQUEST
  // ============================================
  
  const sendDetectionRequest = useCallback(async (blob) => {
    if (!blob) {
      throw new Error('No image blob provided');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.DETECTION_TIMEOUT);
    
    try {
      debugLog(`🚀 Sending detection request (${blob.size} bytes)`);
      
      const formData = new FormData();
      formData.append('image', blob, `frame_${Date.now()}.jpg`);
      
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/detect-sign`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      debugLog('✅ Detection response received', result);
      
      return result;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        debugLog('⏱️ Detection request timeout', null, 'warn');
        throw new Error('Detection request timed out');
      }
      
      debugLog('❌ Detection request failed', error, 'error');
      throw error;
    }
  }, [CONFIG.API_BASE_URL, CONFIG.DETECTION_TIMEOUT, debugLog]);

  // ============================================
  // RESULT PROCESSING
  // ============================================
  
  const processDetectionResult = useCallback((result) => {
    try {
      // Validate result structure
      if (!result || typeof result !== 'object') {
        debugLog('⚠️ Invalid detection result', result, 'warn');
        return;
      }
      
      // Extract hand detection status
      const handPresent = Boolean(
        result.hand_detected || 
        (result.landmarks && Array.isArray(result.landmarks) && result.landmarks.length > 0) ||
        (result.confidence && result.confidence > 0.3)
      );
      
      setHandDetected(handPresent);
      
      // Process sign detection
      if (handPresent && result.sign && typeof result.sign === 'string') {
        const signConfidence = parseFloat(result.confidence) || 0;
        
        if (signConfidence >= CONFIG.MIN_CONFIDENCE) {
          setCurrentSign(result.sign);
          setConfidence(signConfidence);
          debugLog(`🎯 Sign detected: ${result.sign} (${(signConfidence * 100).toFixed(1)}%)`);
        } else {
          setCurrentSign('');
          setConfidence(signConfidence);
          debugLog(`🤔 Low confidence detection: ${result.sign} (${(signConfidence * 100).toFixed(1)}%)`);
        }
      } else if (handPresent) {
        // Hand detected but no valid sign
        setCurrentSign('');
        setConfidence(parseFloat(result.confidence) || 0);
        debugLog('👋 Hand detected, but no clear sign');
      } else {
        // No hand detected
        setCurrentSign('');
        setConfidence(0);
        debugLog('🚫 No hand detected');
      }
      
    } catch (error) {
      debugLog('❌ Error processing detection result', error, 'error');
      setCurrentSign('');
      setConfidence(0);
      setHandDetected(false);
    }
  }, [CONFIG.MIN_CONFIDENCE, debugLog]);

  // ============================================
  // MAIN DETECTION LOOP (HIGHLY OPTIMIZED)
  // ============================================
  
  const detectFromVideo = useCallback(async (videoElement) => {
    // OPTIMIZATION 1: Skip if already processing (prevents queue buildup)
    if (CONFIG.SKIP_PROCESSING_IF_BUSY && isProcessing) {
      debugLog('⏭️ Skipping frame - still processing previous');
      return;
    }

    // OPTIMIZATION 2: Validate detection state
    if (!videoElement || detectionStatus !== 'active') {
      debugLog('⏸️ Detection not active or no video element');
      return;
    }
    
    // OPTIMIZATION 3: Rate limiting at function level
    const currentTime = Date.now();
    const timeSinceLastProcess = currentTime - lastProcessTime.current;
    
    if (timeSinceLastProcess < CONFIG.MIN_FRAME_INTERVAL) {
      debugLog(`⏱️ Rate limiting: ${timeSinceLastProcess}ms < ${CONFIG.MIN_FRAME_INTERVAL}ms`);
      return;
    }
    
    lastProcessTime.current = currentTime;
    
    // OPTIMIZATION 4: Quick video readiness check
    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      debugLog('⚠️ Video not ready - dimensions are 0');
      return;
    }
    
    if (videoElement.paused || videoElement.ended) {
      debugLog('⚠️ Video is paused or ended');
      return;
    }
    
    // Start processing
    setIsProcessing(true);
    
    try {
      debugLog(`📸 Processing frame from ${videoElement.videoWidth}x${videoElement.videoHeight} video`);
      
      // OPTIMIZATION 5: Streamlined processing pipeline
      const blob = await captureFrame(videoElement);
      if (!blob) {
        debugLog('❌ Failed to capture frame');
        return;
      }
      
      const result = await sendDetectionRequest(blob);
      processDetectionResult(result);
      
      debugLog('✅ Frame processed successfully');
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        debugLog('❌ Detection processing error', error, 'error');
        setDetectionError(`Processing error: ${error.message}`);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [
    isProcessing,
    detectionStatus,
    captureFrame,
    sendDetectionRequest,
    processDetectionResult,
    CONFIG.SKIP_PROCESSING_IF_BUSY,
    CONFIG.MIN_FRAME_INTERVAL,
    debugLog
  ]);

  // ============================================
  // DETECTION CONTROL
  // ============================================
  
  const startDetection = useCallback(async (videoElement) => {
    try {
      debugLog('🚀 Starting optimized detection...');
      
      // Validation
      if (detectionStatus === 'active') {
        debugLog('⚠️ Detection already active', null, 'warn');
        return;
      }
      
      if (!videoElement) {
        throw new Error('Video element is required for detection');
      }
      
      // Ensure API connection
      if (!apiConnected) {
        debugLog('🔌 API not connected, testing connection...');
        const connected = await testApiConnection();
        if (!connected) {
          throw new Error('Failed to connect to detection API');
        }
      }
      
      // Clear any existing errors
      setDetectionStatus('active');
      setDetectionError('');
      
      // MAIN OPTIMIZATION: Start high-frequency detection loop
      // 150ms interval = ~6.7 FPS vs previous 800ms = 1.25 FPS
      debugLog(`⚡ Starting detection loop with ${CONFIG.DETECTION_INTERVAL}ms intervals (~${(1000/CONFIG.DETECTION_INTERVAL).toFixed(1)} FPS)`);
      
      detectionIntervalRef.current = setInterval(() => {
        detectFromVideo(videoElement);
      }, CONFIG.DETECTION_INTERVAL);
      
      debugLog('✅ Optimized detection started successfully');
      
    } catch (error) {
      debugLog('❌ Failed to start detection', error, 'error');
      setDetectionStatus('error');
      setDetectionError(`Failed to start detection: ${error.message}`);
    }
  }, [
    detectionStatus,
    apiConnected,
    testApiConnection,
    detectFromVideo,
    CONFIG.DETECTION_INTERVAL,
    debugLog
  ]);

  const stopDetection = useCallback(() => {
    debugLog('🛑 Stopping detection...');
    
    // Update status
    setDetectionStatus('inactive');
    
    // Clear interval
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    
    // Reset all detection state
    setHandDetected(false);
    setCurrentSign('');
    setConfidence(0);
    setIsProcessing(false);
    setDetectionError('');
    
    // Reset timing
    lastProcessTime.current = 0;
    
    debugLog('✅ Detection stopped and state reset');
  }, [debugLog]);

  // ============================================
  // INITIALIZATION
  // ============================================
  
  const initialize = useCallback(async () => {
    debugLog('🚀 Initializing detection manager...');
    debugLog(`⚡ Performance config: ${CONFIG.DETECTION_INTERVAL}ms intervals, ${CONFIG.MIN_CONFIDENCE} confidence, ${CONFIG.MAX_FRAME_WIDTH}x${CONFIG.MAX_FRAME_HEIGHT} max resolution`);
    
    const connected = await testApiConnection();
    if (connected) {
      debugLog('✅ Detection manager initialized successfully');
    } else {
      debugLog('⚠️ Detection manager initialized but API connection failed', null, 'warn');
    }
  }, [testApiConnection, CONFIG, debugLog]);

  // ============================================
  // RETURN INTERFACE
  // ============================================
  
  return {
    // Essential refs
    canvasRef,
    
    // Core state
    detectionStatus,    // 'inactive' | 'active' | 'error'
    apiConnected,
    handDetected,
    currentSign,
    confidence,
    detectionError,
    isProcessing,
    
    // Control functions
    initialize,
    startDetection,
    stopDetection,
    testApiConnection,
    
    // Computed state
    isActive: detectionStatus === 'active',
    hasError: detectionStatus === 'error',
    isInitializing: detectionStatus === 'initializing',
    
    // Performance metrics (for debugging/monitoring)
    performanceInfo: {
      detectionRate: `${(1000/CONFIG.DETECTION_INTERVAL).toFixed(1)} FPS`,
      interval: `${CONFIG.DETECTION_INTERVAL}ms`,
      confidence: CONFIG.MIN_CONFIDENCE,
      maxResolution: `${CONFIG.MAX_FRAME_WIDTH}x${CONFIG.MAX_FRAME_HEIGHT}`,
      timeout: `${CONFIG.DETECTION_TIMEOUT}ms`,
      jpegQuality: `${Math.round(CONFIG.JPEG_QUALITY * 100)}%`
    },
    
    // Configuration (read-only)
    config: CONFIG
  };
};

export default useDetectionManager;
// useDetectionManager.js - Focused detection management hook
import { useState, useRef, useCallback } from 'react';

export const useDetectionManager = (debugMode = true) => {
  // States
  const [detectionStatus, setDetectionStatus] = useState('inactive');
  const [apiConnected, setApiConnected] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [currentSign, setCurrentSign] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [detectionError, setDetectionError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Refs
  const canvasRef = useRef(null);
  const detectionIntervalRef = useRef(null);

  // Configuration
  const CONFIG = {
    API_BASE_URL: 'http://localhost:5000',
    DETECTION_INTERVAL: 800,
    MIN_CONFIDENCE: 0.65,
    DETECTION_TIMEOUT: 6000
  };

  // Debug logger
  const debugLog = useCallback((message, data = null, level = 'info') => {
    if (debugMode || level === 'error') {
      const timestamp = new Date().toLocaleTimeString();
      const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '📝';
      console.log(`[${timestamp}] ${prefix} Detection: ${message}`, data || '');
    }
  }, [debugMode]);

  // Test API connection
  const testApiConnection = useCallback(async () => {
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

  // Capture frame from video
  const captureFrame = useCallback((videoElement) => {
    if (!videoElement || !canvasRef.current) return null;

    try {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Set canvas size to match video
      canvas.width = Math.min(videoElement.videoWidth, 640);
      canvas.height = Math.min(videoElement.videoHeight, 480);
      
      // Draw video frame to canvas
      context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      // Convert to blob
      return new Promise(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', 0.85);
      });
    } catch (error) {
      debugLog('❌ Frame capture failed:', error, 'error');
      return null;
    }
  }, [debugLog]);

  // Send detection request
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
  }, []);

  // Process detection result
  const processDetectionResult = useCallback((result) => {
    try {
      // Check for hand detection
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

  // Main detection loop
  const detectFromVideo = useCallback(async (videoElement) => {
    if (isProcessing || !videoElement || detectionStatus !== 'active') return;
    
    setIsProcessing(true);
    
    try {
      // Check video readiness
      if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
        debugLog('⚠️ Video not ready for capture');
        return;
      }
      
      // Capture frame
      const blob = await captureFrame(videoElement);
      if (!blob) {
        debugLog('⚠️ Failed to capture frame');
        return;
      }
      
      // Send to API
      const result = await sendDetectionRequest(blob);
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

  // Start detection
  const startDetection = useCallback(async (videoElement) => {
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
      
      setDetectionStatus('active');
      setDetectionError('');
      
      // Start detection loop
      detectionIntervalRef.current = setInterval(() => {
        detectFromVideo(videoElement);
      }, CONFIG.DETECTION_INTERVAL);
      
      debugLog('✅ Detection started successfully');
      
    } catch (error) {
      debugLog('❌ Failed to start detection:', error, 'error');
      setDetectionStatus('error');
      setDetectionError(`Failed to start: ${error.message}`);
    }
  }, [detectionStatus, apiConnected, testApiConnection, detectFromVideo, debugLog]);

  // Stop detection
  const stopDetection = useCallback(() => {
    debugLog('🛑 Stopping detection...');
    
    setDetectionStatus('inactive');
    
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    
    // Reset detection state
    setHandDetected(false);
    setCurrentSign('');
    setConfidence(0);
    setIsProcessing(false);
    setDetectionError('');
    
    debugLog('✅ Detection stopped');
  }, [debugLog]);

  // Initialize (test API connection on mount)
  const initialize = useCallback(async () => {
    debugLog('🚀 Initializing detection manager...');
    await testApiConnection();
  }, [testApiConnection, debugLog]);

  return {
    // Refs
    canvasRef,
    
    // States
    detectionStatus, // 'inactive' | 'active' | 'error'
    apiConnected,
    handDetected,
    currentSign,
    confidence,
    detectionError,
    isProcessing,
    
    // Actions
    initialize,
    startDetection,
    stopDetection,
    testApiConnection,
    
    // Computed
    isActive: detectionStatus === 'active',
    hasError: detectionStatus === 'error'
  };
};
// useCameraManager.js - Focused camera management hook
import { useState, useRef, useCallback } from 'react';

export const useCameraManager = (debugMode = true) => {
  // States
  const [cameraStatus, setCameraStatus] = useState('inactive');
  const [videoReady, setVideoReady] = useState(false);
  const [cameraError, setCameraError] = useState('');

  // Refs
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Configuration
  const CONFIG = {
    VIDEO_CONSTRAINTS: {
      width: { ideal: 640, min: 320 },
      height: { ideal: 480, min: 240 },
      frameRate: { ideal: 24, min: 15 },
      facingMode: 'user'
    }
  };

  // Debug logger
  const debugLog = useCallback((message, data = null, level = 'info') => {
    if (debugMode || level === 'error') {
      const timestamp = new Date().toLocaleTimeString();
      const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '📝';
      console.log(`[${timestamp}] ${prefix} Camera: ${message}`, data || '');
    }
  }, [debugMode]);

  // Initialize camera - SIMPLIFIED APPROACH
  const initializeCamera = useCallback(async () => {
    try {
      debugLog('🎥 Starting camera initialization...');
      setCameraStatus('initializing');
      setCameraError('');
      setVideoReady(false);

      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Clear video
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // Get camera stream
      debugLog('📹 Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: CONFIG.VIDEO_CONSTRAINTS,
        audio: false
      });

      if (!stream || !stream.active) {
        throw new Error('Failed to get active camera stream');
      }

      debugLog('✅ Stream obtained successfully');
      streamRef.current = stream;

      // Assign to video element - IMMEDIATE ASSIGNMENT
      if (!videoRef.current) {
        throw new Error('Video element not available');
      }

      const video = videoRef.current;
      
      // Set video properties BEFORE stream assignment
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      
      debugLog('🔗 Assigning stream to video element...');
      
      // Direct assignment - no complex async waiting
      video.srcObject = stream;

      // Simple readiness check with immediate state updates
      const checkVideoReady = () => {
        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
          debugLog(`✅ Video ready: ${video.videoWidth}x${video.videoHeight}`);
          setVideoReady(true);
          setCameraStatus('active');
          return true;
        }
        return false;
      };

      // Check immediately
      if (!checkVideoReady()) {
        // Wait a bit and check again
        setTimeout(() => {
          if (!checkVideoReady()) {
            debugLog('⚠️ Video still not ready, forcing play...');
            video.play().catch(err => debugLog('Play failed:', err, 'warn'));
            
            // Final check
            setTimeout(() => {
              if (checkVideoReady()) {
                debugLog('✅ Video ready after play');
              } else {
                debugLog('❌ Video failed to become ready', null, 'error');
                setCameraError('Video failed to initialize properly');
                setCameraStatus('error');
              }
            }, 1000);
          }
        }, 500);
      }

    } catch (error) {
      debugLog('❌ Camera initialization failed:', error, 'error');
      setCameraStatus('error');
      setVideoReady(false);
      
      // Cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Set specific error message
      if (error.name === 'NotAllowedError') {
        setCameraError('Camera access denied. Please grant permission and try again.');
      } else if (error.name === 'NotFoundError') {
        setCameraError('No camera found. Please connect a camera.');
      } else if (error.name === 'NotReadableError') {
        setCameraError('Camera is being used by another application.');
      } else {
        setCameraError(`Camera error: ${error.message}`);
      }
    }
  }, [debugLog]);

  // Stop camera
  const stopCamera = useCallback(() => {
    try {
      debugLog('🛑 Stopping camera...');
      
      // Stop tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Clear video
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // Reset states
      setCameraStatus('inactive');
      setVideoReady(false);
      setCameraError('');

      debugLog('✅ Camera stopped');
    } catch (error) {
      debugLog('⚠️ Error stopping camera:', error, 'error');
      setCameraStatus('error');
    }
  }, [debugLog]);

  // Get current video dimensions
  const getVideoDimensions = useCallback(() => {
    if (videoRef.current) {
      return {
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
        readyState: videoRef.current.readyState
      };
    }
    return { width: 0, height: 0, readyState: 0 };
  }, []);

  // Check if camera is actually ready for capture
  const isCameraReadyForCapture = useCallback(() => {
    if (!videoRef.current || !videoReady) return false;
    
    const video = videoRef.current;
    return video.readyState >= 2 && 
           video.videoWidth > 0 && 
           video.videoHeight > 0 && 
           !video.paused;
  }, [videoReady]);

  return {
    // Refs
    videoRef,
    
    // States
    cameraStatus, // 'inactive' | 'initializing' | 'active' | 'error'
    videoReady,
    cameraError,
    
    // Actions
    initializeCamera,
    stopCamera,
    
    // Utilities
    getVideoDimensions,
    isCameraReadyForCapture,
    
    // Computed
    isActive: cameraStatus === 'active',
    isInitializing: cameraStatus === 'initializing',
    hasError: cameraStatus === 'error'
  };
};
// src/utils/cameraDetectionUtils.js - Camera and sign detection utilities

import { MOCK_DETECTION_SIGNS, DETECTION_SETTINGS } from './signConstants';

/**
 * Starts the camera with proper error handling
 * @param {HTMLVideoElement} videoElement - Video element to attach stream
 * @returns {Promise<MediaStream|null>} - Camera stream or null if failed
 */
export const startCameraStream = async (videoElement) => {
  console.log('=== CAMERA START INITIATED ===');
  
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error('❌ getUserMedia is not supported in this browser');
    throw new Error('Camera API not supported in this browser');
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
    
    if (videoElement) {
      videoElement.srcObject = stream;
    }
    
    return stream;
  } catch (error) {
    console.error('❌ Camera access failed:', error);
    throw new Error('Failed to access camera. Please check permissions.');
  }
};

/**
 * Stops the camera stream and cleans up resources
 * @param {MediaStream} stream - The camera stream to stop
 * @param {HTMLVideoElement} videoElement - Video element to clear
 */
export const stopCameraStream = (stream, videoElement) => {
  console.log('=== STOPPING CAMERA ===');
  
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  
  if (videoElement) {
    videoElement.srcObject = null;
  }
};

/**
 * Mock sign detection function (replace with actual ML model)
 * @param {Function} onDetection - Callback when sign is detected
 * @returns {number} - Interval ID for cleanup
 */
export const startMockDetection = (onDetection) => {
  return setInterval(() => {
    // Simulate detection with random probability
    if (Math.random() > 0.7) {
      const sign = MOCK_DETECTION_SIGNS[Math.floor(Math.random() * MOCK_DETECTION_SIGNS.length)];
      const confidence = Math.floor(Math.random() * 20) + 80; // 80-99% confidence
      
      onDetection({
        sign,
        confidence,
        timestamp: Date.now()
      });
    }
  }, DETECTION_SETTINGS.DETECTION_INTERVAL);
};

/**
 * Stops the detection process
 * @param {number} intervalId - The interval ID to clear
 */
export const stopDetection = (intervalId) => {
  if (intervalId) {
    clearInterval(intervalId);
  }
};

/**
 * Text-to-speech utility function
 * @param {string} text - Text to speak
 * @param {Function} onStart - Callback when speech starts
 * @param {Function} onEnd - Callback when speech ends
 */
export const speakText = (text, onStart, onEnd) => {
  if ('speechSynthesis' in window) {
    if (onStart) onStart();
    
    const utterance = new SpeechSynthesisUtterance(text.toLowerCase().replace('_', ' '));
    
    if (onEnd) {
      utterance.onend = onEnd;
    }
    
    speechSynthesis.speak(utterance);
  }
};

/**
 * Saves recognized text to a file
 * @param {string[]} recognizedSigns - Array of recognized signs
 * @param {string} filename - Optional filename (defaults to date-based name)
 */
export const saveRecognizedText = (recognizedSigns, filename) => {
  if (recognizedSigns.length === 0) {
    console.warn('No recognized signs to save');
    return;
  }

  const text = recognizedSigns.join(' ');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  
  a.href = url;
  a.download = filename || `recognized_signs_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  
  URL.revokeObjectURL(url);
};

/**
 * Validates camera permissions
 * @returns {Promise<boolean>} - Whether camera permission is granted
 */
export const checkCameraPermission = async () => {
  try {
    if (!navigator.permissions) {
      return true; // Assume permission if API not available
    }
    
    const permission = await navigator.permissions.query({ name: 'camera' });
    return permission.state === 'granted';
  } catch (error) {
    console.warn('Could not check camera permission:', error);
    return true; // Assume permission if check fails
  }
};

/**
 * Gets available camera devices
 * @returns {Promise<MediaDeviceInfo[]>} - Array of camera devices
 */
export const getAvailableCameras = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'videoinput');
  } catch (error) {
    console.error('Could not enumerate devices:', error);
    return [];
  }
};
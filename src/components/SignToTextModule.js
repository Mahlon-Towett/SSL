// src/components/SignToTextModule.js - Enhanced Production-Ready Version Part 1
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, CameraOff, Play, Square, 
  Volume2, VolumeX, Download, RefreshCw, 
  Eye, EyeOff, Wifi, WifiOff, Save, Trash2, 
  Activity, CheckCircle, AlertCircle, Hand,
  Zap, Target, Clock, TrendingUp
} from 'lucide-react';

const SignToTextModule = () => {
  // ==================== CORE STATE MANAGEMENT ====================
  const [cameraActive, setCameraActive] = useState(false);
  const [detectionActive, setDetectionActive] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [currentDetectedSign, setCurrentDetectedSign] = useState('');
  const [signConfidence, setSignConfidence] = useState(0);
  const [recognizedSigns, setRecognizedSigns] = useState([]);
  const [currentSession, setCurrentSession] = useState('');
  const [signHistory, setSignHistory] = useState([]);
  
  // ==================== ENHANCED PRODUCTION STATE ====================
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);
  const [apiError, setApiError] = useState('');
  const [debugMode, setDebugMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [connectionRetries, setConnectionRetries] = useState(0);
  
  // ==================== PERFORMANCE & STABILITY STATE ====================
  const [detectionStats, setDetectionStats] = useState({
    totalDetections: 0,
    successfulDetections: 0,
    averageConfidence: 0,
    sessionStartTime: null,
    consecutiveFailures: 0,
    lastSuccessTime: null
  });

  const [stabilityMetrics, setStabilityMetrics] = useState({
    lastDetectionTime: 0,
    consecutiveDetections: 0,
    stabilityBuffer: [],
    lastSpokenSign: '',
    lastSpokenTime: 0,
    detectionStreak: 0,
    confidenceHistory: []
  });

  // ==================== REFS FOR DOM & INTERVALS ====================
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const stabilityTimerRef = useRef(null);
  const speechQueueRef = useRef([]);
  const isInitializedRef = useRef(false);
  const retryTimeoutRef = useRef(null);

  // ==================== ENHANCED CONFIGURATION ====================
  const CONFIG = {
    API_BASE_URL: 'http://localhost:5000',
    DETECTION_INTERVAL: 1200, // Optimized for smooth detection
    STABILITY_THRESHOLD: 3, // Require 3 consecutive detections
    MIN_CONFIDENCE: 0.78, // Higher threshold for production
    SPEECH_COOLDOWN: 1800, // Prevent rapid speech repetition
    BUFFER_SIZE: 5, // Stability buffer size
    MAX_RETRY_ATTEMPTS: 5,
    CONNECTION_TIMEOUT: 6000,
    DETECTION_TIMEOUT: 8000,
    VIDEO_CONSTRAINTS: {
      width: { ideal: 1280, min: 640 },
      height: { ideal: 720, min: 480 },
      frameRate: { ideal: 24, min: 15 },
      facingMode: 'user'
    },
    SPEECH_SETTINGS: {
      rate: 0.82,
      pitch: 1.05,
      volume: 0.92
    }
  };

  // ==================== ENHANCED LOGGING SYSTEM ====================
  const debugLog = useCallback((message, data = null, level = 'info') => {
    if (debugMode || level === 'error') {
      const timestamp = new Date().toLocaleTimeString();
      const logLevel = level.toUpperCase();
      const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '📝';
      console.log(`[${timestamp}] ${prefix} SignToText ${logLevel}: ${message}`, data || '');
    }
  }, [debugMode]);

  // ==================== COMPONENT INITIALIZATION ====================
  useEffect(() => {
    debugLog('🚀 SignToTextModule initializing with enhanced features...');
    initializeModule();
    
    return () => {
      cleanup();
    };
  }, []);

  // Enhanced module initialization with comprehensive setup
  const initializeModule = async () => {
    try {
      debugLog('🔧 Starting comprehensive module initialization...');
      
      // Initialize detection statistics
      setDetectionStats(prev => ({
        ...prev,
        sessionStartTime: Date.now(),
        lastSuccessTime: Date.now()
      }));
      
      // Reset stability metrics
      setStabilityMetrics(prev => ({
        ...prev,
        lastDetectionTime: Date.now(),
        confidenceHistory: []
      }));
      
      // Initialize speech synthesis
      await initializeSpeechSynthesis();
      
      // Test API connection with enhanced retry logic
      await testApiConnectionWithRetry();
      
      // Setup performance monitoring
      setupPerformanceMonitoring();
      
      isInitializedRef.current = true;
      debugLog('✅ Module initialization complete with all systems ready');
      
    } catch (error) {
      debugLog('Module initialization failed:', error, 'error');
      setApiError('Initialization failed. Please refresh the page.');
    }
  };

  // ==================== ENHANCED API CONNECTION ====================
  const testApiConnectionWithRetry = async (retryCount = 0) => {
    try {
      debugLog(`🔍 Testing API connection (attempt ${retryCount + 1}/${CONFIG.MAX_RETRY_ATTEMPTS})...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.CONNECTION_TIMEOUT);
      
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.status === 'healthy') {
        setApiConnected(true);
        setApiError('');
        setConnectionRetries(0);
        debugLog('✅ API connection successful');
        return true;
      } else {
        throw new Error(result.message || 'API returned unexpected response');
      }
      
    } catch (error) {
      debugLog(`API connection failed: ${error.message}`, error, 'warn');
      
      if (retryCount < CONFIG.MAX_RETRY_ATTEMPTS - 1) {
        setConnectionRetries(retryCount + 1);
        const delay = Math.min(2000 * Math.pow(2, retryCount), 10000); // Exponential backoff
        debugLog(`⏳ Retrying connection in ${delay}ms...`);
        
        retryTimeoutRef.current = setTimeout(() => {
          testApiConnectionWithRetry(retryCount + 1);
        }, delay);
        
        return false;
      }
      
      setApiConnected(false);
      setConnectionRetries(CONFIG.MAX_RETRY_ATTEMPTS);
      setApiError(`API connection failed after ${CONFIG.MAX_RETRY_ATTEMPTS} attempts: ${error.message}`);
      return false;
    }
  };

  // ==================== ENHANCED SPEECH SYNTHESIS ====================
  const initializeSpeechSynthesis = async () => {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        debugLog('Speech synthesis not supported', null, 'warn');
        setTtsEnabled(false);
        resolve();
        return;
      }
      
      // Enhanced voice loading with timeout
      const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
          debugLog(`🎙️ Speech synthesis initialized with ${voices.length} voices available`);
          
          // Log available voices for debugging
          if (debugMode) {
            voices.forEach((voice, index) => {
              debugLog(`Voice ${index}: ${voice.name} (${voice.lang}) - ${voice.localService ? 'Local' : 'Remote'}`);
            });
          }
          
          resolve();
          return true;
        }
        return false;
      };
      
      // Try immediate load
      if (loadVoices()) return;
      
      // Wait for voices to load with timeout
      let attempts = 0;
      const maxAttempts = 50;
      
      const checkVoices = () => {
        attempts++;
        if (loadVoices() || attempts >= maxAttempts) {
          resolve();
          return;
        }
        setTimeout(checkVoices, 100);
      };
      
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = checkVoices;
      }
      
      checkVoices();
    });
  };

  // ==================== ENHANCED CAMERA MANAGEMENT ====================
  const initializeCamera = async () => {
    try {
      debugLog('📹 Initializing camera with enhanced settings...');
      setApiError('');
      
      // Check for existing stream and clean it up
      await stopCamera();
      
      // Enhanced camera constraints for better performance
      const constraints = {
        video: {
          ...CONFIG.VIDEO_CONSTRAINTS,
          // Additional constraints for better quality
          aspectRatio: { ideal: 16/9 },
          resizeMode: 'crop-and-scale'
        },
        audio: false
      };
      
      debugLog('📹 Requesting camera access with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (!videoRef.current) {
        throw new Error('Video element not available');
      }
      
      videoRef.current.srcObject = stream;
      
      // Enhanced video loading with comprehensive error handling
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Video load timeout'));
        }, 15000);
        
        const handleLoad = () => {
          clearTimeout(timeout);
          const video = videoRef.current;
          debugLog(`✅ Camera initialized: ${video.videoWidth}x${video.videoHeight} @ ${constraints.video.frameRate.ideal}fps`);
          setCameraActive(true);
          resolve();
        };
        
        const handleError = (error) => {
          clearTimeout(timeout);
          debugLog('Video load error:', error, 'error');
          reject(new Error('Video load failed'));
        };
        
        videoRef.current.onloadedmetadata = handleLoad;
        videoRef.current.onerror = handleError;
        
        // Also handle loadeddata for additional safety
        videoRef.current.onloadeddata = () => {
          if (videoRef.current.readyState >= 2) {
            handleLoad();
          }
        };
      });
      
    } catch (error) {
      debugLog('Camera initialization failed:', error, 'error');
      setCameraActive(false);
      
      let errorMessage = 'Camera access failed. ';
      switch (error.name) {
        case 'NotAllowedError':
          errorMessage += 'Please allow camera permissions and refresh the page.';
          break;
        case 'NotFoundError':
          errorMessage += 'No camera device found. Please connect a camera.';
          break;
        case 'NotReadableError':
          errorMessage += 'Camera is being used by another application. Please close other apps using the camera.';
          break;
        case 'OverconstrainedError':
          errorMessage += 'Camera settings not supported. Trying with basic settings...';
          // Attempt with basic constraints
          setTimeout(() => initializeCameraWithBasicConstraints(), 1000);
          return;
        case 'SecurityError':
          errorMessage += 'Camera access denied due to security restrictions.';
          break;
        default:
          errorMessage += `Technical error: ${error.message}`;
      }
      
      setApiError(errorMessage);
    }
  };

  // Fallback camera initialization with basic constraints
  const initializeCameraWithBasicConstraints = async () => {
    try {
      debugLog('📹 Attempting camera initialization with basic constraints...');
      
      const basicConstraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15 }
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(basicConstraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        debugLog('✅ Camera initialized with basic constraints');
        setApiError(''); // Clear error if successful
      }
      
    } catch (error) {
      debugLog('Basic camera initialization also failed:', error, 'error');
      setApiError('Camera initialization failed completely. Please check your camera and permissions.');
    }
  };

  // Enhanced camera cleanup
  const stopCamera = async () => {
    try {
      debugLog('📹 Stopping camera with enhanced cleanup...');
      
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject;
        const tracks = stream.getTracks();
        
        tracks.forEach(track => {
          track.stop();
          debugLog(`🛑 Stopped ${track.kind} track: ${track.label}`);
        });
        
        videoRef.current.srcObject = null;
      }
      
      setCameraActive(false);
      debugLog('✅ Camera stopped successfully');
      
    } catch (error) {
      debugLog('Error stopping camera:', error, 'error');
    }
  };

  // ==================== PERFORMANCE MONITORING ====================
  const setupPerformanceMonitoring = () => {
    debugLog('📊 Setting up performance monitoring...');
    
    // Monitor detection performance
    const performanceInterval = setInterval(() => {
      if (detectionActive && detectionStats.totalDetections > 0) {
        const successRate = (detectionStats.successfulDetections / detectionStats.totalDetections) * 100;
        const avgConfidence = detectionStats.averageConfidence * 100;
        
        debugLog(`📈 Performance Stats - Success Rate: ${successRate.toFixed(1)}%, Avg Confidence: ${avgConfidence.toFixed(1)}%`);
        
        // Auto-adjust detection interval based on performance
        if (successRate < 50 && CONFIG.DETECTION_INTERVAL < 2000) {
          CONFIG.DETECTION_INTERVAL += 200;
          debugLog(`⚡ Auto-adjusted detection interval to ${CONFIG.DETECTION_INTERVAL}ms for better performance`);
        } else if (successRate > 80 && CONFIG.DETECTION_INTERVAL > 800) {
          CONFIG.DETECTION_INTERVAL -= 100;
          debugLog(`⚡ Auto-optimized detection interval to ${CONFIG.DETECTION_INTERVAL}ms for faster response`);
        }
      }
    }, 30000); // Check every 30 seconds
    
    // Cleanup performance monitoring on unmount
    return () => clearInterval(performanceInterval);
  };

// ==================== ENHANCED DETECTION ENGINE ====================
  const captureAndDetect = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing || !apiConnected) {
      return;
    }

    try {
      setIsProcessing(true);
      const currentTime = Date.now();
      
      // Smart throttling with adaptive intervals
      if (currentTime - stabilityMetrics.lastDetectionTime < CONFIG.DETECTION_INTERVAL) {
        return;
      }
      
      // Update last detection time
      setStabilityMetrics(prev => ({ ...prev, lastDetectionTime: currentTime }));
      
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      // Ensure video is ready for capture
      if (video.readyState < 2 || video.videoWidth === 0) {
        debugLog('Video not ready for capture', null, 'warn');
        return;
      }
      
      const context = canvas.getContext('2d');
      
      // Optimize canvas dimensions
      canvas.width = Math.min(video.videoWidth, 640);
      canvas.height = Math.min(video.videoHeight, 480);
      
      // Draw and enhance frame
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Apply image enhancement for better detection
      enhanceImageForDetection(context, canvas.width, canvas.height);
      
      // Convert to optimized blob
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', 0.85);
      });
      
      if (!blob) {
        throw new Error('Failed to capture frame');
      }
      
      // Send to detection API with enhanced error handling
      const result = await sendDetectionRequest(blob, currentTime);
      await processDetectionResult(result, currentTime);
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        debugLog('Detection error:', error, 'error');
        handleDetectionError(error);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Image enhancement for better detection accuracy
  const enhanceImageForDetection = (context, width, height) => {
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Apply subtle contrast enhancement
    const contrast = 1.1;
    const brightness = 5;
    
    for (let i = 0; i < data.length; i += 4) {
      // Enhance contrast and brightness
      data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128 + brightness));     // Red
      data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128 + brightness)); // Green
      data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128 + brightness)); // Blue
    }
    
    context.putImageData(imageData, 0, 0);
  };

  // Enhanced API request with retry logic
  const sendDetectionRequest = async (blob, timestamp) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.DETECTION_TIMEOUT);
    
    try {
      const formData = new FormData();
      formData.append('image', blob, `frame_${timestamp}.jpg`);
      
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/detect-sign`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: {
          'X-Request-Time': timestamp.toString(),
          'X-Client-Version': '2.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Detection API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
      
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  // ==================== ADVANCED DETECTION PROCESSING ====================
  const processDetectionResult = async (result, timestamp) => {
    try {
      // Update detection statistics
      setDetectionStats(prev => ({
        ...prev,
        totalDetections: prev.totalDetections + 1,
        lastSuccessTime: result.success ? timestamp : prev.lastSuccessTime
      }));

      setHandDetected(result.hand_detected || false);
      
      if (result.hand_detected && result.sign && result.confidence > 0.5) {
        const signName = result.sign;
        const confidence = parseFloat(result.confidence);
        
        setCurrentDetectedSign(signName);
        setSignConfidence(confidence);
        
        // Add to confidence history for trend analysis
        setStabilityMetrics(prev => ({
          ...prev,
          confidenceHistory: [...prev.confidenceHistory.slice(-10), { confidence, timestamp }]
        }));
        
        // Process through stability system
        await processStableDetection(signName, confidence, timestamp);
        
        // Update detection history with enhanced info
        setSignHistory(prev => [...prev.slice(-25), {
          sign: signName,
          confidence: confidence.toFixed(3),
          timestamp: new Date(timestamp).toLocaleTimeString(),
          trend: calculateConfidenceTrend(confidence)
        }]);
        
        // Update successful detection stats
        if (confidence >= CONFIG.MIN_CONFIDENCE) {
          setDetectionStats(prev => ({
            ...prev,
            successfulDetections: prev.successfulDetections + 1,
            averageConfidence: ((prev.averageConfidence * (prev.successfulDetections - 1)) + confidence) / prev.successfulDetections,
            consecutiveFailures: 0
          }));
        }
        
      } else {
        // Handle no detection with enhanced feedback
        await handleNoDetection(timestamp);
      }
      
    } catch (error) {
      debugLog('Error processing detection result:', error, 'error');
      handleDetectionError(error);
    }
  };

  // Calculate confidence trend for stability analysis
  const calculateConfidenceTrend = (currentConfidence) => {
    const history = stabilityMetrics.confidenceHistory.slice(-5);
    if (history.length < 2) return 'stable';
    
    const trend = history.slice(-3).reduce((sum, item, index, arr) => {
      if (index === 0) return 0;
      return sum + (item.confidence - arr[index - 1].confidence);
    }, 0) / 2;
    
    if (trend > 0.05) return 'improving';
    if (trend < -0.05) return 'declining';
    return 'stable';
  };

  // ==================== STABILITY AND SMOOTHNESS SYSTEM ====================
  const processStableDetection = async (signName, confidence, timestamp) => {
    if (confidence < CONFIG.MIN_CONFIDENCE) {
      debugLog(`⚠️ Below threshold detection: ${signName} (${confidence.toFixed(3)})`);
      return;
    }
    
    // Add to stability buffer
    setStabilityMetrics(prev => ({
      ...prev,
      stabilityBuffer: [...prev.stabilityBuffer.slice(-(CONFIG.BUFFER_SIZE - 1)), 
        { sign: signName, confidence, timestamp }]
    }));
    
    // Check for stability consensus
    const recentDetections = stabilityMetrics.stabilityBuffer.filter(
      detection => detection.sign === signName && 
      (timestamp - detection.timestamp) < (CONFIG.DETECTION_INTERVAL * 3)
    );
    
    if (recentDetections.length >= CONFIG.STABILITY_THRESHOLD) {
      const avgConfidence = recentDetections.reduce((sum, d) => sum + d.confidence, 0) / recentDetections.length;
      
      debugLog(`🎯 Stable detection confirmed: ${signName} (avg: ${avgConfidence.toFixed(3)}, samples: ${recentDetections.length})`);
      
      // Update detection streak
      setStabilityMetrics(prev => ({
        ...prev,
        detectionStreak: prev.consecutiveDetections + 1
      }));
      
      // Process the stable detection
      await handleConfirmedSign(signName, avgConfidence, timestamp);
    }
  };

  // Handle confirmed stable sign detection
  const handleConfirmedSign = async (signName, confidence, timestamp) => {
    const formattedSign = formatSignForSpeech(signName);
    
    debugLog(`✅ Confirmed sign: ${formattedSign} (confidence: ${confidence.toFixed(3)})`);
    
    // Smart text-to-speech decision
    if (ttsEnabled && shouldSpeak(formattedSign, timestamp, confidence)) {
      await addToSpeechQueue(formattedSign, timestamp, confidence);
    }
    
    // Smart text addition with deduplication
    if (shouldAddToText(signName, confidence, timestamp)) {
      addToRecognizedText(formattedSign, confidence);
    }
    
    setStabilityMetrics(prev => ({
      ...prev,
      consecutiveDetections: prev.consecutiveDetections + 1
    }));
  };

  // ==================== INTELLIGENT SPEECH SYSTEM ====================
  const shouldSpeak = (signText, timestamp, confidence) => {
    const timeSinceLastSpeech = timestamp - stabilityMetrics.lastSpokenTime;
    const isSameAsLast = stabilityMetrics.lastSpokenSign === signText;
    const isHighConfidence = confidence >= 0.85;
    
    // Don't speak if same sign too recently
    if (isSameAsLast && timeSinceLastSpeech < CONFIG.SPEECH_COOLDOWN) {
      debugLog(`🔇 Skipping speech: same sign too recent (${timeSinceLastSpeech}ms ago)`);
      return false;
    }
    
    // Don't speak if already speaking
    if (speaking) {
      debugLog(`🔇 Skipping speech: already speaking`);
      return false;
    }
    
    // Require higher confidence for less common signs
    if (!isCommonSign(signText) && confidence < 0.88) {
      debugLog(`🔇 Skipping speech: uncommon sign needs higher confidence`);
      return false;
    }
    
    return true;
  };

  // Check if sign is commonly used (for confidence adjustment)
  const isCommonSign = (signText) => {
    const commonSigns = ['hello', 'thank you', 'please', 'yes', 'no', 'help', 'good', 'bad', 'more', 'water'];
    return commonSigns.includes(signText.toLowerCase());
  };

  // Format sign text for natural speech
  const formatSignForSpeech = (signName) => {
    return signName
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, char => char.toUpperCase()); // Title case
  };

  // ==================== ADVANCED SPEECH QUEUE MANAGEMENT ====================
  const addToSpeechQueue = async (signText, timestamp, confidence) => {
    const speechItem = {
      text: signText,
      timestamp,
      confidence,
      priority: calculateSpeechPriority(signText, confidence),
      id: `speech_${timestamp}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    speechQueueRef.current.push(speechItem);
    debugLog(`🎤 Added to speech queue: "${signText}" (priority: ${speechItem.priority})`);
    
    // Sort queue by priority (higher priority first)
    speechQueueRef.current.sort((a, b) => b.priority - a.priority);
    
    // Process queue if not already processing
    if (!speaking) {
      processNextSpeech();
    }
  };

  // Calculate speech priority based on sign importance and confidence
  const calculateSpeechPriority = (signText, confidence) => {
    let priority = confidence * 100; // Base priority from confidence
    
    // Boost priority for important signs
    const importantSigns = ['help', 'emergency', 'stop', 'pain', 'medicine'];
    if (importantSigns.some(sign => signText.toLowerCase().includes(sign))) {
      priority += 50;
    }
    
    // Boost priority for common greetings
    const greetings = ['hello', 'hi', 'good morning', 'good afternoon'];
    if (greetings.some(greeting => signText.toLowerCase().includes(greeting))) {
      priority += 20;
    }
    
    return Math.round(priority);
  };

  // Process speech queue with enhanced error handling
  const processNextSpeech = async () => {
    if (speechQueueRef.current.length === 0 || speaking) {
      return;
    }
    
    const speechItem = speechQueueRef.current.shift();
    if (!speechItem) return;
    
    try {
      await performSpeech(speechItem);
    } catch (error) {
      debugLog('Speech processing error:', error, 'error');
    }
    
    // Process next item after brief delay
    setTimeout(processNextSpeech, 150);
  };

  // ==================== ENHANCED SPEECH SYNTHESIS ====================
  const performSpeech = (speechItem) => {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window) || !ttsEnabled) {
        resolve();
        return;
      }
      
      // Cancel any ongoing speech
      speechSynthesis.cancel();
      
      setSpeaking(true);
      setStabilityMetrics(prev => ({
        ...prev,
        lastSpokenSign: speechItem.text,
        lastSpokenTime: speechItem.timestamp
      }));
      
      debugLog(`🔊 Speaking: "${speechItem.text}" (confidence: ${speechItem.confidence.toFixed(3)}, priority: ${speechItem.priority})`);
      
      const utterance = new SpeechSynthesisUtterance(speechItem.text);
      
      // Enhanced speech settings
      utterance.rate = CONFIG.SPEECH_SETTINGS.rate;
      utterance.pitch = CONFIG.SPEECH_SETTINGS.pitch;
      utterance.volume = CONFIG.SPEECH_SETTINGS.volume;
      
      // Select optimal voice
      const selectedVoice = selectOptimalVoice();
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        debugLog(`🎙️ Using voice: ${selectedVoice.name} (${selectedVoice.lang})`);
      }
      
      // Enhanced event handling
      utterance.onstart = () => {
        debugLog(`🔊 Speech started: "${speechItem.text}"`);
        setSpeaking(true);
      };
      
      utterance.onend = () => {
        debugLog(`🔇 Speech completed: "${speechItem.text}"`);
        setSpeaking(false);
        resolve();
      };
      
      utterance.onerror = (event) => {
        debugLog(`❌ Speech error: ${event.error}`, event, 'error');
        setSpeaking(false);
        reject(new Error(`Speech error: ${event.error}`));
      };
      
      // Enhanced boundary detection for natural speech
      utterance.onboundary = (event) => {
        if (debugMode) {
          debugLog(`🎵 Speech boundary: ${event.name} at ${event.charIndex}`);
        }
      };
      
      speechSynthesis.speak(utterance);
    });
  };

  // Intelligent voice selection with fallback chain
  const selectOptimalVoice = () => {
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return null;
    
    // Priority chain for voice selection
    const voiceSelectionChain = [
      // High-quality voices
      v => /Google.*English.*US/i.test(v.name) && v.localService,
      v => /Microsoft.*English.*US/i.test(v.name) && v.localService,
      v => /Alex/i.test(v.name) && v.lang.startsWith('en'),
      v => /Samantha/i.test(v.name) && v.lang.startsWith('en'),
      
      // Good quality voices
      v => /Google.*English/i.test(v.name),
      v => /Microsoft.*English/i.test(v.name),
      v => v.name.toLowerCase().includes('english') && v.localService,
      
      // Fallback voices
      v => v.lang === 'en-US' && v.localService,
      v => v.lang === 'en-GB' && v.localService,
      v => v.lang.startsWith('en') && v.localService,
      v => v.lang.startsWith('en'),
      
      // Final fallback
      v => v.default,
      v => true // Any voice
    ];
    
    for (const selector of voiceSelectionChain) {
      const voice = voices.find(selector);
      if (voice) return voice;
    }
    
    return voices[0]; // Ultimate fallback
  };

  // ==================== SMART TEXT MANAGEMENT ====================
  const shouldAddToText = (signName, confidence, timestamp) => {
    // Require very high confidence for permanent text
    if (confidence < 0.88) return false;
    
    // Prevent immediate duplicates
    const lastSign = recognizedSigns[recognizedSigns.length - 1];
    const formattedSign = formatSignForSpeech(signName).toLowerCase();
    
    if (lastSign === formattedSign) {
      debugLog(`📝 Preventing duplicate text addition: "${formattedSign}"`);
      return false;
    }
    
    // Check for recent similar additions
    const recentSigns = recognizedSigns.slice(-3);
    if (recentSigns.includes(formattedSign)) {
      debugLog(`📝 Preventing recent duplicate: "${formattedSign}"`);
      return false;
    }
    
    return true;
  };

  // Add sign to recognized text with metadata
  const addToRecognizedText = (signText, confidence) => {
    const timestamp = new Date().toLocaleTimeString();
    
    setRecognizedSigns(prev => {
      const newSigns = [...prev, signText];
      const newSession = newSigns.join(' ');
      setCurrentSession(newSession);
      
      debugLog(`📝 Added to text: "${signText}" (confidence: ${confidence.toFixed(3)})`);
      debugLog(`📖 Current session: "${newSession}"`);
      
      return newSigns;
    });
  };

  // ==================== ERROR HANDLING & RECOVERY ====================
  const handleDetectionError = (error) => {
    setDetectionStats(prev => ({
      ...prev,
      consecutiveFailures: prev.consecutiveFailures + 1
    }));
    
    // Implement progressive error handling
    if (detectionStats.consecutiveFailures > 5) {
      debugLog('Too many consecutive failures, pausing detection', null, 'warn');
      stopDetection();
      setApiError('Detection temporarily paused due to errors. Please check your connection.');
      
      // Auto-retry after delay
      setTimeout(() => {
        debugLog('Auto-retrying detection after error recovery pause');
        testApiConnectionWithRetry().then(connected => {
          if (connected && cameraActive) {
            startDetection();
          }
        });
      }, 10000);
    }
  };

  // Handle no detection state with smooth transitions
  const handleNoDetection = async (timestamp) => {
    setStabilityMetrics(prev => ({
      ...prev,
      consecutiveDetections: 0,
      detectionStreak: 0
    }));
    
    // Gradual UI feedback reset
    setTimeout(() => {
      if (!handDetected) return; // Already reset
      
      setHandDetected(false);
      setCurrentDetectedSign('');
      setSignConfidence(0);
    }, 1200); // Longer delay for smoother UX
  };

  // ==================== DETECTION CONTROL ====================
  const startDetection = async () => {
    if (!apiConnected) {
      debugLog('API not connected, attempting reconnection...');
      const connected = await testApiConnectionWithRetry();
      if (!connected) {
        setApiError('Cannot start detection: API connection failed');
        return;
      }
    }
    
    debugLog('🔍 Starting enhanced real-time detection system...');
    setDetectionActive(true);
    setApiError('');
    
    // Reset detection statistics
    setDetectionStats(prev => ({
      ...prev,
      consecutiveFailures: 0,
      lastSuccessTime: Date.now()
    }));
    
    // Clear any existing detection interval
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    
    // Start optimized detection loop
    detectionIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      if (video && 
          video.readyState >= 2 && 
          video.videoWidth > 0 && 
          cameraActive && 
          detectionActive &&
          !isProcessing) {
        captureAndDetect();
      }
    }, CONFIG.DETECTION_INTERVAL);
    
    debugLog(`🎯 Detection loop started with ${CONFIG.DETECTION_INTERVAL}ms interval`);
  };

  const stopDetection = () => {
    debugLog('🛑 Stopping enhanced detection system...');
    setDetectionActive(false);
    
    // Clear detection interval
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    
    // Clear stability timers
    if (stabilityTimerRef.current) {
      clearTimeout(stabilityTimerRef.current);
      stabilityTimerRef.current = null;
    }
    
    // Clear speech queue and cancel current speech
    speechQueueRef.current = [];
    speechSynthesis.cancel();
    setSpeaking(false);
    
    // Reset stability metrics
    setStabilityMetrics(prev => ({
      ...prev,
      consecutiveDetections: 0,
      detectionStreak: 0,
      stabilityBuffer: []
    }));
    
    debugLog('✅ Detection system stopped completely');
  };

  // ==================== UTILITY FUNCTIONS ====================
  const saveRecognizedText = () => {
    if (recognizedSigns.length === 0) {
      debugLog('⚠️ No recognized signs to save');
      return;
    }
    
    const sessionDuration = Math.round((Date.now() - detectionStats.sessionStartTime) / 60000);
    const successRate = detectionStats.totalDetections > 0 ? 
      ((detectionStats.successfulDetections / detectionStats.totalDetections) * 100).toFixed(1) : '0.0';
    
    const content = `ASL Translation Session
=====================

Recognized Text:
${currentSession}

Session Statistics:
- Total Signs Recognized: ${recognizedSigns.length}
- Detection Accuracy: ${successRate}%
- Average Confidence: ${(detectionStats.averageConfidence * 100).toFixed(1)}%
- Session Duration: ${sessionDuration} minutes
- Total Detections Attempted: ${detectionStats.totalDetections}
- Successful Detections: ${detectionStats.successfulDetections}
- Generated: ${new Date().toLocaleString()}

Detection History:
${signHistory.map(item => `${item.timestamp} - ${item.sign} (${item.confidence})`).join('\n')}
`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    const filename = `asl_session_${new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-')}.txt`;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    debugLog(`💾 Session saved as: ${filename}`);
  };

  const clearRecognizedText = async () => {
    try {
      // Attempt to clear backend state
      await fetch(`${CONFIG.API_BASE_URL}/api/clear-recognized-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).catch(() => debugLog('Backend clear request failed, continuing with local clear'));
      
    } catch (error) {
      debugLog('Backend clear failed:', error, 'warn');
    }
    
    // Clear all local state
    setRecognizedSigns([]);
    setCurrentSession('');
    setSignHistory([]);
    
    // Reset stability and performance metrics
    setStabilityMetrics({
      lastDetectionTime: Date.now(),
      consecutiveDetections: 0,
      stabilityBuffer: [],
      lastSpokenSign: '',
      lastSpokenTime: 0,
      detectionStreak: 0,
      confidenceHistory: []
    });
    
    setDetectionStats({
      totalDetections: 0,
      successfulDetections: 0,
      averageConfidence: 0,
      sessionStartTime: Date.now(),
      consecutiveFailures: 0,
      lastSuccessTime: Date.now()
    });
    
    // Clear speech queue
    speechQueueRef.current = [];
    speechSynthesis.cancel();
    setSpeaking(false);
    
    debugLog('🗑️ All session data cleared and reset');
  };

  // ==================== ENHANCED CLEANUP ====================
  const cleanup = () => {
    debugLog('🧹 Performing comprehensive cleanup...');
    
    // Stop all detection processes
    stopDetection();
    stopCamera();
    
    // Clear all timers and intervals
    if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    if (stabilityTimerRef.current) clearTimeout(stabilityTimerRef.current);
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    
    // Cancel all speech and clear queue
    speechSynthesis.cancel();
    speechQueueRef.current = [];
    
    // Reset all refs
    detectionIntervalRef.current = null;
    stabilityTimerRef.current = null;
    retryTimeoutRef.current = null;
    isInitializedRef.current = false;
    
    debugLog('✅ Comprehensive cleanup completed');
  };

  // ==================== RENDER ENHANCED UI ====================
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(15, 15, 23, 0.95), rgba(30, 30, 50, 0.95))',
      borderRadius: '32px',
      padding: '32px',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(30px)',
      color: 'white',
      position: 'relative',
      overflow: 'hidden',
      minHeight: '600px'
    }}>
      {/* Animated Background Elements */}
      <div style={{
        position: 'absolute',
        top: '10%',
        right: '10%',
        width: '100px',
        height: '100px',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1), transparent)',
        borderRadius: '50%',
        animation: 'pulse 4s ease-in-out infinite'
      }} />
      
      <div style={{
        position: 'absolute',
        bottom: '15%',
        left: '5%',
        width: '80px',
        height: '80px',
        background: 'radial-gradient(circle, rgba(168, 85, 247, 0.1), transparent)',
        borderRadius: '50%',
        animation: 'pulse 6s ease-in-out infinite reverse'
      }} />

      {/* Enhanced Header with Real-time Stats */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '32px',
        flexWrap: 'wrap',
        gap: '16px',
        zIndex: 1,
        position: 'relative'
      }}>
        <div>
          <h2 style={{ 
            fontSize: '32px', 
            fontWeight: '800', 
            margin: '0 0 12px 0',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 2px 10px rgba(59, 130, 246, 0.3)'
          }}>
            🤟 AI Sign Detection
          </h2>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            {/* Connection Status */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '24px',
              background: apiConnected ? 
                'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.1))' : 
                'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.1))',
              border: `1px solid ${apiConnected ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              boxShadow: apiConnected ? 
                '0 4px 12px rgba(34, 197, 94, 0.2)' : 
                '0 4px 12px rgba(239, 68, 68, 0.2)'
            }}>
              {apiConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
              <span style={{ fontSize: '14px', fontWeight: '600' }}>
                {apiConnected ? 'Connected' : connectionRetries > 0 ? `Retrying (${connectionRetries}/${CONFIG.MAX_RETRY_ATTEMPTS})` : 'Disconnected'}
              </span>
            </div>
            
            {/* Performance Stats */}
            {detectionStats.totalDetections > 0 && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '24px',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(29, 78, 216, 0.1))',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
              }}>
                <Activity size={16} />
                <span style={{ fontSize: '14px', fontWeight: '600' }}>
                  {Math.round((detectionStats.successfulDetections / detectionStats.totalDetections) * 100)}% accuracy
                </span>
              </div>
            )}

            {/* Detection Streak */}
            {stabilityMetrics.detectionStreak > 5 && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '24px',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(147, 51, 234, 0.1))',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                boxShadow: '0 4px 12px rgba(168, 85, 247, 0.2)'
              }}>
                <Zap size={16} />
                <span style={{ fontSize: '14px', fontWeight: '600' }}>
                  {stabilityMetrics.detectionStreak} streak
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Control Panel */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setDebugMode(!debugMode)}
            style={{
              padding: '12px',
              borderRadius: '16px',
              border: 'none',
              background: debugMode ? 
                'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 
                'rgba(107, 114, 128, 0.3)',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: debugMode ? '0 6px 16px rgba(139, 92, 246, 0.4)' : 'none'
            }}
            title="Toggle Debug Mode"
          >
            {debugMode ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>

          <button
            onClick={() => testApiConnectionWithRetry()}
            disabled={apiConnected}
            style={{
              padding: '12px',
              borderRadius: '16px',
              border: 'none',
              background: apiConnected ? 
                'rgba(107, 114, 128, 0.3)' : 
                'linear-gradient(135deg, #f59e0b, #d97706)',
              color: 'white',
              cursor: apiConnected ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              opacity: apiConnected ? 0.5 : 1
            }}
            title="Test API Connection"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Enhanced API Error Display */}
      {apiError && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.1))',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '20px',
          padding: '20px',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 8px 24px rgba(239, 68, 68, 0.2)'
        }}>
          <AlertCircle size={24} style={{ color: '#ef4444', flexShrink: 0 }} />
          <div>
            <div style={{ color: '#fca5a5', fontWeight: '600', marginBottom: '4px' }}>
              System Alert
            </div>
            <span style={{ color: '#fecaca', fontSize: '14px' }}>{apiError}</span>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '32px',
        marginBottom: '32px'
      }}>
        
        {/* Enhanced Video Feed */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.6), rgba(30, 30, 30, 0.4))',
          borderRadius: '24px',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.3)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <h3 style={{ 
            color: 'white', 
            fontSize: '20px', 
            fontWeight: '700', 
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Camera size={24} style={{ color: '#06b6d4' }} />
            Live Camera Feed
            {isProcessing && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                padding: '4px 12px',
                background: 'rgba(34, 197, 94, 0.2)',
                borderRadius: '16px',
                fontSize: '12px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  background: '#22c55e',
                  borderRadius: '50%',
                  animation: 'pulse 1s ease-in-out infinite'
                }} />
                Processing
              </div>
            )}
          </h3>
          
          {/* Video Container with Enhanced Styling */}
          <div style={{ 
            position: 'relative', 
            borderRadius: '16px', 
            overflow: 'hidden',
            background: '#000',
            aspectRatio: '16/9',
            marginBottom: '20px'
          }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block'
              }}
            />
            <canvas
              ref={canvasRef}
              style={{ display: 'none' }}
            />
            
            {/* Enhanced Detection Overlay */}
            {detectionActive && (
              <div style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                background: 'rgba(0, 0, 0, 0.8)',
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: handDetected ? '#22c55e' : '#6b7280',
                  boxShadow: handDetected ? '0 0 20px rgba(34, 197, 94, 0.6)' : 'none',
                  animation: handDetected ? 'pulse 2s ease-in-out infinite' : 'none'
                }} />
                <span style={{ 
                  color: 'white', 
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  {handDetected ? 
                    `${currentDetectedSign || 'Detecting...'} ${signConfidence > 0 ? `(${Math.round(signConfidence * 100)}%)` : ''}` : 
                    'No Hand Detected'
                  }
                </span>
              </div>
            )}

            {/* Speaking Indicator */}
            {speaking && (
              <div style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(34, 197, 94, 0.9)',
                borderRadius: '12px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backdropFilter: 'blur(10px)'
              }}>
                <Volume2 size={16} style={{ color: 'white' }} />
                <span style={{ color: 'white', fontSize: '12px', fontWeight: '600' }}>
                  Speaking
                </span>
              </div>
            )}
          </div>
          
          {/* Enhanced Camera Controls */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={cameraActive ? stopCamera : initializeCamera}
              style={{
                padding: '14px 24px',
                borderRadius: '16px',
                border: 'none',
                background: cameraActive ? 
                  'linear-gradient(135deg, #ef4444, #dc2626)' : 
                  'linear-gradient(135deg, #22c55e, #16a34a)',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                fontWeight: '600',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: cameraActive ? 
                  '0 6px 16px rgba(239, 68, 68, 0.4)' : 
                  '0 6px 16px rgba(34, 197, 94, 0.4)'
              }}
            >
              {cameraActive ? <CameraOff size={18} /> : <Camera size={18} />}
              {cameraActive ? 'Stop Camera' : 'Start Camera'}
            </button>
            
            <button
              onClick={detectionActive ? stopDetection : startDetection}
              disabled={!cameraActive || !apiConnected}
              style={{
                padding: '14px 24px',
                borderRadius: '16px',
                border: 'none',
                background: (!cameraActive || !apiConnected) ? 
                  'rgba(107, 114, 128, 0.3)' :
                  detectionActive ? 
                    'linear-gradient(135deg, #f59e0b, #d97706)' : 
                    'linear-gradient(135deg, #06b6d4, #0891b2)',
                color: 'white',
                cursor: (!cameraActive || !apiConnected) ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                fontWeight: '600',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: (!cameraActive || !apiConnected) ? 0.5 : 1,
                boxShadow: (cameraActive && apiConnected) ? 
                  (detectionActive ? 
                    '0 6px 16px rgba(245, 158, 11, 0.4)' : 
                    '0 6px 16px rgba(6, 182, 212, 0.4)'
                  ) : 'none'
              }}
            >
              {detectionActive ? <Square size={18} /> : <Play size={18} />}
              {detectionActive ? 'Stop Detection' : 'Start Detection'}
            </button>
          </div>
        </div>

        {/* Enhanced Current Detection Status */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.4), rgba(30, 30, 30, 0.4))',
          borderRadius: '24px',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
          position: 'relative'
        }}>
          <h3 style={{ 
            color: 'white', 
            fontSize: '20px', 
            fontWeight: '700', 
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Target size={24} style={{ color: '#8b5cf6' }} />
            Detection Status
          </h3>

          {/* Current Sign Display */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '20px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '32px',
              fontWeight: '800',
              marginBottom: '8px',
              color: currentDetectedSign ? '#3b82f6' : '#6b7280',
              minHeight: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {currentDetectedSign ? formatSignForSpeech(currentDetectedSign) : 'No Sign Detected'}
            </div>
            
            {signConfidence > 0 && (
              <div style={{
                fontSize: '14px',
                color: '#a1a1aa',
                marginBottom: '16px'
              }}>
                Confidence: {Math.round(signConfidence * 100)}%
              </div>
            )}

            {/* Confidence Bar */}
            {signConfidence > 0 && (
              <div style={{
                width: '100%',
                height: '6px',
                background: 'rgba(107, 114, 128, 0.3)',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${signConfidence * 100}%`,
                  height: '100%',
                  background: signConfidence >= CONFIG.MIN_CONFIDENCE ? 
                    'linear-gradient(90deg, #22c55e, #16a34a)' :
                    'linear-gradient(90deg, #f59e0b, #d97706)',
                  borderRadius: '3px',
                  transition: 'all 0.3s ease'
                }} />
              </div>
            )}
          </div>

          {/* Real-time Stats Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '20px'
          }}>
            <div style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ color: '#3b82f6', fontSize: '20px', fontWeight: '700' }}>
                {detectionStats.totalDetections}
              </div>
              <div style={{ color: '#a1a1aa', fontSize: '12px' }}>
                Total Attempts
              </div>
            </div>

            <div style={{
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ color: '#22c55e', fontSize: '20px', fontWeight: '700' }}>
                {detectionStats.successfulDetections}
              </div>
              <div style={{ color: '#a1a1aa', fontSize: '12px' }}>
                Successful
              </div>
            </div>

            <div style={{
              background: 'rgba(168, 85, 247, 0.1)',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ color: '#a855f7', fontSize: '20px', fontWeight: '700' }}>
                {Math.round(detectionStats.averageConfidence * 100)}%
              </div>
              <div style={{ color: '#a1a1aa', fontSize: '12px' }}>
                Avg Confidence
              </div>
            </div>

            <div style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ color: '#f59e0b', fontSize: '20px', fontWeight: '700' }}>
                {stabilityMetrics.consecutiveDetections}
              </div>
              <div style={{ color: '#a1a1aa', fontSize: '12px' }}>
                Consecutive
              </div>
            </div>
          </div>

          {/* Detection Quality Indicator */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <TrendingUp size={20} style={{ 
              color: stabilityMetrics.detectionStreak > 10 ? '#22c55e' : '#f59e0b' 
            }} />
            <div>
              <div style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>
                Detection Quality: {stabilityMetrics.detectionStreak > 10 ? 'Excellent' : 
                  stabilityMetrics.detectionStreak > 5 ? 'Good' : 'Building...'}
              </div>
              <div style={{ color: '#a1a1aa', fontSize: '12px' }}>
                {stabilityMetrics.detectionStreak > 0 ? 
                  `${stabilityMetrics.detectionStreak} stable detections` : 
                  'Establishing stable connection...'
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Recognized Text Section */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.4), rgba(30, 30, 30, 0.4))',
        borderRadius: '24px',
        padding: '28px',
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
            <Hand size={28} style={{ color: '#06b6d4' }} />
            Recognized Speech
            {recognizedSigns.length > 0 && (
              <span style={{
                background: 'rgba(6, 182, 212, 0.2)',
                color: '#67e8f9',
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                {recognizedSigns.length} signs
              </span>
            )}
          </h3>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setTtsEnabled(!ttsEnabled)}
              style={{
                padding: '12px',
                borderRadius: '14px',
                border: 'none',
                background: ttsEnabled ? 
                  'linear-gradient(135deg, #22c55e, #16a34a)' : 
                  'rgba(107, 114, 128, 0.3)',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                transform: speaking ? 'scale(1.05)' : 'scale(1)',
                boxShadow: speaking ? 
                  '0 8px 20px rgba(34, 197, 94, 0.5)' : 
                  ttsEnabled ? '0 4px 12px rgba(34, 197, 94, 0.3)' : 'none'
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
                background: recognizedSigns.length > 0 ? 
                  'linear-gradient(135deg, #06b6d4, #0891b2)' : 
                  'rgba(107, 114, 128, 0.3)',
                color: 'white',
                cursor: recognizedSigns.length > 0 ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s ease',
                opacity: recognizedSigns.length > 0 ? 1 : 0.5,
                boxShadow: recognizedSigns.length > 0 ? '0 4px 12px rgba(6, 182, 212, 0.3)' : 'none'
              }}
              title="Save Session to File"
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
                background: recognizedSigns.length > 0 ? 
                  'linear-gradient(135deg, #ef4444, #dc2626)' : 
                  'rgba(107, 114, 128, 0.3)',
                color: 'white',
                cursor: recognizedSigns.length > 0 ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s ease',
                opacity: recognizedSigns.length > 0 ? 1 : 0.5,
                boxShadow: recognizedSigns.length > 0 ? '0 4px 12px rgba(239, 68, 68, 0.3)' : 'none'
              }}
              title="Clear All Recognized Text"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>
        
        {/* Enhanced Text Display */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          minHeight: '120px',
          position: 'relative'
        }}>
          <div style={{
            color: currentSession ? 'white' : '#6b7280',
            fontSize: '18px',
            lineHeight: '1.6',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            wordWrap: 'break-word'
          }}>
            {currentSession || 'Start detection to see recognized signs appear here...'}
          </div>
          
          {speaking && (
            <div style={{
              position: 'absolute',
              bottom: '16px',
              right: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(34, 197, 94, 0.2)',
              padding: '6px 12px',
              borderRadius: '12px',
              border: '1px solid rgba(34, 197, 94, 0.3)'
            }}>
              <Volume2 size={14} style={{ color: '#22c55e' }} />
              <span style={{ color: '#22c55e', fontSize: '12px', fontWeight: '600' }}>
                Reading aloud...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Detection History */}
      {signHistory.length > 0 && debugMode && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.4), rgba(30, 30, 30, 0.4))',
          borderRadius: '24px',
          padding: '28px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)'
        }}>
          <h3 style={{ 
            color: 'white', 
            fontSize: '20px', 
            fontWeight: '700', 
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Clock size={24} style={{ color: '#f59e0b' }} />
            Detection History
            <span style={{
              background: 'rgba(245, 158, 11, 0.2)',
              color: '#fbbf24',
              padding: '4px 12px',
              borderRadius: '16px',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              Last {signHistory.length}
            </span>
          </h3>
          
          <div style={{
            maxHeight: '300px',
            overflowY: 'auto',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '12px',
            padding: '16px'
          }}>
            {signHistory.slice(-10).reverse().map((item, index) => (
              <div key={index} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                marginBottom: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <span style={{ 
                    color: 'white', 
                    fontWeight: '600',
                    fontSize: '14px'
                  }}>
                    {formatSignForSpeech(item.sign)}
                  </span>
                  <span style={{
                    color: item.trend === 'improving' ? '#22c55e' : 
                           item.trend === 'declining' ? '#ef4444' : '#6b7280',
                    fontSize: '12px',
                    padding: '2px 8px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.1)'
                  }}>
                    {item.trend}
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <span style={{
                    color: parseFloat(item.confidence) >= CONFIG.MIN_CONFIDENCE ? '#22c55e' : '#f59e0b',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {Math.round(parseFloat(item.confidence) * 100)}%
                  </span>
                  <span style={{ color: '#6b7280', fontSize: '12px' }}>
                    {item.timestamp}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add CSS animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default SignToTextModule;
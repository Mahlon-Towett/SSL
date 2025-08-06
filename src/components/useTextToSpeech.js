// useTextToSpeech.js - Optimized Text-to-Speech Hook
import { useState, useRef, useCallback, useEffect } from 'react';

export const useTextToSpeech = (debugMode = true) => {
  // States
  const [isEnabled, setIsEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [ttsError, setTtsError] = useState('');

  // Refs for performance
  const speechSynthRef = useRef(null);
  const currentUtteranceRef = useRef(null);
  const speakQueueRef = useRef([]);
  const isInitializedRef = useRef(false);
  const lastSpokenTextRef = useRef('');
  const lastSpokenTimeRef = useRef(0);

  // Optimized configuration for fast PC
  const CONFIG = {
    RATE: 1.2,           // Faster speech rate for quick feedback
    PITCH: 1.0,          // Normal pitch
    VOLUME: 0.9,         // High volume
    DUPLICATE_THRESHOLD: 1500,  // Prevent same word within 1.5s
    QUEUE_PROCESSING_DELAY: 50,  // Very fast queue processing
    VOICE_SELECTION_PRIORITY: [
      // Premium voices first (fastest and highest quality)
      /Google.*US.*Enhanced|Premium/i,
      /Microsoft.*Zira|David.*Premium/i,
      /Alex|Samantha/i,  // macOS premium voices
      
      // Good quality native voices
      /Google.*US/i,
      /Microsoft.*US/i,
      /English.*US.*Natural/i,
      
      // Fallback voices
      /en-US.*local/i,
      /en-US/i,
      /English/i
    ]
  };

  // Debug logger
  const debugLog = useCallback((message, data = null, level = 'info') => {
    if (debugMode || level === 'error') {
      const timestamp = new Date().toLocaleTimeString();
      const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '🔊';
      console.log(`[${timestamp}] ${prefix} TTS: ${message}`, data || '');
    }
  }, [debugMode]);

  // Initialize TTS system
  const initializeTTS = useCallback(async () => {
    try {
      debugLog('🚀 Initializing optimized TTS system...');

      if (!window.speechSynthesis) {
        throw new Error('Speech synthesis not supported in this browser');
      }

      speechSynthRef.current = window.speechSynthesis;

      // Load voices with optimization for fast systems
      return new Promise((resolve) => {
        let voiceLoadAttempts = 0;
        const maxAttempts = 20; // More attempts for thorough loading

        const loadVoices = () => {
          const voices = speechSynthRef.current.getVoices();
          voiceLoadAttempts++;

          debugLog(`Voice loading attempt ${voiceLoadAttempts}: found ${voices.length} voices`);

          if (voices.length > 0) {
            setAvailableVoices(voices);
            
            // Select best voice using priority system
            const bestVoice = selectOptimalVoice(voices);
            setSelectedVoice(bestVoice);
            
            debugLog(`✅ TTS initialized with ${voices.length} voices`);
            debugLog(`🎤 Selected voice: ${bestVoice?.name || 'Default'} (${bestVoice?.lang || 'unknown'})`);
            
            isInitializedRef.current = true;
            setTtsError('');
            resolve(true);
          } else if (voiceLoadAttempts < maxAttempts) {
            // Fast retry for responsive systems
            setTimeout(loadVoices, 50);
          } else {
            debugLog('⚠️ No voices found after maximum attempts, using default', null, 'warn');
            isInitializedRef.current = true;
            resolve(false);
          }
        };

        // Handle voice change events
        speechSynthRef.current.onvoiceschanged = loadVoices;
        
        // Start loading immediately
        loadVoices();
      });

    } catch (error) {
      debugLog('❌ TTS initialization failed:', error, 'error');
      setTtsError(`TTS initialization failed: ${error.message}`);
      setIsEnabled(false);
      return false;
    }
  }, [debugLog]);

  // Optimized voice selection for fast, high-quality speech
  const selectOptimalVoice = useCallback((voices) => {
    debugLog('🔍 Selecting optimal voice from available options...');
    
    // Log available voices for debugging
    debugLog(`Available voices: ${voices.map(v => `${v.name} (${v.lang})`).join(', ')}`);

    for (const priority of CONFIG.VOICE_SELECTION_PRIORITY) {
      const matchingVoices = voices.filter(voice => {
        const matches = priority.test(`${voice.name} ${voice.lang}`) && voice.localService;
        if (matches) {
          debugLog(`✓ Voice matches priority ${priority}: ${voice.name}`);
        }
        return matches;
      });

      if (matchingVoices.length > 0) {
        // Prefer the first match (usually highest quality)
        const selectedVoice = matchingVoices[0];
        debugLog(`🏆 Selected optimal voice: ${selectedVoice.name} (${selectedVoice.lang})`);
        return selectedVoice;
      }
    }

    // Fallback to any English voice
    const englishVoices = voices.filter(v => v.lang.startsWith('en'));
    if (englishVoices.length > 0) {
      debugLog(`📢 Using fallback English voice: ${englishVoices[0].name}`);
      return englishVoices[0];
    }

    // Final fallback to default
    debugLog('📢 Using system default voice');
    return voices[0] || null;
  }, [debugLog]);

  // Optimized speech function with queue management
  const speak = useCallback((text, options = {}) => {
    if (!isEnabled || !isInitializedRef.current) {
      debugLog('⚠️ TTS not enabled or not initialized');
      return false;
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      debugLog('⚠️ Invalid text provided for speech');
      return false;
    }

    const normalizedText = text.trim().toUpperCase();
    const currentTime = Date.now();

    // Intelligent duplicate prevention
    if (normalizedText === lastSpokenTextRef.current && 
        currentTime - lastSpokenTimeRef.current < CONFIG.DUPLICATE_THRESHOLD) {
      debugLog(`🔇 Skipping duplicate text: "${normalizedText}"`);
      return false;
    }

    // Update last spoken tracking
    lastSpokenTextRef.current = normalizedText;
    lastSpokenTimeRef.current = currentTime;

    // Create optimized utterance
    const utteranceConfig = {
      text: formatTextForSpeech(normalizedText),
      rate: options.rate || CONFIG.RATE,
      pitch: options.pitch || CONFIG.PITCH,
      volume: options.volume || CONFIG.VOLUME,
      voice: selectedVoice,
      priority: options.priority || 'normal' // normal, high, immediate
    };

    debugLog(`🗣️ Speaking: "${utteranceConfig.text}" (rate: ${utteranceConfig.rate})`);

    // Handle priority speaking
    if (options.priority === 'immediate') {
      // Cancel current speech and speak immediately
      stopSpeaking();
      speakImmediate(utteranceConfig);
    } else if (options.priority === 'high') {
      // Add to front of queue
      speakQueueRef.current.unshift(utteranceConfig);
      processQueue();
    } else {
      // Normal priority - add to queue
      speakQueueRef.current.push(utteranceConfig);
      processQueue();
    }

    return true;
  }, [isEnabled, selectedVoice, debugLog]);

  // Immediate speech without queue
  const speakImmediate = useCallback((config) => {
    try {
      const utterance = new SpeechSynthesisUtterance(config.text);
      utterance.rate = config.rate;
      utterance.pitch = config.pitch;
      utterance.volume = config.volume;
      
      if (config.voice) {
        utterance.voice = config.voice;
      }

      // Optimized event handlers
      utterance.onstart = () => {
        setIsSpeaking(true);
        debugLog(`▶️ Speech started: "${config.text}"`);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
        debugLog(`✅ Speech completed: "${config.text}"`);
        
        // Process next in queue immediately
        setTimeout(processQueue, CONFIG.QUEUE_PROCESSING_DELAY);
      };

      utterance.onerror = (event) => {
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
        debugLog(`❌ Speech error: ${event.error} for "${config.text}"`, event, 'error');
        
        // Continue processing queue even after error
        setTimeout(processQueue, CONFIG.QUEUE_PROCESSING_DELAY);
      };

      currentUtteranceRef.current = utterance;
      speechSynthRef.current.speak(utterance);

    } catch (error) {
      debugLog('❌ Immediate speech failed:', error, 'error');
      setIsSpeaking(false);
    }
  }, [debugLog]);

  // Optimized queue processing
  const processQueue = useCallback(() => {
    if (isSpeaking || speakQueueRef.current.length === 0) {
      return;
    }

    const nextConfig = speakQueueRef.current.shift();
    debugLog(`🎵 Processing queue item: "${nextConfig.text}" (${speakQueueRef.current.length} remaining)`);
    
    speakImmediate(nextConfig);
  }, [isSpeaking, speakImmediate, debugLog]);

  // Format text for optimal speech
  const formatTextForSpeech = useCallback((text) => {
    // Sign language specific formatting
    const signFormatting = {
      'HELLO': 'Hello',
      'THANKS': 'Thank you',
      'THANK_YOU': 'Thank you',
      'YES': 'Yes',
      'NO': 'No',
      'PLEASE': 'Please',
      'GOOD': 'Good',
      'BEAUTIFUL': 'Beautiful',
      'BETTER': 'Better',
      'HAPPY': 'Happy',
      'GREAT': 'Great',
      'NAME': 'Name',
      'MY': 'My',
      'LOOK': 'Look',
      'TALK': 'Talk',
      'SAY': 'Say',
      'ASK': 'Ask',
      'EAT': 'Eat',
      'DRINK': 'Drink'
    };

    const formatted = signFormatting[text.toUpperCase()] || text;
    debugLog(`📝 Formatted "${text}" → "${formatted}"`);
    return formatted;
  }, [debugLog]);

  // Control functions
  const stopSpeaking = useCallback(() => {
    if (speechSynthRef.current && isSpeaking) {
      debugLog('🛑 Stopping current speech');
      speechSynthRef.current.cancel();
      setIsSpeaking(false);
      currentUtteranceRef.current = null;
    }
  }, [isSpeaking, debugLog]);

  const clearQueue = useCallback(() => {
    debugLog(`🗑️ Clearing speech queue (${speakQueueRef.current.length} items)`);
    speakQueueRef.current = [];
  }, [debugLog]);

  const pauseSpeaking = useCallback(() => {
    if (speechSynthRef.current && isSpeaking) {
      speechSynthRef.current.pause();
      debugLog('⏸️ Speech paused');
    }
  }, [isSpeaking, debugLog]);

  const resumeSpeaking = useCallback(() => {
    if (speechSynthRef.current) {
      speechSynthRef.current.resume();
      debugLog('▶️ Speech resumed');
    }
  }, [debugLog]);

  // Initialize on mount
  useEffect(() => {
    initializeTTS();
  }, [initializeTTS]);

  return {
    // State
    isEnabled,
    isSpeaking,
    availableVoices,
    selectedVoice,
    ttsError,
    isInitialized: isInitializedRef.current,

    // Core functions
    speak,
    stopSpeaking,
    clearQueue,
    pauseSpeaking,
    resumeSpeaking,

    // Configuration
    setEnabled: setIsEnabled,
    setVoice: setSelectedVoice,

    // Utilities
    formatTextForSpeech,
    queueLength: speakQueueRef.current.length
  };
};
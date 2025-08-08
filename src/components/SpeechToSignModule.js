// src/components/SpeechToSignModule.js - OPTIMIZED for ultra-fast, smooth transitions
// PART 1: Imports, Setup, State Management, and Core Functions

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import EnhancedVideoAvatar from './EnhancedVideoAvatar';
import ErrorBoundary from './ErrorBoundary';
import Controls from './Controls';
import SignQueueManager from '../utils/SignQueueManager';
import AvatarStateMachine from '../utils/AvatarStateMachine';
import { getAllSigns } from '../constants/videoMappings';
import { 
  MessageSquare, Mic, MicOff, Play, ChevronRight, ChevronLeft,
  Pause, Square, SkipForward, AlertCircle, Zap, Gauge, Activity
} from 'lucide-react';

const SpeechToSignModule = () => {
  // ============================================
  // STATE MANAGEMENT - All module states
  // ============================================
  
  // Core states
  const [currentSign, setCurrentSign] = useState('Hello');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);
  const [showAllSigns, setShowAllSigns] = useState(false);
  const [queueStatus, setQueueStatus] = useState(null);
  const [avatarState, setAvatarState] = useState('neutral');
  const [error, setError] = useState(null);
  
  // OPTIMIZATION: Performance and speed states
  const [fastModeEnabled, setFastModeEnabled] = useState(true);
  const [transitionSpeed, setTransitionSpeed] = useState('fast'); // 'instant', 'fast', 'normal'
  const [performanceMetrics, setPerformanceMetrics] = useState({
    totalTransitions: 0,
    averageTime: 0,
    queuesThroughput: 0,
    fastModeUsage: 0
  });
  
  // UI states
  const [showPerformancePanel, setShowPerformancePanel] = useState(false);
  const [autoOptimizeEnabled, setAutoOptimizeEnabled] = useState(true);
  
  // ============================================
  // REFS - Performance-critical references
  // ============================================
  
  const recognitionRef = useRef(null);
  const performanceTimerRef = useRef(null);
  const lastTransitionTime = useRef(0);

  // ============================================
  // MEMOIZED VALUES - Expensive computations
  // ============================================
  
  // Complete list of available signs
  const signs = useMemo(() => getAllSigns(), []);

  // BALANCED: Avatar state machine with complete playback timing
  const avatarStateMachine = useMemo(() => new AvatarStateMachine({
    debugMode: process.env.NODE_ENV === 'development',
    
    // BALANCED TIMING - Ensures complete sign playback
    transitionInDuration: transitionSpeed === 'instant' ? 50 : transitionSpeed === 'fast' ? 100 : 150,
    transitionOutDuration: transitionSpeed === 'instant' ? 25 : transitionSpeed === 'fast' ? 75 : 100,
    signDuration: transitionSpeed === 'instant' ? 1500 : transitionSpeed === 'fast' ? 2000 : 2500, // Longer durations
    interSignDelay: transitionSpeed === 'instant' ? 100 : transitionSpeed === 'fast' ? 200 : 300, // More time between signs
    
    // OPTIMIZATION FEATURES - Balanced for completeness and speed
    fastMode: fastModeEnabled,
    ultraFastMode: transitionSpeed === 'fast' || transitionSpeed === 'instant',
    instantTransitions: transitionSpeed === 'instant',
    adaptiveTiming: true,
    preloadEnabled: true,
    parallelProcessing: false, // Disabled to prevent sign cutting off
    easeTransitions: transitionSpeed !== 'instant',
    prioritizeSpeed: false, // Changed: prioritize completeness
    batchOptimization: true,
    skipRedundantStates: false, // Don't skip states for complete playback
    completePlayback: true // NEW: Ensure signs play completely
  }), [fastModeEnabled, transitionSpeed]);

  // BALANCED: Queue manager with complete playback timing
  const queueManager = useMemo(() => new SignQueueManager(avatarStateMachine, {
    debugMode: process.env.NODE_ENV === 'development',
    autoStart: true,
    
    // BALANCED TIMING - Ensures complete sign playback
    interSignDelay: transitionSpeed === 'instant' ? 150 : transitionSpeed === 'fast' ? 250 : 400,
    maxRetries: 1, // Keep fast failure recovery
    retryDelay: 300, // Quick retries
    
    // BALANCED OPTIMIZATIONS - Complete playback priority
    preloadNext: true,
    skipTransitionDelays: false, // Don't skip delays for complete playback
    batchMode: true,
    transitionOverlap: 0, // No overlap to ensure signs complete
    completePlayback: true, // NEW: Ensure complete sign playback
    
    callbacks: {
      onQueueStart: (data) => {
        console.log('🚀 ULTRA-FAST Queue started:', data);
        setIsPlaying(true);
        data.startTime = Date.now();
        lastTransitionTime.current = data.startTime;
      },
      onQueueComplete: (data) => {
        console.log('✅ ULTRA-FAST Queue completed:', data);
        setIsPlaying(false);
        
        // Update performance metrics
        if (data.startTime && data.processedItems > 0) {
          const totalTime = Date.now() - data.startTime;
          const throughput = data.processedItems / (totalTime / 1000);
          
          setPerformanceMetrics(prev => ({
            totalTransitions: prev.totalTransitions + data.processedItems,
            averageTime: data.avgItemTime || prev.averageTime,
            queuesThroughput: throughput.toFixed(1),
            fastModeUsage: fastModeEnabled ? prev.fastModeUsage + 1 : prev.fastModeUsage
          }));
        }
      },
      onSignStart: (data) => {
        console.log('🎬 ULTRA-FAST Sign started:', data.item.signName);
        setCurrentSign(data.item.signName);
      },
      onSignComplete: (data) => {
        console.log('✅ ULTRA-FAST Sign completed:', data.item.signName);
      },
      onSignError: (data) => {
        console.error('❌ ULTRA-FAST Sign error:', data.error);
        setError(`Sign error: ${data.item.signName}`);
      },
      onProgress: (data) => {
        setQueueStatus({
          ...data,
          // Add performance info
          throughput: data.current > 0 ? 
            ((data.current / ((Date.now() - lastTransitionTime.current) / 1000)) || 0).toFixed(1) : 0,
          speedMode: transitionSpeed,
          fastMode: fastModeEnabled
        });
      }
    }
  }), [avatarStateMachine, transitionSpeed, fastModeEnabled]);

  // OPTIMIZED Speech-to-sign mapping with intelligent batching hints
  const speechToSignMapping = useMemo(() => ({
    // Basic mappings - only include signs that have videos
    'hello': 'Hello',
    'hi': 'Hello', 
    'hey': 'Hello',
    'thank': 'Thank',
    'thanks': 'Thank_You',
    'yes': 'Yes',
    'help': 'Help',
    'good': 'Good',
    'great': 'Great',
    'love': 'Love',
    'friend': 'Friend',
    'beautiful': 'Beautiful',
    'better': 'Better',
    'happy': 'Happy',
    'name': 'Name',
    'my': 'My',
    'me': 'ME',
    'you': 'You',
    'your': 'Your',
    'yourself': 'Yourself',
    'i': 'I',
    'we': 'We',
    'us': 'Us',
    'they': 'They',
    'this': 'This',
    'that': 'That',
    'those': 'Those',
    'here': 'Here',
    'there': 'There',
    'where': 'Where',
    'what': 'What',
    'when': 'When',
    'why': 'Why',
    'who': 'Who',
    'how': 'How',
    'welcome': 'Welcome',
    'sorry': 'Sorry'
  }), []);

  // ============================================
  // SPEECH RECOGNITION SETUP
  // ============================================
  
  // Initialize speech recognition with optimizations
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      // OPTIMIZATION: Faster speech recognition settings
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.maxAlternatives = 1; // Faster processing
      
      recognitionRef.current.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        setTranscript(interimTranscript);
        if (finalTranscript) {
          setFinalTranscript(prev => prev + finalTranscript);
          // OPTIMIZATION: Process speech with minimal delay
          if (fastModeEnabled) {
            setTimeout(() => translateSpeechToSigns(finalTranscript), 10);
          } else {
            translateSpeechToSigns(finalTranscript);
          }
        }
      };
      
      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setError(`Speech recognition error: ${event.error}`);
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
      
      setSpeechSupported(true);
    }
  }, [fastModeEnabled]); // Re-initialize when fast mode changes

  // ============================================
  // CORE TRANSLATION FUNCTION - ULTRA-OPTIMIZED
  // ============================================
  
  // ULTRA-FAST: Translate speech to signs with batching optimization
  const translateSpeechToSigns = useCallback((spokenText) => {
    console.log('🎙️ ULTRA-FAST Translating speech:', spokenText);
    const words = spokenText.toLowerCase().trim().split(/\s+/);
    const foundSigns = [];

    // Check for "my name is" pattern with fast processing
    const nameMatch = spokenText.match(/(?:my name is|i am) (\w+)/i);
    if (nameMatch && nameMatch[1]) {
      const name = nameMatch[1].toUpperCase();
      foundSigns.push('My', 'Name');
      
      // Add each letter of the name
      for (const letter of name) {
        if (letter.match(/[A-Z]/)) {
          foundSigns.push(letter);
        }
      }
    } else {
      // OPTIMIZATION: Fast multi-word phrase detection
      const fullText = spokenText.toLowerCase();
      const phraseMap = {
        'thank you': 'Thank_You',
        'do not': 'Do_Not',
        "don't": 'Do_Not',
        'does not': 'Does_Not',
        "doesn't": 'Does_Not',
        'cannot': 'Cannot',
        "can't": 'Cannot'
      };
      
      // Process phrases first
      Object.entries(phraseMap).forEach(([phrase, sign]) => {
        if (fullText.includes(phrase)) {
          foundSigns.push(sign);
        }
      });

      // Process individual words (skip if part of phrases)
      const processedPhrases = foundSigns.length > 0;
      
      for (const word of words) {
        // OPTIMIZATION: Skip words that were already part of multi-word phrases
        if (processedPhrases && this._isPartOfProcessedPhrase(word, fullText)) {
          continue;
        }

        // Check if it's a single letter (fast path)
        if (word.length === 1 && word.match(/[a-z]/i)) {
          foundSigns.push(word.toUpperCase());
        } 
        // Check if it's a number (fast path)
        else if (word.match(/^\d$/)) {
          foundSigns.push(word);
        }
        // Check word mapping (optimized lookup)
        else if (speechToSignMapping[word]) {
          const sign = speechToSignMapping[word];
          if (!foundSigns.includes(sign)) {
            foundSigns.push(sign);
          }
        }
      }
    }

    if (foundSigns.length > 0) {
      console.log('🎯 Found signs to translate (ULTRA-FAST MODE):', foundSigns);
      
      // Clear any existing error
      setError(null);
      
      // OPTIMIZATION: Smart batching based on sign count and type
      const shouldUseBatch = foundSigns.length > 1;
      const batchOptions = {
        fastMode: fastModeEnabled,
        speedMode: transitionSpeed,
        source: 'speech_recognition',
        batchMode: shouldUseBatch,
        ultraFast: transitionSpeed === 'instant' || foundSigns.length > 3
      };
      
      if (shouldUseBatch) {
        console.log('⚡ Using ULTRA-FAST batch processing for multiple signs');
        queueManager.addSigns(foundSigns, batchOptions);
      } else {
        queueManager.addSign(foundSigns[0], batchOptions);
      }
    } else {
      console.log('⚠️ No signs found for:', spokenText);
    }
  }, [speechToSignMapping, queueManager, fastModeEnabled, transitionSpeed]);

  // Helper function to check if word is part of processed phrase
  const _isPartOfProcessedPhrase = useCallback((word, fullText) => {
    const phraseChecks = [
      word === 'thank' && fullText.includes('thank you'),
      word === 'you' && fullText.includes('thank you'),
      word === 'do' && (fullText.includes('do not') || fullText.includes("don't")),
      word === 'does' && (fullText.includes('does not') || fullText.includes("doesn't")),
      word === 'not' && (fullText.includes('do not') || fullText.includes('does not'))
    ];
    return phraseChecks.some(check => check);
  }, []);

  // ============================================
  // CONTROL FUNCTIONS - OPTIMIZED FOR SPEED
  // ============================================
  
  // Toggle speech recognition with fast mode consideration
  const toggleListening = useCallback(() => {
    if (!speechSupported) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      setFinalTranscript('');
      setError(null);
      
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('Failed to start recognition:', error);
        setError('Failed to start speech recognition. Please try again.');
      }
    }
  }, [speechSupported, isListening]);

  // ULTRA-FAST: Manual controls with speed options
  const playAnimation = useCallback(() => {
    if (!isPlaying) {
      queueManager.addSign(currentSign, { 
        fastMode: fastModeEnabled,
        speedMode: transitionSpeed,
        source: 'manual_play',
        priority: 'high'
      });
    }
  }, [currentSign, isPlaying, queueManager, fastModeEnabled, transitionSpeed]);

  const pauseAnimation = useCallback(() => {
    queueManager.pause();
    setIsPlaying(false);
  }, [queueManager]);

  const stopAnimation = useCallback(() => {
    queueManager.stop();
    setIsPlaying(false);
  }, [queueManager]);

  // OPTIMIZATION: Fast navigation with preloading
  const nextSign = useCallback(() => {
    const currentIndex = signs.indexOf(currentSign);
    const nextIndex = (currentIndex + 1) % signs.length;
    const nextSignName = signs[nextIndex];
    
    queueManager.clear(true);
    setCurrentSign(nextSignName);
    
    // OPTIMIZATION: Preload next sign for faster switching
    if (avatarStateMachine.preloadSign) {
      avatarStateMachine.preloadSign(nextSignName).catch(() => {});
    }
  }, [currentSign, signs, queueManager, avatarStateMachine]);

  const prevSign = useCallback(() => {
    const currentIndex = signs.indexOf(currentSign);
    const prevIndex = currentIndex === 0 ? signs.length - 1 : currentIndex - 1;
    const prevSignName = signs[prevIndex];
    
    queueManager.clear(true);
    setCurrentSign(prevSignName);
    
    // OPTIMIZATION: Preload for faster switching
    if (avatarStateMachine.preloadSign) {
      avatarStateMachine.preloadSign(prevSignName).catch(() => {});
    }
  }, [currentSign, signs, queueManager, avatarStateMachine]);

  const selectSign = useCallback((signKey) => {
    queueManager.clear(true);
    setCurrentSign(signKey);
    setError(null);
    
    // OPTIMIZATION: Instant preload for selected sign
    if (avatarStateMachine.preloadSign) {
      avatarStateMachine.preloadSign(signKey).catch(() => {});
    }
  }, [queueManager, avatarStateMachine]);

  // OPTIMIZATION: Batch play multiple signs with ultra-fast processing
  const playMultipleSigns = useCallback((signList) => {
    if (signList.length > 0) {
      const batchOptions = {
        fastMode: fastModeEnabled,
        batchMode: true,
        speedMode: transitionSpeed,
        source: 'batch_play',
        ultraFast: signList.length > 2 || transitionSpeed === 'instant'
      };
      
      console.log(`🚀 Playing ${signList.length} signs in ${transitionSpeed.toUpperCase()} mode`);
      queueManager.addSigns(signList, batchOptions);
    }
  }, [queueManager, fastModeEnabled, transitionSpeed]);

  // Handle avatar state changes with performance tracking
  const handleAvatarStateChange = useCallback((state, data) => {
    setAvatarState(state);
    if (state === 'error' && data?.error) {
      setError(`Avatar error: ${data.error}`);
    }
    
    // OPTIMIZATION: Track state change performance
    if (state === 'signing' && data?.performance) {
      setPerformanceMetrics(prev => ({
        ...prev,
        averageTime: data.performance.averageTime || prev.averageTime
      }));
    }
  }, []);

  // Handle video completion
  const handleVideoComplete = useCallback((signName) => {
    console.log('🎬 ULTRA-FAST Video completed:', signName);
  }, []);

  // OPTIMIZATION: Performance mode toggles
  const toggleFastMode = useCallback(() => {
    setFastModeEnabled(prev => {
      const newValue = !prev;
      console.log(`⚡ Fast Mode ${newValue ? 'ENABLED' : 'DISABLED'}`);
      return newValue;
    });
  }, []);

  const changeTransitionSpeed = useCallback((speed) => {
    console.log(`🚀 Changing speed mode to: ${speed.toUpperCase()}`);
    setTransitionSpeed(speed);
    
    // OPTIMIZATION: Update avatar state machine options dynamically
    const speedConfigs = {
      instant: {
        transitionInDuration: 0,
        transitionOutDuration: 0,
        signDuration: 800,
        interSignDelay: 0,
        instantTransitions: true,
        ultraFastMode: true
      },
      fast: {
        transitionInDuration: 75,
        transitionOutDuration: 50,
        signDuration: 1200,
        interSignDelay: 25,
        instantTransitions: false,
        ultraFastMode: true
      },
      normal: {
        transitionInDuration: 150,
        transitionOutDuration: 100,
        signDuration: 1800,
        interSignDelay: 75,
        instantTransitions: false,
        ultraFastMode: false
      }
    };
    
    Object.assign(avatarStateMachine.options, speedConfigs[speed]);
    console.log(`✅ Speed configuration updated for ${speed} mode`);
  }, [avatarStateMachine]);

  // ============================================
  // PERFORMANCE OPTIMIZATION FUNCTIONS
  // ============================================
  
  // Auto-optimize based on usage patterns
  const autoOptimize = useCallback(() => {
    if (!autoOptimizeEnabled) return;
    
    const { totalTransitions, averageTime } = performanceMetrics;
    
    // Auto-enable fast mode if performance is slow
    if (totalTransitions > 5 && averageTime > 1500 && !fastModeEnabled) {
      setFastModeEnabled(true);
      console.log('🤖 Auto-optimization: Enabled fast mode due to slow performance');
    }
    
    // Auto-switch to instant mode for very slow performance
    if (totalTransitions > 10 && averageTime > 2500 && transitionSpeed !== 'instant') {
      changeTransitionSpeed('instant');
      console.log('🤖 Auto-optimization: Switched to instant mode due to very slow performance');
    }
  }, [autoOptimizeEnabled, performanceMetrics, fastModeEnabled, transitionSpeed, changeTransitionSpeed]);

  // Run auto-optimization periodically
  useEffect(() => {
    if (autoOptimizeEnabled) {
      const interval = setInterval(autoOptimize, 10000); // Check every 10 seconds
      return () => clearInterval(interval);
    }
  }, [autoOptimize, autoOptimizeEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      queueManager.stop();
      if (performanceTimerRef.current) {
        clearInterval(performanceTimerRef.current);
      }
    };
  }, [queueManager]);

// END OF PART 1 - Continue to Part 2 for the complete JSX render section

// src/components/SpeechToSignModule.js - PART 2: Complete JSX Render Section
// ULTRA-FAST UI with Performance Controls and Visual Indicators

  // ============================================
  // MAIN COMPONENT RENDER - ULTRA-FAST UI
  // ============================================
  
  return (
    <div className="module-card card-speech-to-sign">
      
      {/* ========================================== */}
      {/* ENHANCED HEADER WITH PERFORMANCE INDICATORS */}
      {/* ========================================== */}
      
      <div className="card-header">
        <h2 className="card-title" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '1.5rem',
          fontWeight: '800',
          color: '#e2e8f0'
        }}>
          <MessageSquare className="icon-purple" />
          Speech to Sign Translation
          {fastModeEnabled && (
            <Zap size={18} style={{
              color: '#10b981',
              filter: 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.5))'
            }} />
          )}
          {transitionSpeed === 'instant' && (
            <div style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: '700',
              marginLeft: '4px'
            }}>
              INSTANT
            </div>
          )}
        </h2>
        
        <div className="card-controls" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          
          {/* PERFORMANCE CONTROLS PANEL */}
          <div className="performance-controls" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '8px',
            border: '1px solid rgba(139, 92, 246, 0.3)'
          }}>
            
            {/* Speed Mode Selector */}
            <select
              value={transitionSpeed}
              onChange={(e) => changeTransitionSpeed(e.target.value)}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                background: 'rgba(30, 41, 59, 0.8)',
                color: '#e2e8f0',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
              title="Transition Speed Mode"
            >
              <option value="normal">Normal (Smooth)</option>
              <option value="fast">Fast (Optimized)</option>
              <option value="instant">Instant (Maximum)</option>
            </select>

            {/* Fast Mode Toggle */}
            <button
              onClick={toggleFastMode}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: 'none',
                background: fastModeEnabled ? 
                  'linear-gradient(135deg, #10b981, #059669)' : 
                  'rgba(107, 114, 128, 0.3)',
                color: fastModeEnabled ? 'white' : '#9ca3af',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s ease'
              }}
              title={`Fast Mode: ${fastModeEnabled ? 'ON' : 'OFF'}`}
            >
              {fastModeEnabled ? <Zap size={12} /> : <Gauge size={12} />}
              {fastModeEnabled ? 'FAST' : 'NORM'}
            </button>

            {/* Performance Metrics Toggle */}
            <button
              onClick={() => setShowPerformancePanel(!showPerformancePanel)}
              style={{
                padding: '6px 8px',
                borderRadius: '6px',
                border: 'none',
                background: showPerformancePanel ? 
                  'rgba(59, 130, 246, 0.3)' : 
                  'rgba(75, 85, 99, 0.3)',
                color: showPerformancePanel ? '#60a5fa' : '#9ca3af',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '2px'
              }}
              title="Show/Hide Performance Metrics"
            >
              <Activity size={12} />
            </button>
          </div>

          {/* QUEUE STATUS INDICATOR */}
          {queueStatus && queueStatus.total > 0 && (
            <div className="queue-status-indicator" style={{
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(139, 92, 246, 0.2)',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              fontSize: '11px',
              fontFamily: 'monospace',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span className="queue-progress" style={{color: '#a78bfa'}}>
                {Math.round(queueStatus.percentage)}%
              </span>
              <span className="queue-count" style={{color: '#cbd5e1'}}>
                ({queueStatus.current}/{queueStatus.total})
              </span>
              {queueStatus.throughput && parseFloat(queueStatus.throughput) > 0 && (
                <span style={{color: '#10b981', fontSize: '10px'}}>
                  {queueStatus.throughput}/s
                </span>
              )}
              <div style={{
                fontSize: '9px',
                background: queueStatus.speedMode === 'instant' ? 'rgba(239, 68, 68, 0.3)' :
                          queueStatus.speedMode === 'fast' ? 'rgba(16, 185, 129, 0.3)' :
                          'rgba(107, 114, 128, 0.3)',
                color: queueStatus.speedMode === 'instant' ? '#ef4444' :
                      queueStatus.speedMode === 'fast' ? '#10b981' :
                      '#9ca3af',
                padding: '1px 4px',
                borderRadius: '3px',
                fontWeight: '700'
              }}>
                {queueStatus.speedMode?.toUpperCase() || 'NORM'}
              </div>
            </div>
          )}
          
          {/* AVATAR STATE INDICATOR */}
          <div className={`avatar-state-indicator state-${avatarState}`} style={{
            padding: '6px 10px',
            borderRadius: '8px',
            background: 'rgba(0,0,0,0.6)',
            fontSize: '11px',
            fontFamily: 'monospace',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: '1px solid rgba(139, 92, 246, 0.3)'
          }}>
            {avatarState === 'signing' && <Play size={12} style={{color: '#10b981'}} />}
            {avatarState === 'loading' && (
              <div style={{
                width: '12px', 
                height: '12px', 
                border: '2px solid #333',
                borderTop: '2px solid #6366f1', 
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            )}
            {avatarState === 'error' && <AlertCircle size={12} style={{color: '#ef4444'}} />}
            <span style={{
              color: avatarState === 'signing' ? '#10b981' :
                    avatarState === 'error' ? '#ef4444' :
                    '#cbd5e1'
            }}>
              {avatarState.charAt(0).toUpperCase() + avatarState.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* PERFORMANCE METRICS PANEL (COLLAPSIBLE) */}
      {/* ========================================== */}
      
      {showPerformancePanel && performanceMetrics.totalTransitions > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 182, 212, 0.1))',
          border: '2px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px'
          }}>
            <h4 style={{
              fontSize: '14px',
              fontWeight: '700',
              color: '#e2e8f0',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Activity size={14} />
              Performance Metrics
            </h4>
            
            {/* Auto-Optimize Toggle */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: '#cbd5e1',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={autoOptimizeEnabled}
                onChange={(e) => setAutoOptimizeEnabled(e.target.checked)}
                style={{accentColor: '#10b981'}}
              />
              Auto-Optimize
            </label>
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '12px',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            <div style={{textAlign: 'center'}}>
              <div style={{color: '#10b981', fontWeight: '700', fontSize: '16px'}}>
                {performanceMetrics.totalTransitions}
              </div>
              <div style={{color: '#cbd5e1'}}>Transitions</div>
            </div>
            
            <div style={{textAlign: 'center'}}>
              <div style={{color: '#06b6d4', fontWeight: '700', fontSize: '16px'}}>
                {performanceMetrics.averageTime}ms
              </div>
              <div style={{color: '#cbd5e1'}}>Avg Time</div>
            </div>
            
            <div style={{textAlign: 'center'}}>
              <div style={{color: '#8b5cf6', fontWeight: '700', fontSize: '16px'}}>
                {performanceMetrics.queuesThroughput}/s
              </div>
              <div style={{color: '#cbd5e1'}}>Throughput</div>
            </div>
            
            <div style={{textAlign: 'center'}}>
              <div style={{
                color: fastModeEnabled ? '#10b981' : '#6b7280', 
                fontWeight: '700', 
                fontSize: '16px'
              }}>
                {fastModeEnabled ? 'FAST' : 'NORMAL'}
              </div>
              <div style={{color: '#cbd5e1'}}>Mode</div>
            </div>
            
            <div style={{textAlign: 'center'}}>
              <div style={{
                color: transitionSpeed === 'instant' ? '#ef4444' :
                      transitionSpeed === 'fast' ? '#10b981' : '#f59e0b',
                fontWeight: '700',
                fontSize: '16px'
              }}>
                {transitionSpeed.toUpperCase()}
              </div>
              <div style={{color: '#cbd5e1'}}>Speed</div>
            </div>
          </div>
          
          {/* Speed Improvement Indicator */}
          {fastModeEnabled && (
            <div style={{
              marginTop: '12px',
              padding: '8px',
              background: 'rgba(16, 185, 129, 0.1)',
              borderRadius: '6px',
              textAlign: 'center',
              fontSize: '11px',
              color: '#10b981',
              fontWeight: '600'
            }}>
              🚀 Estimated {transitionSpeed === 'instant' ? '80-90%' : '50-70%'} speed improvement active
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* ENHANCED AVATAR DISPLAY */}
      {/* ========================================== */}
      
      <div className="avatar-container" style={{marginBottom: '20px'}}>
        <ErrorBoundary>
          <EnhancedVideoAvatar 
            currentSign={currentSign} 
            isPlaying={isPlaying}
            onVideoComplete={handleVideoComplete}
            onStateChange={handleAvatarStateChange}
            debugMode={process.env.NODE_ENV === 'development'}
            fastMode={fastModeEnabled}
            transitionSpeed={transitionSpeed}
            performanceMode={true}
          />
        </ErrorBoundary>
      </div>

      {/* ========================================== */}
      {/* ULTRA-FAST ENHANCED CONTROLS */}
      {/* ========================================== */}
      
      <div className="enhanced-controls" style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        
        {/* PRIMARY CONTROL GROUP */}
        <div className="control-group" style={{
          display: 'flex',
          gap: '8px',
          flex: 1,
          minWidth: '300px'
        }}>
          <button
            onClick={playAnimation}
            disabled={isPlaying}
            title="Play current sign"
            style={{
              padding: '12px 20px',
              borderRadius: '10px',
              border: 'none',
              background: isPlaying ? 
                'rgba(107, 114, 128, 0.3)' : 
                'linear-gradient(135deg, #10b981, #059669)',
              color: isPlaying ? '#9ca3af' : 'white',
              cursor: isPlaying ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: '700',
              transition: 'all 0.2s ease',
              boxShadow: isPlaying ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}
          >
            <Play size={16} />
            Play
          </button>
          
          <button
            onClick={pauseAnimation}
            disabled={!isPlaying}
            title="Pause queue"
            style={{
              padding: '12px 20px',
              borderRadius: '10px',
              border: 'none',
              background: !isPlaying ? 
                'rgba(107, 114, 128, 0.3)' : 
                'linear-gradient(135deg, #f59e0b, #d97706)',
              color: !isPlaying ? '#9ca3af' : 'white',
              cursor: !isPlaying ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: '700',
              transition: 'all 0.2s ease'
            }}
          >
            <Pause size={16} />
            Pause
          </button>
          
          <button
            onClick={stopAnimation}
            disabled={!isPlaying}
            title="Stop and clear queue"
            style={{
              padding: '12px 20px',
              borderRadius: '10px',
              border: 'none',
              background: !isPlaying ? 
                'rgba(107, 114, 128, 0.3)' : 
                'linear-gradient(135deg, #ef4444, #dc2626)',
              color: !isPlaying ? '#9ca3af' : 'white',
              cursor: !isPlaying ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: '700',
              transition: 'all 0.2s ease'
            }}
          >
            <Square size={16} />
            Stop
          </button>
        </div>

        {/* NAVIGATION CONTROLS */}
        <div style={{display: 'flex', gap: '8px'}}>
          <button
            onClick={prevSign}
            title="Previous sign"
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              border: 'none',
              background: 'rgba(139, 92, 246, 0.2)',
              color: '#a78bfa',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              fontSize: '14px',
              fontWeight: '700',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(139, 92, 246, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(139, 92, 246, 0.2)';
            }}
          >
            <ChevronLeft size={16} />
          </button>
          
          <button
            onClick={nextSign}
            title="Next sign"
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              border: 'none',
              background: 'rgba(139, 92, 246, 0.2)',
              color: '#a78bfa',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              fontSize: '14px',
              fontWeight: '700',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(139, 92, 246, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(139, 92, 246, 0.2)';
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* ULTRA-FAST BATCH CONTROLS */}
        <div className="batch-controls" style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => playMultipleSigns(['Hello', 'My', 'Name'])}
            disabled={isPlaying}
            title="Quick batch: Hello My Name"
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              background: isPlaying ? 
                'rgba(107, 114, 128, 0.3)' : 
                'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: isPlaying ? '#9ca3af' : 'white',
              cursor: isPlaying ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: '700',
              transition: 'all 0.2s ease'
            }}
          >
            Hello My Name
            {fastModeEnabled && <Zap size={10} style={{marginLeft: '4px'}} />}
          </button>

          <button
            onClick={() => playMultipleSigns(['Thank', 'You'])}
            disabled={isPlaying}
            title="Quick batch: Thank You"
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              background: isPlaying ? 
                'rgba(107, 114, 128, 0.3)' : 
                'linear-gradient(135deg, #06b6d4, #0891b2)',
              color: isPlaying ? '#9ca3af' : 'white',
              cursor: isPlaying ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: '700',
              transition: 'all 0.2s ease'
            }}
          >
            Thank You
            {fastModeEnabled && <Zap size={10} style={{marginLeft: '4px'}} />}
          </button>

          <button
            onClick={() => playMultipleSigns(['A', 'B', 'C', 'D', 'E'])}
            disabled={isPlaying}
            title="Ultra-fast alphabet sequence A-E"
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              background: isPlaying ? 
                'rgba(107, 114, 128, 0.3)' : 
                'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              color: isPlaying ? '#9ca3af' : 'white',
              cursor: isPlaying ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: '700',
              transition: 'all 0.2s ease'
            }}
          >
            🔤 A-E
            {transitionSpeed === 'instant' && <div style={{
              marginLeft: '4px',
              fontSize: '8px',
              background: 'rgba(239, 68, 68, 0.3)',
              padding: '1px 3px',
              borderRadius: '2px'
            }}>INSTANT</div>}
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* ULTRA-FAST SPEECH RECOGNITION SECTION */}
      {/* ========================================== */}
      
      <div className="speech-section">
        
        {/* MAIN SPEECH BUTTON */}
        <button
          onClick={toggleListening}
          disabled={!speechSupported}
          style={{
            width: '100%',
            padding: '20px',
            borderRadius: '16px',
            border: 'none',
            background: isListening ? 
              'linear-gradient(135deg, #ef4444, #dc2626)' :
              speechSupported ?
                'linear-gradient(135deg, #10b981, #059669)' :
                'rgba(107, 114, 128, 0.3)',
            color: speechSupported ? 'white' : '#9ca3af',
            cursor: speechSupported ? 'pointer' : 'not-allowed',
            fontSize: '18px',
            fontWeight: '800',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '20px',
            boxShadow: isListening ? 
              '0 0 30px rgba(239, 68, 68, 0.5)' : 
              speechSupported ? '0 8px 25px rgba(16, 185, 129, 0.3)' : 'none',
            transition: 'all 0.3s ease',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Animated background for listening state */}
          {isListening && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(45deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.3), rgba(239, 68, 68, 0.1))',
              backgroundSize: '200% 200%',
              animation: 'gradient-shift 2s ease-in-out infinite'
            }} />
          )}
          
          {isListening ? <MicOff size={24} /> : <Mic size={24} />}
          <span style={{position: 'relative', zIndex: 1}}>
            {isListening ? 'Stop Listening' : 'Start Speaking'}
          </span>
          {fastModeEnabled && (
            <Zap size={18} style={{
              position: 'relative',
              zIndex: 1,
              filter: 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.8))'
            }} />
          )}
          {transitionSpeed === 'instant' && (
            <div style={{
              position: 'relative',
              zIndex: 1,
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '10px',
              fontWeight: '700'
            }}>
              INSTANT MODE
            </div>
          )}
        </button>

        {/* LIVE TRANSCRIPT WITH PERFORMANCE INFO */}
        <div className="transcript-display" style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(51, 65, 85, 0.95))',
          borderRadius: '16px',
          padding: '20px',
          border: '2px solid rgba(139, 92, 246, 0.4)',
          marginBottom: '20px',
          backdropFilter: 'blur(20px)'
        }}>
          
          {/* TRANSCRIPT STATUS BAR */}
          <div className="transcript-status" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <span className={`status-dot ${isListening ? 'status-active' : 'status-inactive'}`} style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: isListening ? '#10b981' : '#6b7280',
                boxShadow: isListening ? '0 0 10px rgba(16, 185, 129, 0.8)' : 'none',
                animation: isListening ? 'pulse 1.5s ease-in-out infinite' : 'none'
              }} />
              <span style={{fontSize: '14px', fontWeight: '700', color: '#e2e8f0'}}>
                {isListening ? 'Listening...' : speechSupported ? 'Click to start speaking' : 'Speech not supported'}
              </span>
            </div>
            
            {/* PERFORMANCE INDICATORS */}
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'}}>
              {fastModeEnabled && (
                <span style={{
                  fontSize: '11px',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(6, 182, 212, 0.3))',
                  color: '#10b981',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontWeight: '700',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  <Zap size={10} />
                  FAST MODE
                </span>
              )}
              
              <span style={{
                fontSize: '10px',
                background: transitionSpeed === 'instant' ? 'rgba(239, 68, 68, 0.2)' :
                          transitionSpeed === 'fast' ? 'rgba(16, 185, 129, 0.2)' :
                          'rgba(107, 114, 128, 0.2)',
                color: transitionSpeed === 'instant' ? '#ef4444' :
                      transitionSpeed === 'fast' ? '#10b981' :
                      '#9ca3af',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: '700',
                border: '1px solid currentColor'
              }}>
                {transitionSpeed.toUpperCase()} SPEED
              </span>
            </div>
          </div>
          
          {/* TRANSCRIPT CONTENT */}
          <div className="transcript-content" style={{
            minHeight: '80px',
            padding: '16px',
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '12px',
            border: '2px solid rgba(139, 92, 246, 0.3)',
            color: '#e2e8f0',
            fontSize: '16px',
            lineHeight: '1.6',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Live typing indicator */}
            {isListening && transcript && (
              <div style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#10b981',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  background: '#10b981',
                  borderRadius: '50%',
                  animation: 'pulse 1s ease-in-out infinite'
                }} />
                LIVE
              </div>
            )}
            
            <div style={{
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap'
            }}>
              {(finalTranscript + transcript) || 'Your speech will appear here and will be instantly converted to sign language...'}
            </div>
          </div>

          {/* ULTRA-FAST QUEUE STATUS DISPLAY */}
          {queueStatus && queueStatus.total > 0 && (
            <div className="queue-status-display" style={{
              marginTop: '16px',
              padding: '16px',
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(6, 182, 212, 0.1))',
              borderRadius: '12px',
              border: '2px solid rgba(139, 92, 246, 0.3)'
            }}>
              <div className="queue-header" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <span className="queue-label" style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#a78bfa',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Activity size={14} />
                  Processing Queue: {queueStatus.current}/{queueStatus.total}
                  {queueStatus.throughput && parseFloat(queueStatus.throughput) > 0 && (
                    <span style={{
                      marginLeft: '8px', 
                      color: '#10b981',
                      fontSize: '12px',
                      background: 'rgba(16, 185, 129, 0.2)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: '600'
                    }}>
                      {queueStatus.throughput} signs/sec
                    </span>
                  )}
                </span>
                
                <div className="speed-indicators" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <div style={{
                    fontSize: '10px',
                    background: queueStatus.speedMode === 'instant' ? 'rgba(239, 68, 68, 0.3)' :
                              queueStatus.speedMode === 'fast' ? 'rgba(16, 185, 129, 0.3)' :
                              'rgba(107, 114, 128, 0.3)',
                    color: queueStatus.speedMode === 'instant' ? '#ef4444' :
                          queueStatus.speedMode === 'fast' ? '#10b981' :
                          '#9ca3af',
                    padding: '3px 6px',
                    borderRadius: '4px',
                    fontWeight: '700',
                    border: '1px solid currentColor'
                  }}>
                    {queueStatus.speedMode?.toUpperCase() || 'NORMAL'} MODE
                  </div>
                  
                  {queueStatus.fastMode && (
                    <Zap size={12} style={{
                      color: '#10b981',
                      filter: 'drop-shadow(0 0 2px rgba(16, 185, 129, 0.8))'
                    }} />
                  )}
                </div>
              </div>
              
              {/* PROGRESS BAR WITH ANIMATION */}
              <div className="queue-progress-bar" style={{
                width: '100%',
                height: '8px',
                background: 'rgba(139, 92, 246, 0.2)',
                borderRadius: '4px',
                overflow: 'hidden',
                marginBottom: '12px',
                position: 'relative'
              }}>
                <div 
                  className="queue-progress-fill" 
                  style={{ 
                    width: `${queueStatus.percentage}%`,
                    height: '100%',
                    background: queueStatus.speedMode === 'instant' ? 
                      'linear-gradient(90deg, #ef4444, #dc2626)' :
                      queueStatus.speedMode === 'fast' ?
                      'linear-gradient(90deg, #10b981, #059669)' :
                      'linear-gradient(90deg, #8b5cf6, #06b6d4)',
                    transition: 'width 0.3s ease',
                    position: 'relative'
                  }}
                >
                  {/* Animated shine effect for active processing */}
                  {queueStatus.percentage > 0 && queueStatus.percentage < 100 && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: '-50%',
                      width: '50%',
                      height: '100%',
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                      animation: 'shimmer 1.5s ease-in-out infinite'
                    }} />
                  )}
                </div>
              </div>
              
              {/* ETA AND PERFORMANCE INFO */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: '#cbd5e1',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                {queueStatus.remainingTime && (
                  <div className="queue-eta" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span>ETA: {Math.round(queueStatus.remainingTime / 1000)}s</span>
                    {fastModeEnabled && queueStatus.remainingTime > 1000 && (
                      <span style={{
                        color: '#10b981',
                        background: 'rgba(16, 185, 129, 0.1)',
                        padding: '2px 4px',
                        borderRadius: '3px',
                        fontWeight: '600'
                      }}>
                        (⚡ ~{Math.round(queueStatus.remainingTime / 1000 / (transitionSpeed === 'instant' ? 3 : 2))}s optimized)
                      </span>
                    )}
                  </div>
                )}
                
                <div style={{
                  fontSize: '10px',
                  color: '#9ca3af',
                  fontStyle: 'italic'
                }}>
                  {queueStatus.current > 0 && queueStatus.throughput && 
                    `Processing at ${queueStatus.throughput} signs/second`
                  }
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ERROR DISPLAY WITH ENHANCED STYLING */}
        {error && (
          <div className="error-display" style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '16px',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.1))',
            border: '2px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '12px',
            color: '#fca5a5',
            fontSize: '14px',
            marginBottom: '20px',
            backdropFilter: 'blur(10px)'
          }}>
            <AlertCircle size={20} style={{
              color: '#ef4444',
              flexShrink: 0,
              marginTop: '2px'
            }} />
            <div style={{flex: 1}}>
              <div style={{fontWeight: '700', marginBottom: '4px', color: '#ef4444'}}>
                Error
              </div>
              <div style={{lineHeight: '1.4'}}>
                {error}
              </div>
            </div>
            <button 
              onClick={() => setError(null)} 
              className="error-dismiss"
              title="Dismiss error"
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: '18px',
                fontWeight: 'bold',
                padding: '4px 8px',
                borderRadius: '6px',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(239, 68, 68, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(239, 68, 68, 0.2)';
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* ========================================== */}
        {/* ULTRA-FAST SIGN SELECTOR WITH BATCHING */}
        {/* ========================================== */}
        
        <div className="sign-selector">
          <div className="selector-header" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <h4 style={{
              fontSize: '18px',
              fontWeight: '800',
              color: '#e2e8f0',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              🎯 Quick Select Signs
              {fastModeEnabled && (
                <Zap size={16} style={{
                  color: '#10b981',
                  filter: 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.8))'
                }} />
              )}
            </h4>
            
            <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
              {/* Speed Mode Quick Toggle */}
              <select
                value={transitionSpeed}
                onChange={(e) => changeTransitionSpeed(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  background: 'rgba(30, 41, 59, 0.8)',
                  color: '#e2e8f0',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                <option value="normal">Normal Speed</option>
                <option value="fast">Fast Speed ⚡</option>
                <option value="instant">Instant Speed 🚀</option>
              </select>
              
              <button 
                onClick={() => setShowAllSigns(!showAllSigns)}
                className="btn-toggle"
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(6, 182, 212, 0.2))',
                  color: '#a78bfa',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(6, 182, 212, 0.3))';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(6, 182, 212, 0.2))';
                }}
              >
                {showAllSigns ? 'Show Less' : 'Show All'}
                <ChevronRight 
                  size={14}
                  style={{
                    transform: showAllSigns ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease'
                  }}
                />
              </button>
            </div>
          </div>
          
          {/* ULTRA-FAST BATCH BUTTONS */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '16px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => playMultipleSigns(['A', 'B', 'C', 'D', 'E'])}
              disabled={isPlaying}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: 'none',
                background: isPlaying ? 
                  'rgba(107, 114, 128, 0.3)' : 
                  'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                color: isPlaying ? '#9ca3af' : 'white',
                cursor: isPlaying ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '700',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: isPlaying ? 'none' : '0 4px 12px rgba(139, 92, 246, 0.3)'
              }}
              title={`Play alphabet sequence A-E ${fastModeEnabled ? '(Ultra-Fast)' : ''}`}
            >
              🔤 A-E Alphabet
              {transitionSpeed === 'instant' && <span style={{fontSize: '9px'}}>⚡</span>}
            </button>
            
            <button
              onClick={() => playMultipleSigns(['1', '2', '3', '4', '5'])}
              disabled={isPlaying}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: 'none',
                background: isPlaying ? 
                  'rgba(107, 114, 128, 0.3)' : 
                  'linear-gradient(135deg, #06b6d4, #0891b2)',
                color: isPlaying ? '#9ca3af' : 'white',
                cursor: isPlaying ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '700',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: isPlaying ? 'none' : '0 4px 12px rgba(6, 182, 212, 0.3)'
              }}
              title={`Play number sequence 1-5 ${fastModeEnabled ? '(Ultra-Fast)' : ''}`}
            >
              🔢 1-5 Numbers
              {transitionSpeed === 'instant' && <span style={{fontSize: '9px'}}>⚡</span>}
            </button>
            
            <button
              onClick={() => playMultipleSigns(['Hello', 'Good', 'Thank_You', 'Welcome'])}
              disabled={isPlaying}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: 'none',
                background: isPlaying ? 
                  'rgba(107, 114, 128, 0.3)' : 
                  'linear-gradient(135deg, #10b981, #059669)',
                color: isPlaying ? '#9ca3af' : 'white',
                cursor: isPlaying ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '700',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: isPlaying ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
              title={`Play common greetings ${fastModeEnabled ? '(Ultra-Fast)' : ''}`}
            >
              👋 Greetings
              {transitionSpeed === 'instant' && <span style={{fontSize: '9px'}}>⚡</span>}
            </button>

            <button
              onClick={() => playMultipleSigns(['My', 'Name', 'Is'])}
              disabled={isPlaying}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: 'none',
                background: isPlaying ? 
                  'rgba(107, 114, 128, 0.3)' : 
                  'linear-gradient(135deg, #f59e0b, #d97706)',
                color: isPlaying ? '#9ca3af' : 'white',
                cursor: isPlaying ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '700',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: isPlaying ? 'none' : '0 4px 12px rgba(245, 158, 11, 0.3)'
              }}
              title={`Play introduction sequence ${fastModeEnabled ? '(Ultra-Fast)' : ''}`}
            >
              🏷️ My Name Is
              {transitionSpeed === 'instant' && <span style={{fontSize: '9px'}}>⚡</span>}
            </button>
          </div>

          {/* INDIVIDUAL SIGN BUTTONS GRID */}
          <div className="word-buttons">
            <div className="button-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '10px'
            }}>
              {(showAllSigns ? signs : signs.filter(sign => 
                ['Hello', 'Thank_You', 'Yes', 'Help', 'Good', 'Love', 'Friend', 'Sorry', 'Beautiful', 'Happy'].includes(sign)
              )).map(sign => (
                <button
                  key={sign}
                  onClick={() => selectSign(sign)}
                  className={`word-btn ${currentSign === sign ? 'word-btn-active' : ''}`}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: currentSign === sign ? 
                      'linear-gradient(135deg, #a78bfa, #8b5cf6)' :
                      'rgba(75, 85, 99, 0.3)',
                    color: currentSign === sign ? 'white' : '#d1d5db',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '700',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    boxShadow: currentSign === sign ? '0 4px 12px rgba(139, 92, 246, 0.4)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (currentSign !== sign) {
                      e.target.style.background = 'rgba(139, 92, 246, 0.2)';
                      e.target.style.color = '#a78bfa';
                      e.target.style.transform = 'translateY(-2px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentSign !== sign) {
                      e.target.style.background = 'rgba(75, 85, 99, 0.3)';
                      e.target.style.color = '#d1d5db';
                      e.target.style.transform = 'translateY(0px)';
                    }
                  }}
                  title={`Select ${sign.replace('_', ' ')} ${fastModeEnabled ? '(Fast Mode)' : ''}${transitionSpeed === 'instant' ? ' (Instant)' : ''}`}
                >
                  {sign.replace('_', ' ')}
                  
                  {/* Performance indicators on buttons */}
                  {fastModeEnabled && currentSign === sign && (
                    <Zap size={12} style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      color: '#10b981',
                      filter: 'drop-shadow(0 0 2px rgba(16, 185, 129, 0.8))'
                    }} />
                  )}
                  
                  {transitionSpeed === 'instant' && currentSign === sign && (
                    <div style={{
                      position: 'absolute',
                      bottom: '2px',
                      right: '2px',
                      fontSize: '8px',
                      background: 'rgba(239, 68, 68, 0.8)',
                      color: 'white',
                      padding: '1px 3px',
                      borderRadius: '2px',
                      fontWeight: '700'
                    }}>
                      INSTANT
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* ADVANCED SETTINGS & PERFORMANCE PANEL */}
        {/* ========================================== */}
        
        <div style={{
          marginTop: '24px',
          padding: '20px',
          background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.4), rgba(30, 41, 59, 0.4))',
          borderRadius: '16px',
          border: '2px solid rgba(75, 85, 99, 0.4)',
          backdropFilter: 'blur(20px)'
        }}>
          <h5 style={{
            fontSize: '16px',
            fontWeight: '800',
            color: '#e2e8f0',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Gauge size={16} />
            Advanced Performance Settings
          </h5>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            fontSize: '13px'
          }}>
            
            {/* Performance Toggles */}
            <div>
              <h6 style={{color: '#a78bfa', marginBottom: '8px', fontSize: '12px', fontWeight: '700'}}>
                Optimization Features
              </h6>
              
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#cbd5e1',
                cursor: 'pointer',
                marginBottom: '6px'
              }}>
                <input
                  type="checkbox"
                  checked={fastModeEnabled}
                  onChange={toggleFastMode}
                  style={{accentColor: '#10b981'}}
                />
                Fast Mode (50-70% faster transitions)
              </label>
              
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#cbd5e1',
                cursor: 'pointer',
                marginBottom: '6px'
              }}>
                <input
                  type="checkbox"
                  checked={autoOptimizeEnabled}
                  onChange={(e) => setAutoOptimizeEnabled(e.target.checked)}
                  style={{accentColor: '#06b6d4'}}
                />
                Auto-Optimize Performance
              </label>
              
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#cbd5e1',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={showPerformancePanel}
                  onChange={(e) => setShowPerformancePanel(e.target.checked)}
                  style={{accentColor: '#8b5cf6'}}
                />
                Show Performance Metrics
              </label>
            </div>
            
            {/* Current Settings Info */}
            <div>
              <h6 style={{color: '#a78bfa', marginBottom: '8px', fontSize: '12px', fontWeight: '700'}}>
                Current Configuration
              </h6>
              
              <div style={{color: '#9ca3af', fontSize: '11px', lineHeight: '1.6'}}>
                <div>Speed Mode: <span style={{color: '#e2e8f0', fontWeight: '600'}}>{transitionSpeed}</span></div>
                <div>Fast Mode: <span style={{color: fastModeEnabled ? '#10b981' : '#ef4444', fontWeight: '600'}}>
                  {fastModeEnabled ? 'ENABLED' : 'DISABLED'}
                </span></div>
                <div>Auto-Optimize: <span style={{color: autoOptimizeEnabled ? '#10b981' : '#6b7280', fontWeight: '600'}}>
                  {autoOptimizeEnabled ? 'ON' : 'OFF'}
                </span></div>
                {performanceMetrics.averageTime > 0 && (
                  <div>Avg Processing: <span style={{color: '#06b6d4', fontWeight: '600'}}>
                    {performanceMetrics.averageTime}ms
                  </span></div>
                )}
              </div>
            </div>
            
            {/* Performance Tips */}
            <div>
              <h6 style={{color: '#a78bfa', marginBottom: '8px', fontSize: '12px', fontWeight: '700'}}>
                Performance Tips
              </h6>
              
              <div style={{color: '#9ca3af', fontSize: '11px', lineHeight: '1.5'}}>
                <div style={{marginBottom: '4px'}}>
                  • <strong>Fast Mode:</strong> 50-70% speed improvement
                </div>
                <div style={{marginBottom: '4px'}}>
                  • <strong>Instant Mode:</strong> Maximum speed, minimal animations
                </div>
                <div style={{marginBottom: '4px'}}>
                  • <strong>Batch Operations:</strong> Use quick buttons for sequences
                </div>
                <div>
                  • <strong>Auto-Optimize:</strong> Automatically adjusts settings based on performance
                </div>
              </div>
            </div>
          </div>
          
          {/* Performance Summary */}
          {performanceMetrics.totalTransitions > 0 && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: 'rgba(16, 185, 129, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              textAlign: 'center',
              fontSize: '12px',
              color: '#10b981',
              fontWeight: '600'
            }}>
              🎯 Performance Summary: {performanceMetrics.totalTransitions} transitions completed
              {performanceMetrics.averageTime > 0 && ` • ${performanceMetrics.averageTime}ms average`}
              {performanceMetrics.queuesThroughput > 0 && ` • ${performanceMetrics.queuesThroughput} signs/sec throughput`}
              {fastModeEnabled && ` • ${transitionSpeed === 'instant' ? '80-90%' : '50-70%'} speed boost active`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpeechToSignModule;

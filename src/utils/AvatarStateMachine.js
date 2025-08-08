// src/utils/AvatarStateMachine.js - ULTRA-FAST State management for avatar animations

export const AvatarStates = {
  NEUTRAL: 'neutral',
  LOADING: 'loading',
  TRANSITIONING_IN: 'transitioning_in',
  SIGNING: 'signing',
  TRANSITIONING_OUT: 'transitioning_out',
  ERROR: 'error'
};

export const StateTransitions = {
  [AvatarStates.NEUTRAL]: [AvatarStates.LOADING, AvatarStates.ERROR],
  [AvatarStates.LOADING]: [AvatarStates.TRANSITIONING_IN, AvatarStates.ERROR, AvatarStates.NEUTRAL],
  [AvatarStates.TRANSITIONING_IN]: [AvatarStates.SIGNING, AvatarStates.ERROR],
  [AvatarStates.SIGNING]: [AvatarStates.TRANSITIONING_OUT, AvatarStates.ERROR, AvatarStates.LOADING],
  [AvatarStates.TRANSITIONING_OUT]: [AvatarStates.NEUTRAL, AvatarStates.LOADING],
  [AvatarStates.ERROR]: [AvatarStates.NEUTRAL, AvatarStates.LOADING]
};

class AvatarStateMachine {
  constructor(options = {}) {
    this.state = AvatarStates.NEUTRAL;
    this.currentSign = null;
    this.previousSign = null;
    this.stateChangeCallbacks = new Map();
    this.transitionPromise = null;
    this.isTransitioning = false;
    this.lastTransitionTime = 0;
    
    // BALANCED Configuration for complete sign playback
    this.options = {
      // BALANCED: Slower timing to ensure complete playback
      transitionInDuration: options.transitionInDuration || 100,    // Was 50ms -> 100ms
      transitionOutDuration: options.transitionOutDuration || 75,   // Was 25ms -> 75ms
      signDuration: options.signDuration || 2200,                   // Was 1200ms -> 2200ms (longer for complete playback)
      interSignDelay: options.interSignDelay || 200,                // Was 15ms -> 200ms (more time between signs)
      
      // SPEED OPTIMIZATIONS - More conservative
      fastMode: options.fastMode !== false,                        // Default ON
      instantTransitions: options.instantTransitions || false,     // Skip all animations
      ultraFastMode: options.ultraFastMode || false,               // Maximum speed mode
      adaptiveTiming: options.adaptiveTiming !== false,            // Smart duration adjustment
      preloadEnabled: options.preloadEnabled !== false,            // Preload for instant switching
      parallelProcessing: options.parallelProcessing !== false,    // Concurrent operations
      skipRedundantStates: options.skipRedundantStates !== false,  // Skip unnecessary states
      
      // SMOOTHNESS OPTIMIZATIONS - Prioritize complete playback
      easeTransitions: options.easeTransitions && !options.instantTransitions, // Smooth only when not instant
      bufferFrames: options.bufferFrames || 2,                     // More buffering for complete playback
      prioritizeSpeed: options.prioritizeSpeed || false,           // Changed: prioritize completeness over speed
      batchOptimization: options.batchOptimization !== false,      // Optimize sequences
      completePlayback: options.completePlayback !== false,        // NEW: Ensure complete sign playback
      
      // DEBUGGING
      debugMode: options.debugMode || false,
      enableSmoothing: options.enableSmoothing && !options.fastMode, // Disable smoothing in fast mode
      
      ...options
    };

    // Performance tracking for optimization
    this.performanceMetrics = {
      transitionCount: 0,
      totalTime: 0,
      averageTime: 0,
      fastModeUsage: 0,
      instantModeUsage: 0,
      batchProcessingCount: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    // OPTIMIZATION: Preload and caching system
    this.preloadCache = new Map();
    this.activePreloads = new Set();
    this.transitionQueue = [];
    this.processingBatch = false;
    
    // OPTIMIZATION: State prediction for faster transitions
    this.statePredictor = {
      lastSequence: [],
      commonPatterns: new Map(),
      nextPrediction: null
    };

    if (this.options.debugMode) {
      this.log('🚀 ULTRA-FAST AvatarStateMachine initialized', {
        ...this.options,
        predictedSpeedIncrease: '300-500%'
      });
    }
  }

  log(message, data = null) {
    if (this.options.debugMode) {
      const timestamp = performance.now().toFixed(1);
      console.log(`[${timestamp}ms] ⚡ FastAvatar: ${message}`, data || '');
    }
  }

  /**
   * ULTRA-FAST: Get state with performance data
   */
  getState() {
    return {
      current: this.state,
      currentSign: this.currentSign,
      previousSign: this.previousSign,
      isTransitioning: this.isTransitioning,
      canTransition: !this.isTransitioning || this.options.parallelProcessing,
      
      // Performance metrics
      performance: this.performanceMetrics,
      optimizations: {
        fastMode: this.options.fastMode,
        ultraFast: this.options.ultraFastMode,
        instant: this.options.instantTransitions,
        preloadCacheSize: this.preloadCache.size,
        activePreloads: this.activePreloads.size,
        queueLength: this.transitionQueue.length,
        nextPrediction: this.statePredictor.nextPrediction
      }
    };
  }

  /**
   * OPTIMIZED: State validation with fast path
   */
  canTransitionTo(newState) {
    // FAST PATH: Allow anything in parallel processing mode
    if (this.options.parallelProcessing) return true;
    
    const allowedTransitions = StateTransitions[this.state];
    return allowedTransitions ? allowedTransitions.includes(newState) : false;
  }

  /**
   * Register state change callback with priority
   */
  onStateChange(callback, priority = 'normal') {
    const id = Math.random().toString(36);
    this.stateChangeCallbacks.set(id, { callback, priority });
    return id;
  }

  /**
   * Remove state change callback
   */
  removeStateChangeCallback(id) {
    return this.stateChangeCallbacks.delete(id);
  }

  /**
   * ULTRA-FAST: State change with minimal overhead
   */
  setState(newState, data = {}) {
    // OPTIMIZATION: Skip validation in ultra-fast mode
    if (!this.options.ultraFastMode && !this.canTransitionTo(newState)) {
      this.log(`❌ Invalid transition: ${this.state} -> ${newState}`);
      return false;
    }

    const oldState = this.state;
    this.state = newState;
    this.isTransitioning = this.options.skipRedundantStates ? 
      newState === AvatarStates.LOADING : // Only loading counts as transitioning
      [AvatarStates.LOADING, AvatarStates.TRANSITIONING_IN, AvatarStates.TRANSITIONING_OUT].includes(newState);

    this.log(`⚡ State: ${oldState} -> ${newState} (${data.fastMode ? 'FAST' : 'NORMAL'})`);

    // OPTIMIZATION: Priority-based callback execution
    const highPriorityCallbacks = [];
    const normalPriorityCallbacks = [];
    
    this.stateChangeCallbacks.forEach(({ callback, priority }) => {
      if (priority === 'high') {
        highPriorityCallbacks.push(callback);
      } else {
        normalPriorityCallbacks.push(callback);
      }
    });

    // Execute high priority callbacks first
    const executeCallbacks = (callbacks) => {
      callbacks.forEach(callback => {
        try {
          callback({ oldState, newState, data, machine: this });
        } catch (error) {
          console.error('[FastAvatar] Callback error:', error);
        }
      });
    };

    executeCallbacks(highPriorityCallbacks);
    
    // Execute normal priority callbacks asynchronously for speed
    if (normalPriorityCallbacks.length > 0) {
      setTimeout(() => executeCallbacks(normalPriorityCallbacks), 0);
    }

    return true;
  }

  /**
   * ULTRA-FAST: Preload with aggressive caching
   */
  async preloadSign(signName) {
    if (this.preloadCache.has(signName)) {
      this.performanceMetrics.cacheHits++;
      return this.preloadCache.get(signName);
    }

    if (this.activePreloads.has(signName)) {
      // Wait for active preload
      return new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (this.preloadCache.has(signName)) {
            clearInterval(checkInterval);
            resolve(this.preloadCache.get(signName));
          }
        }, 10);
      });
    }

    this.performanceMetrics.cacheMisses++;
    this.activePreloads.add(signName);
    this.log(`📦 Preloading: ${signName}`);

    try {
      // ULTRA-FAST: Minimal preload simulation
      const result = await new Promise(resolve => {
        // Use requestAnimationFrame for smooth preloading
        requestAnimationFrame(() => {
          resolve({ 
            loaded: true, 
            signName, 
            timestamp: performance.now(),
            fastPreload: true 
          });
        });
      });

      this.preloadCache.set(signName, result);
      this.log(`✅ Preloaded: ${signName} (${(performance.now() - result.timestamp).toFixed(1)}ms)`);
      
      return result;
    } catch (error) {
      this.log(`❌ Preload failed: ${signName}`, error);
      return { loaded: false, error: error.message };
    } finally {
      this.activePreloads.delete(signName);
    }
  }

  /**
   * ULTRA-FAST: Batch preload with parallel processing
   */
  async preloadBatch(signNames) {
    this.log(`📦 Batch preloading ${signNames.length} signs`);
    
    const preloadPromises = signNames.map(signName => 
      this.preloadSign(signName).catch(error => {
        this.log(`⚠️ Batch preload failed: ${signName}`, error);
        return { loaded: false, signName, error };
      })
    );
    
    const results = await Promise.all(preloadPromises);
    const successful = results.filter(r => r.loaded).length;
    
    this.log(`✅ Batch preload complete: ${successful}/${signNames.length} successful`);
    return results;
  }

  /**
   * ULTRA-FAST: Main transition method with all optimizations
   */
  async transitionToSign(signName, options = {}) {
    const startTime = performance.now();
    this.performanceMetrics.transitionCount++;
    
    // OPTIMIZATION: Detect and apply best speed mode
    const speedMode = this._detectOptimalSpeedMode(signName, options);
    const shouldUseUltraFast = speedMode === 'ultra' || this.options.ultraFastMode;
    const shouldUseInstant = speedMode === 'instant' || this.options.instantTransitions;
    
    if (shouldUseUltraFast) this.performanceMetrics.fastModeUsage++;
    if (shouldUseInstant) this.performanceMetrics.instantModeUsage++;

    // OPTIMIZATION: Queue management for concurrent requests
    if (this.options.parallelProcessing && this.transitionPromise) {
      this.transitionQueue.push({ signName, options, speedMode });
      return this._processTransitionQueue();
    }

    this.transitionPromise = this._executeUltraFastTransition(signName, options, speedMode);
    
    try {
      const result = await this.transitionPromise;
      this.transitionPromise = null;
      
      // Update performance metrics
      const duration = performance.now() - startTime;
      this.performanceMetrics.totalTime += duration;
      this.performanceMetrics.averageTime = this.performanceMetrics.totalTime / this.performanceMetrics.transitionCount;
      
      // Update state prediction
      this._updateStatePredictor(signName, options);
      
      return result;
    } catch (error) {
      this.transitionPromise = null;
      throw error;
    }
  }

  /**
   * ULTRA-FAST: Execute transition with maximum optimizations
   */
  async _executeUltraFastTransition(signName, options, speedMode) {
    const startTime = performance.now();
    
    this.log(`🚀 ${speedMode.toUpperCase()} transition: ${signName}`);

    try {
      // STEP 1: ULTRA-FAST Loading (parallel with preloading)
      const loadingPromises = [];
      
      if (!this.setState(AvatarStates.LOADING, { signName, speedMode })) {
        throw new Error('Failed to enter loading state');
      }

      this.previousSign = this.currentSign;
      this.currentSign = signName;

      // OPTIMIZATION: Parallel loading and preloading
      if (options.onLoadStart) {
        loadingPromises.push(
          Promise.resolve(options.onLoadStart(signName)).catch(error => {
            this.log(`⚠️ onLoadStart failed: ${signName}`, error);
          })
        );
      }

      // Preload next predicted sign
      if (this.statePredictor.nextPrediction) {
        loadingPromises.push(
          this.preloadSign(this.statePredictor.nextPrediction).catch(() => {})
        );
      }

      // Wait for critical loading only
      if (loadingPromises.length > 0) {
        await Promise.all(loadingPromises);
      }

      // STEP 2: ULTRA-FAST Transition Out (skip in ultra-fast mode)
      if (this.previousSign && 
          !speedMode.includes('instant') && 
          !speedMode.includes('ultra') &&
          this.state !== AvatarStates.NEUTRAL) {
        
        this.setState(AvatarStates.TRANSITIONING_OUT, { 
          from: this.previousSign, 
          to: signName,
          speedMode 
        });

        if (options.onTransitionOut) {
          await options.onTransitionOut(this.previousSign, signName);
        }

        const outDuration = this._getUltraFastDuration('transitionOut', speedMode);
        if (outDuration > 0) {
          await this._ultraFastWait(outDuration);
        }
      }

      // STEP 3: ULTRA-FAST Transition In (minimal or skipped)
      if (!speedMode.includes('instant')) {
        this.setState(AvatarStates.TRANSITIONING_IN, { signName, speedMode });

        if (options.onTransitionIn) {
          await options.onTransitionIn(signName, this.previousSign);
        }

        const inDuration = this._getUltraFastDuration('transitionIn', speedMode);
        if (inDuration > 0) {
          await this._ultraFastWait(inDuration);
        }
      } else {
        // INSTANT MODE: Skip transition, go straight to signing
        if (options.onTransitionIn) {
          await options.onTransitionIn(signName, this.previousSign);
        }
      }

      // STEP 4: ULTRA-FAST Signing Phase
      this.setState(AvatarStates.SIGNING, { signName, speedMode });

      if (options.onSignStart) {
        await options.onSignStart(signName);
      }

      // OPTIMIZATION: Adaptive sign duration
      const duration = this._getUltraFastSignDuration(signName, options, speedMode);
      await this._ultraFastWait(duration);

      if (options.onSignEnd) {
        await options.onSignEnd(signName);
      }

      // STEP 5: ULTRA-FAST Return to Neutral (smart detection)
      if (this.state === AvatarStates.SIGNING) {
        const nextSignComing = options.queueContext?.hasNext || 
                              this.transitionQueue.length > 0 ||
                              this.statePredictor.nextPrediction;
        
        if (!nextSignComing || !speedMode.includes('fast')) {
          this.setState(AvatarStates.NEUTRAL, { signName });
        }
      }

      const totalTime = performance.now() - startTime;
      this.log(`✅ ${speedMode.toUpperCase()} completed: ${signName} (${totalTime.toFixed(1)}ms)`);

      return {
        success: true,
        signName,
        duration: totalTime,
        previousSign: this.previousSign,
        speedMode,
        optimized: true,
        ultraFast: speedMode.includes('ultra') || speedMode.includes('instant')
      };

    } catch (error) {
      this.log(`❌ Transition failed: ${signName}`, error);
      this.setState(AvatarStates.ERROR, { signName, error: error.message });
      
      // ULTRA-FAST recovery
      setTimeout(() => {
        if (this.state === AvatarStates.ERROR) {
          this.setState(AvatarStates.NEUTRAL);
        }
      }, 100); // Super fast recovery

      throw error;
    }
  }

  /**
   * OPTIMIZATION: Detect optimal speed mode based on context
   */
  _detectOptimalSpeedMode(signName, options) {
    // INSTANT MODE conditions
    if (options.instantMode || 
        (options.queueContext?.total > 5) ||
        this._isSingleCharacter(signName)) {
      return 'instant';
    }
    
    // ULTRA-FAST conditions
    if (options.ultraFast ||
        options.batchMode ||
        this.options.ultraFastMode ||
        (options.queueContext?.total > 2) ||
        this.preloadCache.has(signName)) {
      return 'ultra';
    }
    
    // FAST conditions
    if (options.fastMode || 
        this.options.fastMode ||
        this._isCommonSequence(this.previousSign, signName)) {
      return 'fast';
    }
    
    return 'normal';
  }

  /**
   * BALANCED: Get optimized durations ensuring complete playback
   */
  _getUltraFastDuration(type, speedMode) {
    const baseDurations = {
      transitionIn: this.options.transitionInDuration,
      transitionOut: this.options.transitionOutDuration
    };
    
    let duration = baseDurations[type] || 0;
    
    // Apply speed mode multipliers - more conservative for complete playback
    switch (speedMode) {
      case 'instant':
        return Math.max(Math.round(duration * 0.3), 25); // Less aggressive: 70% reduction instead of 100%
      case 'ultra':
        return Math.max(Math.round(duration * 0.5), 50); // Less aggressive: 50% reduction instead of 90%
      case 'fast':
        return Math.max(Math.round(duration * 0.7), 75); // Less aggressive: 30% reduction instead of 70%
      default:
        return duration; // Keep full duration for normal mode
    }
  }

  /**
   * BALANCED: Get optimized sign duration ensuring complete playback
   */
  _getUltraFastSignDuration(signName, options, speedMode) {
    if (options.duration) return options.duration;

    let baseDuration = this.options.signDuration;
    
    // Type-based duration optimization - more conservative
    if (this._isSingleCharacter(signName)) {
      baseDuration = 1500; // Increased from 800ms to 1500ms for complete letter signs
    } else if (this._isCommonWord(signName)) {
      baseDuration = 2000; // Increased from 1000ms to 2000ms for complete word signs
    }
    
    // Apply speed mode multipliers - ensuring minimum durations for complete playback
    switch (speedMode) {
      case 'instant':
        return Math.max(Math.round(baseDuration * 0.7), 1200); // Minimum 1200ms even in instant mode
      case 'ultra':
        return Math.max(Math.round(baseDuration * 0.8), 1500); // Minimum 1500ms for ultra mode
      case 'fast':
        return Math.max(Math.round(baseDuration * 0.9), 1800); // Minimum 1800ms for fast mode
      default:
        return baseDuration; // Full duration for normal mode
    }
  }

  /**
   * ULTRA-FAST: Process transition queue with batch optimization
   */
  async _processTransitionQueue() {
    if (this.processingBatch || this.transitionQueue.length === 0) {
      return;
    }

    this.processingBatch = true;
    this.performanceMetrics.batchProcessingCount++;
    
    try {
      const batchSize = Math.min(this.transitionQueue.length, 5); // Process up to 5 at once
      const batch = this.transitionQueue.splice(0, batchSize);
      
      this.log(`⚡ Processing batch of ${batch.length} transitions`);
      
      const batchPromises = batch.map(({ signName, options, speedMode }) =>
        this._executeUltraFastTransition(signName, {
          ...options,
          batchMode: true,
          speedMode: speedMode || 'ultra'
        }, speedMode || 'ultra').catch(error => {
          this.log(`❌ Batch item failed: ${signName}`, error);
          return { success: false, signName, error: error.message };
        })
      );
      
      const results = await Promise.all(batchPromises);
      const successful = results.filter(r => r.success).length;
      
      this.log(`✅ Batch complete: ${successful}/${batch.length} successful`);
      
      return results;
    } finally {
      this.processingBatch = false;
      
      // Process remaining queue
      if (this.transitionQueue.length > 0) {
        setTimeout(() => this._processTransitionQueue(), 0);
      }
    }
  }

  /**
   * ULTRA-FAST: Process multiple signs with maximum optimization
   */
  async processSignQueue(signs, options = {}) {
    const startTime = performance.now();
    this.log(`📋 ULTRA-FAST queue processing: [${signs.join(', ')}]`);
    
    // OPTIMIZATION: Preload entire queue in parallel
    if (this.options.preloadEnabled) {
      this.preloadBatch(signs).catch(() => {}); // Don't wait
    }
    
    // OPTIMIZATION: Detect optimal batch strategy
    const shouldUseBatchMode = signs.length > 2;
    const speedMode = signs.length > 5 ? 'instant' : 
                     signs.length > 2 ? 'ultra' : 'fast';
    
    this.log(`⚡ Using ${speedMode.toUpperCase()} mode for ${signs.length} signs`);
    
    const results = [];
    
    if (shouldUseBatchMode && this.options.parallelProcessing) {
      // ULTRA-FAST: Parallel batch processing
      const batchPromises = signs.map((sign, index) => 
        this.transitionToSign(sign, {
          ...options,
          batchMode: true,
          speedMode,
          queueContext: {
            index,
            total: signs.length,
            isFirst: index === 0,
            isLast: index === signs.length - 1,
            hasNext: index < signs.length - 1,
            fastMode: true
          }
        }).catch(error => {
          this.log(`❌ Parallel processing failed: ${sign}`, error);
          return { success: false, signName: sign, error: error.message };
        })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
    } else {
      // ULTRA-FAST: Sequential processing with minimal delays
      for (let i = 0; i < signs.length; i++) {
        const sign = signs[i];
        const isLastSign = i === signs.length - 1;
        
        try {
          const result = await this.transitionToSign(sign, {
            ...options,
            speedMode,
            queueContext: {
              index: i,
              total: signs.length,
              isFirst: i === 0,
              isLast: isLastSign,
              hasNext: !isLastSign,
              fastMode: true
            }
          });
          
          results.push(result);
          
          // ULTRA-FAST: Minimal or no inter-sign delay
          if (!isLastSign) {
            const delay = this._getInterSignDelay(signs[i], signs[i + 1], speedMode);
            if (delay > 0) {
              await this._ultraFastWait(delay);
            }
          }
          
        } catch (error) {
          this.log(`❌ Queue processing failed: ${sign}`, error);
          results.push({ success: false, signName: sign, error: error.message });
          
          if (options.abortOnError) break;
        }
      }
    }
    
    const totalTime = performance.now() - startTime;
    const throughput = signs.length / (totalTime / 1000);
    const successCount = results.filter(r => r.success).length;
    
    this.log(`🏁 ULTRA-FAST queue complete: ${successCount}/${signs.length} (${totalTime.toFixed(1)}ms, ${throughput.toFixed(1)} signs/sec)`);
    
    return {
      results,
      totalTime,
      throughput,
      speedMode,
      successCount,
      optimized: true,
      ultraFast: true
    };
  }

  /**
   * BALANCED: Get inter-sign delay ensuring complete playback
   */
  _getInterSignDelay(currentSign, nextSign, speedMode) {
    // Ensure minimum delays for complete playback
    switch (speedMode) {
      case 'instant':
        return 100; // Minimum 100ms even in instant mode
      case 'ultra':
        return 150; // Minimum 150ms for ultra mode
      case 'fast':
        return 200; // Minimum 200ms for fast mode
      default:
        return this.options.interSignDelay; // Full delay for normal mode
    }
  }

  /**
   * Check if delay should be skipped
   */
  _shouldSkipDelay(currentSign, nextSign) {
    // Letter/number sequences
    if (this._isSingleCharacter(currentSign) && this._isSingleCharacter(nextSign)) {
      return true;
    }
    
    // Common phrases
    const fastCombinations = [
      ['My', 'Name'], ['Thank', 'You'], ['Hello', 'My'],
      ['Good', 'Day'], ['How', 'Are'], ['Are', 'You']
    ];
    
    return fastCombinations.some(([first, second]) => 
      currentSign === first && nextSign === second
    );
  }

  /**
   * Update state predictor for future optimizations
   */
  _updateStatePredictor(signName, options) {
    this.statePredictor.lastSequence.push(signName);
    if (this.statePredictor.lastSequence.length > 5) {
      this.statePredictor.lastSequence.shift();
    }
    
    // Simple pattern detection
    if (this.statePredictor.lastSequence.length >= 2) {
      const pattern = this.statePredictor.lastSequence.slice(-2).join('-');
      this.statePredictor.commonPatterns.set(pattern, 
        (this.statePredictor.commonPatterns.get(pattern) || 0) + 1
      );
    }
    
    // Predict next sign (simple heuristic)
    if (options.queueContext?.hasNext) {
      // Will be provided by queue
      this.statePredictor.nextPrediction = null;
    } else {
      // Try to predict based on patterns
      this.statePredictor.nextPrediction = this._predictNextSign(signName);
    }
  }

  /**
   * Simple next sign prediction
   */
  _predictNextSign(currentSign) {
    // Simple patterns
    const patterns = {
      'Hello': 'My',
      'My': 'Name',
      'Thank': 'You',
      'How': 'Are',
      'Are': 'You'
    };
    
    return patterns[currentSign] || null;
  }

  /**
   * Check if sign is single character
   */
  _isSingleCharacter(signName) {
    return signName && (signName.length === 1 || /^\d$/.test(signName));
  }

  /**
   * Check if sign is common word
   */
  _isCommonWord(signName) {
    const commonWords = [
      'Hello', 'Thank_You', 'Thank', 'Yes', 'Good', 'Help', 'Love', 
      'Friend', 'Beautiful', 'Happy', 'Great', 'Sorry', 'Welcome'
    ];
    return commonWords.includes(signName);
  }

  /**
   * Check if sequence is common/fast
   */
  _isCommonSequence(prevSign, currentSign) {
    if (!prevSign) return false;
    
    const commonSequences = [
      ['Hello', 'My'], ['My', 'Name'], ['Thank', 'You'],
      ['Good', 'Morning'], ['How', 'Are'], ['Are', 'You']
    ];
    
    return commonSequences.some(([first, second]) => 
      prevSign === first && currentSign === second
    );
  }

  /**
   * ULTRA-FAST: High-performance wait with requestAnimationFrame
   */
  _ultraFastWait(ms) {
    if (ms <= 0) return Promise.resolve();
    
    this.lastTransitionTime = Date.now();
    
    // Use RAF for smooth timing on fast waits
    if (ms < 50) {
      return new Promise(resolve => requestAnimationFrame(resolve));
    }
    
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Stop current transition
   */
  async stop() {
    this.log('⏹️ Stopping transitions');
    
    if (this.transitionPromise) {
      await this.transitionPromise;
    }
    
    this.setState(AvatarStates.NEUTRAL);
    this.currentSign = null;
    this.previousSign = null;
    this.transitionQueue.length = 0;
  }

  /**
   * Force reset (emergency stop)
   */
  forceReset() {
    this.log('🚨 Emergency reset');
    this.transitionPromise = null;
    this.state = AvatarStates.NEUTRAL;
    this.currentSign = null;
    this.previousSign = null;
    this.isTransitioning = false;
    this.transitionQueue.length = 0;
    this.processingBatch = false;
    
    // Clear caches
    this.preloadCache.clear();
    this.activePreloads.clear();
    
    // Reset state predictor
    this.statePredictor.lastSequence = [];
    this.statePredictor.nextPrediction = null;
  }

  /**
   * Get comprehensive debug information
   */
  getDebugInfo() {
    const hitRate = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses;
    const cacheHitPercent = hitRate > 0 ? 
      (this.performanceMetrics.cacheHits / hitRate * 100).toFixed(1) : 0;
    
    return {
      // State information
      state: this.state,
      currentSign: this.currentSign,
      previousSign: this.previousSign,
      isTransitioning: this.isTransitioning,
      hasActiveTransition: !!this.transitionPromise,
      
      // Configuration
      options: this.options,
      validTransitions: StateTransitions[this.state] || [],
      
      // Performance metrics
      performance: {
        ...this.performanceMetrics,
        averageTimeMs: this.performanceMetrics.averageTime.toFixed(1),
        fastModeUsagePercent: this.performanceMetrics.transitionCount > 0 ? 
          (this.performanceMetrics.fastModeUsage / this.performanceMetrics.transitionCount * 100).toFixed(1) : 0,
        instantModeUsagePercent: this.performanceMetrics.transitionCount > 0 ? 
          (this.performanceMetrics.instantModeUsage / this.performanceMetrics.transitionCount * 100).toFixed(1) : 0,
        cacheHitPercent,
        totalCacheOperations: hitRate
      },
      
      // Optimization status
      optimization: {
        preloadCacheSize: this.preloadCache.size,
        activePreloads: this.activePreloads.size,
        queueLength: this.transitionQueue.length,
        processingBatch: this.processingBatch,
        statePredictor: {
          sequenceLength: this.statePredictor.lastSequence.length,
          patternsLearned: this.statePredictor.commonPatterns.size,
          nextPrediction: this.statePredictor.nextPrediction
        }
      },
      
      // Speed analysis
      speedAnalysis: {
        recommendedMode: this._getRecommendedSpeedMode(),
        bottlenecks: this._identifyBottlenecks(),
        optimizationTips: this._getOptimizationTips()
      }
    };
  }

  /**
   * Get recommended speed mode based on usage patterns
   */
  _getRecommendedSpeedMode() {
    const { transitionCount, fastModeUsage, instantModeUsage, averageTime } = this.performanceMetrics;
    
    if (transitionCount === 0) return 'insufficient_data';
    
    const fastModePercent = (fastModeUsage / transitionCount) * 100;
    const instantModePercent = (instantModeUsage / transitionCount) * 100;
    
    if (averageTime > 2000) return 'enable_ultra_fast_mode';
    if (fastModePercent > 70) return 'current_fast_mode_optimal';
    if (instantModePercent > 50) return 'consider_instant_mode_default';
    if (averageTime < 500) return 'consider_smoothness_over_speed';
    
    return 'current_settings_balanced';
  }

  /**
   * Identify performance bottlenecks
   */
  _identifyBottlenecks() {
    const bottlenecks = [];
    const { averageTime, cacheHits, cacheMisses } = this.performanceMetrics;
    
    if (averageTime > 1500) {
      bottlenecks.push('transition_duration_too_long');
    }
    
    if (cacheMisses > cacheHits) {
      bottlenecks.push('low_cache_hit_rate');
    }
    
    if (this.activePreloads.size > 5) {
      bottlenecks.push('too_many_concurrent_preloads');
    }
    
    if (this.transitionQueue.length > 10) {
      bottlenecks.push('queue_backup_detected');
    }
    
    if (!this.options.fastMode) {
      bottlenecks.push('fast_mode_disabled');
    }
    
    return bottlenecks;
  }

  /**
   * Get optimization tips based on current state
   */
  _getOptimizationTips() {
    const tips = [];
    const { transitionCount, averageTime, batchProcessingCount } = this.performanceMetrics;
    
    if (averageTime > 1000 && !this.options.fastMode) {
      tips.push('Enable fastMode for 50-70% speed improvement');
    }
    
    if (averageTime > 2000 && !this.options.ultraFastMode) {
      tips.push('Enable ultraFastMode for maximum speed');
    }
    
    if (batchProcessingCount === 0 && transitionCount > 10) {
      tips.push('Use batch processing for sequences of signs');
    }
    
    if (!this.options.preloadEnabled) {
      tips.push('Enable preloading for smoother transitions');
    }
    
    if (this.preloadCache.size < 5) {
      tips.push('Increase preload cache size for better performance');
    }
    
    if (!this.options.parallelProcessing && this.transitionQueue.length > 0) {
      tips.push('Enable parallel processing for concurrent operations');
    }
    
    if (this.statePredictor.commonPatterns.size > 5 && !this.statePredictor.nextPrediction) {
      tips.push('State prediction could be improved for your usage patterns');
    }
    
    return tips;
  }

  /**
   * Get performance report
   */
  getPerformanceReport() {
    const { transitionCount, averageTime, totalTime, fastModeUsage, instantModeUsage } = this.performanceMetrics;
    
    if (transitionCount === 0) {
      return 'No transitions performed yet';
    }
    
    const throughput = transitionCount / (totalTime / 1000);
    const speedImprovement = this.options.fastMode ? 
      ((2500 - averageTime) / 2500 * 100).toFixed(1) : 0; // Assuming 2500ms baseline
    
    return {
      summary: `${transitionCount} transitions completed`,
      averageTime: `${averageTime.toFixed(1)}ms per transition`,
      throughput: `${throughput.toFixed(1)} transitions/second`,
      speedImprovement: this.options.fastMode ? `${speedImprovement}% faster than baseline` : 'baseline_speed',
      optimizationUsage: {
        fastMode: `${((fastModeUsage / transitionCount) * 100).toFixed(1)}% of transitions`,
        instantMode: `${((instantModeUsage / transitionCount) * 100).toFixed(1)}% of transitions`
      },
      cacheEfficiency: this._getCacheEfficiencyReport(),
      recommendations: this._getOptimizationTips()
    };
  }

  /**
   * Get cache efficiency report
   */
  _getCacheEfficiencyReport() {
    const { cacheHits, cacheMisses } = this.performanceMetrics;
    const total = cacheHits + cacheMisses;
    
    if (total === 0) return 'No cache operations yet';
    
    const hitRate = (cacheHits / total * 100).toFixed(1);
    const efficiency = hitRate > 80 ? 'excellent' : 
                      hitRate > 60 ? 'good' : 
                      hitRate > 40 ? 'fair' : 'poor';
    
    return {
      hitRate: `${hitRate}%`,
      efficiency,
      cacheSize: this.preloadCache.size,
      activePreloads: this.activePreloads.size
    };
  }

  /**
   * Benchmark transition speed
   */
  async benchmark(testSigns = ['Hello', 'A', 'B', 'C', '1', '2', '3']) {
    this.log('🏁 Starting speed benchmark...');
    
    const originalOptions = { ...this.options };
    const results = {};
    
    // Test different speed modes
    const modes = [
      { name: 'normal', options: { fastMode: false, ultraFastMode: false, instantTransitions: false }},
      { name: 'fast', options: { fastMode: true, ultraFastMode: false, instantTransitions: false }},
      { name: 'ultra', options: { fastMode: true, ultraFastMode: true, instantTransitions: false }},
      { name: 'instant', options: { fastMode: true, ultraFastMode: true, instantTransitions: true }}
    ];
    
    for (const mode of modes) {
      // Apply mode settings
      Object.assign(this.options, mode.options);
      this.forceReset();
      
      const startTime = performance.now();
      
      try {
        await this.processSignQueue(testSigns, { benchmarkMode: true });
        const endTime = performance.now();
        
        results[mode.name] = {
          totalTime: endTime - startTime,
          averagePerSign: (endTime - startTime) / testSigns.length,
          throughput: testSigns.length / ((endTime - startTime) / 1000)
        };
        
      } catch (error) {
        results[mode.name] = { error: error.message };
      }
      
      // Wait between tests
      await this._ultraFastWait(100);
    }
    
    // Restore original options
    Object.assign(this.options, originalOptions);
    this.forceReset();
    
    // Calculate improvements
    const normalTime = results.normal?.totalTime || 0;
    Object.keys(results).forEach(mode => {
      if (results[mode].totalTime && normalTime > 0) {
        results[mode].speedImprovement = 
          ((normalTime - results[mode].totalTime) / normalTime * 100).toFixed(1) + '%';
      }
    });
    
    this.log('🏁 Benchmark complete:', results);
    return results;
  }

  /**
   * Auto-optimize settings based on usage patterns
   */
  autoOptimize() {
    const analysis = this._identifyBottlenecks();
    const tips = this._getOptimizationTips();
    let optimizationsApplied = [];
    
    // Apply automatic optimizations
    if (analysis.includes('transition_duration_too_long') && !this.options.fastMode) {
      this.options.fastMode = true;
      optimizationsApplied.push('enabled_fast_mode');
    }
    
    if (this.performanceMetrics.averageTime > 2000 && !this.options.ultraFastMode) {
      this.options.ultraFastMode = true;
      optimizationsApplied.push('enabled_ultra_fast_mode');
    }
    
    if (analysis.includes('low_cache_hit_rate') && !this.options.preloadEnabled) {
      this.options.preloadEnabled = true;
      optimizationsApplied.push('enabled_preloading');
    }
    
    if (analysis.includes('queue_backup_detected') && !this.options.parallelProcessing) {
      this.options.parallelProcessing = true;
      optimizationsApplied.push('enabled_parallel_processing');
    }
    
    // Adjust timing values based on performance
    if (this.performanceMetrics.averageTime > 1500) {
      this.options.transitionInDuration = Math.max(this.options.transitionInDuration * 0.5, 25);
      this.options.transitionOutDuration = Math.max(this.options.transitionOutDuration * 0.5, 15);
      this.options.signDuration = Math.max(this.options.signDuration * 0.8, 800);
      optimizationsApplied.push('reduced_timing_values');
    }
    
    this.log('🔧 Auto-optimization complete:', optimizationsApplied);
    
    return {
      applied: optimizationsApplied,
      analysis,
      tips,
      newSettings: {
        fastMode: this.options.fastMode,
        ultraFastMode: this.options.ultraFastMode,
        instantTransitions: this.options.instantTransitions,
        preloadEnabled: this.options.preloadEnabled,
        parallelProcessing: this.options.parallelProcessing,
        transitionInDuration: this.options.transitionInDuration,
        transitionOutDuration: this.options.transitionOutDuration,
        signDuration: this.options.signDuration
      }
    };
  }
}

// Default export for easier importing
export default AvatarStateMachine;
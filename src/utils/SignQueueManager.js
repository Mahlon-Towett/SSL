// src/utils/SignQueueManager.js - OPTIMIZED for faster, smoother transitions

export class SignQueueManager {
  constructor(avatarStateMachine, options = {}) {
    this.avatarStateMachine = avatarStateMachine;
    this.queue = [];
    this.isProcessing = false;
    this.isPaused = false;
    this.currentIndex = 0;
    this.processPromise = null;
    
    // BALANCED Configuration for complete sign playback
    this.options = {
      autoStart: options.autoStart !== false,
      pauseOnError: options.pauseOnError !== false,
      maxRetries: options.maxRetries || 1, // Keep fast retry
      retryDelay: options.retryDelay || 300, // Quick retries
      interSignDelay: options.interSignDelay || 250, // BALANCED: 250ms vs 100ms for complete playback
      debugMode: options.debugMode || false,
      
      // BALANCED: Advanced timing controls for complete playback
      transitionOverlap: options.transitionOverlap || 0, // No overlap to ensure complete playback
      preloadNext: options.preloadNext !== false, // Keep preloading
      skipTransitionDelays: options.skipTransitionDelays || false, // Don't skip delays
      batchMode: options.batchMode || false, // Process multiple signs as batch
      completePlayback: options.completePlayback !== false, // NEW: Ensure complete playback
      
      ...options
    };

    // Event callbacks
    this.eventCallbacks = {
      onQueueStart: null,
      onQueueComplete: null,
      onQueuePause: null,
      onQueueResume: null,
      onSignStart: null,
      onSignComplete: null,
      onSignError: null,
      onProgress: null,
      ...options.callbacks
    };

    // OPTIMIZATION: Preloading cache
    this.preloadCache = new Map();
    this.isPreloading = false;

    if (this.options.debugMode) {
      this.log('🚀 OPTIMIZED SignQueueManager initialized', this.options);
    }
  }

  log(message, data = null) {
    if (this.options.debugMode) {
      console.log(`[FastQueue] ${message}`, data || '');
    }
  }

  /**
   * OPTIMIZED: Add single sign with immediate preloading
   */
  addSign(signName, options = {}) {
    const queueItem = {
      id: Math.random().toString(36).substring(2),
      signName,
      options: {
        ...options,
        fastMode: true, // Enable optimizations
        skipTransitions: this.queue.length > 3, // Skip transitions for long queues
      },
      retryCount: 0,
      status: 'pending',
      timestamp: Date.now()
    };

    this.queue.push(queueItem);
    this.log(`⚡ Added sign to queue: ${signName} (${this.queue.length} total)`);

    // OPTIMIZATION: Immediate preload for next items
    if (this.options.preloadNext && this.queue.length <= 3) {
      this._preloadSign(signName);
    }

    if (this.options.autoStart && !this.isProcessing && !this.isPaused) {
      this.start();
    }

    return queueItem.id;
  }

  /**
   * OPTIMIZED: Add multiple signs with batch processing
   */
  addSigns(signNames, options = {}) {
    const ids = [];
    const batchOptions = {
      batchId: Math.random().toString(36).substring(2),
      batchMode: true,
      fastTransitions: signNames.length > 2, // Enable fast mode for multiple signs
      ...options
    };

    // Process as batch for better performance
    if (signNames.length > 2) {
      batchOptions.interSignDelay = 50; // Even faster for batches
      batchOptions.skipTransitionDelays = true;
    }

    for (const signName of signNames) {
      const id = this.addSign(signName, batchOptions);
      ids.push(id);
    }

    this.log(`⚡ Added FAST sign batch: [${signNames.join(', ')}] (${ids.length} signs)`);
    
    // OPTIMIZATION: Preload entire batch
    this._preloadBatch(signNames);
    
    return ids;
  }

  /**
   * OPTIMIZATION: Preload videos for smoother playback
   */
  async _preloadSign(signName) {
    if (this.preloadCache.has(signName) || this.isPreloading) {
      return;
    }

    this.isPreloading = true;
    try {
      // Trigger avatar system to preload this sign
      if (this.avatarStateMachine && this.avatarStateMachine.preloadSign) {
        await this.avatarStateMachine.preloadSign(signName);
        this.preloadCache.set(signName, true);
        this.log(`📦 Preloaded: ${signName}`);
      }
    } catch (error) {
      this.log(`⚠️ Preload failed: ${signName}`, error);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * OPTIMIZATION: Preload multiple signs in batch
   */
  async _preloadBatch(signNames) {
    const uniqueSigns = [...new Set(signNames)];
    this.log(`📦 Batch preloading: ${uniqueSigns.length} signs`);
    
    const preloadPromises = uniqueSigns.map(signName => 
      this._preloadSign(signName).catch(error => 
        this.log(`⚠️ Batch preload failed: ${signName}`, error)
      )
    );
    
    await Promise.all(preloadPromises);
  }

  /**
   * Clear queue and optionally stop current processing
   */
  clear(stopCurrent = false) {
    this.log(`🗑️ Clearing queue (${this.queue.length} items)${stopCurrent ? ' and stopping current' : ''}`);
    
    this.queue = [];
    this.currentIndex = 0;
    this.preloadCache.clear(); // Clear preload cache

    if (stopCurrent && this.isProcessing) {
      this.stop();
    }
  }

  /**
   * OPTIMIZED: Start processing with fast mode detection
   */
  async start() {
    if (this.isProcessing) {
      this.log('⚠️ Queue already processing');
      return;
    }

    if (this.queue.length === 0) {
      this.log('⚠️ Queue is empty, nothing to process');
      return;
    }

    // OPTIMIZATION: Detect if we should use fast mode
    const shouldUseFastMode = this.queue.length > 2 || 
                             this.queue.some(item => item.options.batchMode);

    if (shouldUseFastMode) {
      this.log(`⚡ FAST MODE activated for ${this.queue.length} items`);
      this.options.interSignDelay = 50; // Super fast
      this.options.skipTransitionDelays = true;
    }

    this.log(`🚀 Starting OPTIMIZED queue processing (${this.queue.length} items)`);
    this.isProcessing = true;
    this.isPaused = false;

    this._triggerEvent('onQueueStart', {
      queueLength: this.queue.length,
      fastMode: shouldUseFastMode,
      timestamp: Date.now()
    });

    this.processPromise = this._processQueueOptimized();
    
    try {
      const result = await this.processPromise;
      return result;
    } finally {
      this.processPromise = null;
    }
  }

  /**
   * OPTIMIZED: Main queue processing with overlapping and preloading
   */
  async _processQueueOptimized() {
    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;

    try {
      while (this.currentIndex < this.queue.length && this.isProcessing) {
        // Handle pause
        while (this.isPaused && this.isProcessing) {
          await this._wait(50); // Faster pause checking
        }

        if (!this.isProcessing) break;

        const currentItem = this.queue[this.currentIndex];
        const nextItem = this.queue[this.currentIndex + 1];
        
        this.log(`⚡ FAST processing ${this.currentIndex + 1}/${this.queue.length}: ${currentItem.signName}`);

        currentItem.status = 'processing';
        currentItem.startTime = Date.now();

        this._triggerEvent('onSignStart', {
          item: currentItem,
          index: this.currentIndex,
          progress: ((this.currentIndex + 1) / this.queue.length) * 100
        });

        try {
          // OPTIMIZATION: Preload next sign while processing current
          if (nextItem && this.options.preloadNext) {
            this._preloadSign(nextItem.signName).catch(() => {}); // Don't wait
          }

          // OPTIMIZED: Use fast transition options
          const transitionOptions = {
            ...currentItem.options,
            fastMode: true,
            skipTransitions: currentItem.options.skipTransitions || this.options.skipTransitionDelays,
            preloaded: this.preloadCache.has(currentItem.signName),
            queueContext: {
              index: this.currentIndex,
              total: this.queue.length,
              isLast: this.currentIndex === this.queue.length - 1,
              hasNext: !!nextItem,
              fastMode: true
            }
          };

          // Process the sign through avatar state machine
          await this.avatarStateMachine.transitionToSign(currentItem.signName, transitionOptions);

          // Mark as completed
          currentItem.status = 'completed';
          currentItem.endTime = Date.now();
          currentItem.duration = currentItem.endTime - currentItem.startTime;
          successCount++;

          this.log(`✅ FAST completed: ${currentItem.signName} (${currentItem.duration}ms)`);

          this._triggerEvent('onSignComplete', {
            item: currentItem,
            index: this.currentIndex,
            progress: ((this.currentIndex + 1) / this.queue.length) * 100
          });

        } catch (error) {
          this.log(`❌ Error processing ${currentItem.signName}:`, error);
          
          currentItem.error = error.message;
          currentItem.endTime = Date.now();

          // OPTIMIZED: Faster retry logic
          if (currentItem.retryCount < this.options.maxRetries) {
            currentItem.retryCount++;
            currentItem.status = 'retrying';
            
            this.log(`🔄 Fast retry ${currentItem.signName} (${currentItem.retryCount}/${this.options.maxRetries})`);
            
            await this._wait(this.options.retryDelay);
            continue; // Don't increment currentIndex, retry same item
          } else {
            currentItem.status = 'failed';
            errorCount++;

            this._triggerEvent('onSignError', {
              item: currentItem,
              error,
              index: this.currentIndex
            });

            if (this.options.pauseOnError) {
              this.pause();
              break;
            }
          }
        }

        // Progress to next item
        this.currentIndex++;

        // Trigger progress update
        this._triggerEvent('onProgress', {
          current: this.currentIndex,
          total: this.queue.length,
          percentage: (this.currentIndex / this.queue.length) * 100,
          successCount,
          errorCount,
          remainingTime: this._estimateRemainingTime()
        });

        // OPTIMIZED: Dynamic inter-sign delay
        if (this.currentIndex < this.queue.length) {
          let delay = this.options.interSignDelay;
          
          // Skip delay for batch mode or fast sequences
          if (currentItem.options.batchMode || this.options.skipTransitionDelays) {
            delay = 25; // Minimal delay
          }
          
          // No delay for single letters/numbers in sequence
          if (this._isFastSequence(currentItem, nextItem)) {
            delay = 0;
          }
          
          if (delay > 0) {
            await this._wait(delay);
          }
        }
      }

      const totalTime = Date.now() - startTime;
      const avgItemTime = totalTime / Math.max(this.currentIndex, 1);
      
      const result = {
        completed: this.currentIndex >= this.queue.length && this.isProcessing,
        totalTime,
        avgItemTime,
        successCount,
        errorCount,
        processedItems: this.currentIndex,
        totalItems: this.queue.length,
        throughput: (this.currentIndex / (totalTime / 1000)).toFixed(1) // items/second
      };

      this.log(`🏁 OPTIMIZED queue completed:`, result);

      this._triggerEvent('onQueueComplete', result);

      return result;

    } finally {
      this.isProcessing = false;
      this.isPaused = false;
      
      // Reset optimizations
      this.options.interSignDelay = this.options.interSignDelay || 100;
      this.options.skipTransitionDelays = false;
    }
  }

  /**
   * OPTIMIZATION: Check if sequence can be processed rapidly
   */
  _isFastSequence(currentItem, nextItem) {
    if (!nextItem) return false;
    
    const current = currentItem.signName;
    const next = nextItem.signName;
    
    // Single letters/numbers in sequence can be very fast
    const isSingleChar = (str) => str.length === 1 || /^\d$/.test(str);
    
    if (isSingleChar(current) && isSingleChar(next)) {
      return true;
    }
    
    // Common words in sequence can also be faster
    const commonWords = ['Hello', 'Thank_You', 'Good', 'Yes', 'Help'];
    if (commonWords.includes(current) && commonWords.includes(next)) {
      return true;
    }
    
    return false;
  }

  /**
   * OPTIMIZED: Faster remaining time estimation
   */
  _estimateRemainingTime() {
    if (!this.isProcessing || this.queue.length === 0) return 0;

    const completedItems = this.queue.slice(0, this.currentIndex).filter(item => 
      item.status === 'completed' && item.duration
    );

    if (completedItems.length === 0) {
      // Use optimized estimates based on sign types
      const remainingItems = this.queue.length - this.currentIndex;
      const avgEstimate = 800; // Faster average for optimized processing
      return Math.round(avgEstimate * remainingItems);
    }

    const avgDuration = completedItems.reduce((sum, item) => sum + item.duration, 0) / completedItems.length;
    const remainingItems = this.queue.length - this.currentIndex;
    
    // Apply optimization factor
    const optimizationFactor = 0.8; // Expect 20% faster processing
    return Math.round(avgDuration * remainingItems * optimizationFactor);
  }

  /**
   * Pause queue processing
   */
  pause() {
    if (!this.isProcessing || this.isPaused) {
      this.log('⚠️ Queue not running or already paused');
      return;
    }

    this.log('⏸️ Pausing FAST queue processing');
    this.isPaused = true;

    this._triggerEvent('onQueuePause', {
      currentIndex: this.currentIndex,
      remaining: this.queue.length - this.currentIndex,
      timestamp: Date.now()
    });
  }

  /**
   * Resume queue processing
   */
  resume() {
    if (!this.isPaused) {
      this.log('⚠️ Queue not paused');
      return;
    }

    this.log('▶️ Resuming FAST queue processing');
    this.isPaused = false;

    this._triggerEvent('onQueueResume', {
      currentIndex: this.currentIndex,
      remaining: this.queue.length - this.currentIndex,
      timestamp: Date.now()
    });
  }

  /**
   * Stop queue processing
   */
  async stop() {
    this.log('⏹️ Stopping FAST queue processing');
    
    this.isProcessing = false;
    this.isPaused = false;

    // Stop avatar state machine
    if (this.avatarStateMachine) {
      await this.avatarStateMachine.stop();
    }

    if (this.processPromise) {
      await this.processPromise;
    }
  }

  /**
   * Get current queue status with optimization info
   */
  getStatus() {
    const pending = this.queue.filter(item => item.status === 'pending').length;
    const completed = this.queue.filter(item => item.status === 'completed').length;
    const failed = this.queue.filter(item => item.status === 'failed').length;
    const processing = this.queue.filter(item => item.status === 'processing').length;

    return {
      isProcessing: this.isProcessing,
      isPaused: this.isPaused,
      currentIndex: this.currentIndex,
      totalItems: this.queue.length,
      progress: this.queue.length > 0 ? (this.currentIndex / this.queue.length) * 100 : 0,
      items: {
        pending,
        processing,
        completed,
        failed
      },
      currentSign: this.getCurrentSign(),
      remainingTime: this._estimateRemainingTime(),
      
      // OPTIMIZATION: Performance metrics
      optimizations: {
        preloadCacheSize: this.preloadCache.size,
        fastModeActive: this.options.skipTransitionDelays,
        batchModeActive: this.queue.some(item => item.options.batchMode),
        avgProcessingTime: this._getAverageProcessingTime()
      }
    };
  }

  /**
   * Get current processing performance
   */
  _getAverageProcessingTime() {
    const completed = this.queue.filter(item => 
      item.status === 'completed' && item.duration
    );
    
    if (completed.length === 0) return 0;
    
    return Math.round(
      completed.reduce((sum, item) => sum + item.duration, 0) / completed.length
    );
  }

  /**
   * Get currently processing sign
   */
  getCurrentSign() {
    if (this.currentIndex < this.queue.length) {
      return this.queue[this.currentIndex];
    }
    return null;
  }

  /**
   * Trigger event callback if defined
   */
  _triggerEvent(eventName, data) {
    const callback = this.eventCallbacks[eventName];
    if (typeof callback === 'function') {
      try {
        callback(data);
      } catch (error) {
        console.error(`[FastQueue] Event callback error (${eventName}):`, error);
      }
    }
  }

  /**
   * Promise-based wait utility
   */
  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Set event callback
   */
  on(eventName, callback) {
    if (this.eventCallbacks.hasOwnProperty(eventName)) {
      this.eventCallbacks[eventName] = callback;
      return true;
    }
    return false;
  }

  /**
   * Remove event callback
   */
  off(eventName) {
    if (this.eventCallbacks.hasOwnProperty(eventName)) {
      this.eventCallbacks[eventName] = null;
      return true;
    }
    return false;
  }

  /**
   * Get queue items with optional filtering
   */
  getQueue(filter = null) {
    if (!filter) return [...this.queue];
    
    return this.queue.filter(item => {
      if (typeof filter === 'string') return item.status === filter;
      if (typeof filter === 'function') return filter(item);
      return true;
    });
  }

  /**
   * Get detailed debug information with optimization stats
   */
  getDebugInfo() {
    return {
      isProcessing: this.isProcessing,
      isPaused: this.isPaused,
      currentIndex: this.currentIndex,
      queueLength: this.queue.length,
      options: this.options,
      status: this.getStatus(),
      
      // OPTIMIZATION: Performance debugging
      performance: {
        preloadCacheHits: this.preloadCache.size,
        averageItemTime: this._getAverageProcessingTime(),
        throughput: this._calculateThroughput(),
        optimizationsActive: {
          fastMode: this.options.skipTransitionDelays,
          batchMode: this.queue.some(item => item.options.batchMode),
          preloading: this.options.preloadNext
        }
      },
      
      queue: this.queue.map(item => ({
        id: item.id,
        signName: item.signName,
        status: item.status,
        retryCount: item.retryCount,
        duration: item.duration,
        error: item.error,
        optimized: item.options.fastMode || false
      }))
    };
  }

  /**
   * Calculate processing throughput
   */
  _calculateThroughput() {
    const completed = this.queue.filter(item => 
      item.status === 'completed' && item.startTime && item.endTime
    );
    
    if (completed.length < 2) return 0;
    
    const firstStart = Math.min(...completed.map(item => item.startTime));
    const lastEnd = Math.max(...completed.map(item => item.endTime));
    const totalTime = (lastEnd - firstStart) / 1000; // seconds
    
    return totalTime > 0 ? (completed.length / totalTime).toFixed(2) : 0;
  }
}

// Default export for easier importing
export default SignQueueManager;
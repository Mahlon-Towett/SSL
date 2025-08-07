// src/utils/SignQueueManager.js - Advanced queue management for sign sequences

export class SignQueueManager {
  constructor(avatarStateMachine, options = {}) {
    this.avatarStateMachine = avatarStateMachine;
    this.queue = [];
    this.isProcessing = false;
    this.isPaused = false;
    this.currentIndex = 0;
    this.processPromise = null;
    
    // Configuration
    this.options = {
      autoStart: options.autoStart !== false,
      pauseOnError: options.pauseOnError !== false,
      maxRetries: options.maxRetries || 2,
      retryDelay: options.retryDelay || 1000,
      interSignDelay: options.interSignDelay || 200,
      debugMode: options.debugMode || false,
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

    if (this.options.debugMode) {
      this.log('🎭 SignQueueManager initialized', this.options);
    }
  }

  log(message, data = null) {
    if (this.options.debugMode) {
      console.log(`[SignQueue] ${message}`, data || '');
    }
  }

  /**
   * Add single sign to queue
   */
  addSign(signName, options = {}) {
    const queueItem = {
      id: Math.random().toString(36).substring(2),
      signName,
      options,
      retryCount: 0,
      status: 'pending',
      timestamp: Date.now()
    };

    this.queue.push(queueItem);
    this.log(`➕ Added sign to queue: ${signName} (${this.queue.length} total)`);

    if (this.options.autoStart && !this.isProcessing && !this.isPaused) {
      this.start();
    }

    return queueItem.id;
  }

  /**
   * Add multiple signs to queue
   */
  addSigns(signNames, options = {}) {
    const ids = [];
    const batchOptions = {
      batchId: Math.random().toString(36).substring(2),
      ...options
    };

    for (const signName of signNames) {
      const id = this.addSign(signName, batchOptions);
      ids.push(id);
    }

    this.log(`➕ Added sign batch: [${signNames.join(', ')}] (${ids.length} signs)`);
    return ids;
  }

  /**
   * Clear queue and optionally stop current processing
   */
  clear(stopCurrent = false) {
    this.log(`🗑️ Clearing queue (${this.queue.length} items)${stopCurrent ? ' and stopping current' : ''}`);
    
    this.queue = [];
    this.currentIndex = 0;

    if (stopCurrent && this.isProcessing) {
      this.stop();
    }
  }

  /**
   * Start processing the queue
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

    this.log(`🚀 Starting queue processing (${this.queue.length} items)`);
    this.isProcessing = true;
    this.isPaused = false;

    this._triggerEvent('onQueueStart', {
      queueLength: this.queue.length,
      timestamp: Date.now()
    });

    this.processPromise = this._processQueue();
    
    try {
      const result = await this.processPromise;
      return result;
    } finally {
      this.processPromise = null;
    }
  }

  /**
   * Pause queue processing
   */
  pause() {
    if (!this.isProcessing || this.isPaused) {
      this.log('⚠️ Queue not running or already paused');
      return;
    }

    this.log('⏸️ Pausing queue processing');
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

    this.log('▶️ Resuming queue processing');
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
    this.log('⏹️ Stopping queue processing');
    
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
   * Get current queue status
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
      remainingTime: this._estimateRemainingTime()
    };
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
   * Internal queue processing logic
   */
  async _processQueue() {
    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;

    try {
      while (this.currentIndex < this.queue.length && this.isProcessing) {
        // Handle pause
        while (this.isPaused && this.isProcessing) {
          await this._wait(100);
        }

        if (!this.isProcessing) break;

        const currentItem = this.queue[this.currentIndex];
        this.log(`🎬 Processing item ${this.currentIndex + 1}/${this.queue.length}: ${currentItem.signName}`);

        currentItem.status = 'processing';
        currentItem.startTime = Date.now();

        this._triggerEvent('onSignStart', {
          item: currentItem,
          index: this.currentIndex,
          progress: ((this.currentIndex + 1) / this.queue.length) * 100
        });

        try {
          // Process the sign through avatar state machine
          await this.avatarStateMachine.transitionToSign(currentItem.signName, {
            ...currentItem.options,
            queueContext: {
              index: this.currentIndex,
              total: this.queue.length,
              isLast: this.currentIndex === this.queue.length - 1
            }
          });

          // Mark as completed
          currentItem.status = 'completed';
          currentItem.endTime = Date.now();
          currentItem.duration = currentItem.endTime - currentItem.startTime;
          successCount++;

          this.log(`✅ Completed: ${currentItem.signName} (${currentItem.duration}ms)`);

          this._triggerEvent('onSignComplete', {
            item: currentItem,
            index: this.currentIndex,
            progress: ((this.currentIndex + 1) / this.queue.length) * 100
          });

        } catch (error) {
          this.log(`❌ Error processing ${currentItem.signName}:`, error);
          
          currentItem.error = error.message;
          currentItem.endTime = Date.now();

          // Handle retries
          if (currentItem.retryCount < this.options.maxRetries) {
            currentItem.retryCount++;
            currentItem.status = 'retrying';
            
            this.log(`🔄 Retrying ${currentItem.signName} (attempt ${currentItem.retryCount}/${this.options.maxRetries})`);
            
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
          errorCount
        });

        // Inter-sign delay
        if (this.currentIndex < this.queue.length && this.options.interSignDelay > 0) {
          await this._wait(this.options.interSignDelay);
        }
      }

      const totalTime = Date.now() - startTime;
      const result = {
        completed: this.currentIndex >= this.queue.length && this.isProcessing,
        totalTime,
        successCount,
        errorCount,
        processedItems: this.currentIndex,
        totalItems: this.queue.length
      };

      this.log(`🏁 Queue processing finished:`, result);

      this._triggerEvent('onQueueComplete', result);

      return result;

    } finally {
      this.isProcessing = false;
      this.isPaused = false;
    }
  }

  /**
   * Estimate remaining processing time
   */
  _estimateRemainingTime() {
    if (!this.isProcessing || this.queue.length === 0) return 0;

    const completedItems = this.queue.slice(0, this.currentIndex).filter(item => 
      item.status === 'completed' && item.duration
    );

    if (completedItems.length === 0) return null;

    const avgDuration = completedItems.reduce((sum, item) => sum + item.duration, 0) / completedItems.length;
    const remainingItems = this.queue.length - this.currentIndex;
    
    return Math.round(avgDuration * remainingItems);
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
        console.error(`[SignQueue] Event callback error (${eventName}):`, error);
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
   * Get detailed debug information
   */
  getDebugInfo() {
    return {
      isProcessing: this.isProcessing,
      isPaused: this.isPaused,
      currentIndex: this.currentIndex,
      queueLength: this.queue.length,
      options: this.options,
      status: this.getStatus(),
      queue: this.queue.map(item => ({
        id: item.id,
        signName: item.signName,
        status: item.status,
        retryCount: item.retryCount,
        duration: item.duration,
        error: item.error
      }))
    };
  }
}

// Default export for easier importing
export default SignQueueManager;
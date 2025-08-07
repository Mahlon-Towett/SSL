// src/utils/AvatarStateMachine.js - State management for avatar animations

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
    
    // Configuration options
    this.options = {
      transitionInDuration: options.transitionInDuration || 300,
      transitionOutDuration: options.transitionOutDuration || 200,
      signDuration: options.signDuration || 2500,
      interSignDelay: options.interSignDelay || 150,
      enableSmoothing: options.enableSmoothing !== false,
      debugMode: options.debugMode || false,
      ...options
    };

    if (this.options.debugMode) {
      this.log('🤖 AvatarStateMachine initialized with options:', this.options);
    }
  }

  log(message, data = null) {
    if (this.options.debugMode) {
      console.log(`[AvatarSM] ${message}`, data || '');
    }
  }

  /**
   * Get current state information
   */
  getState() {
    return {
      current: this.state,
      currentSign: this.currentSign,
      previousSign: this.previousSign,
      isTransitioning: this.isTransitioning,
      canTransition: !this.isTransitioning
    };
  }

  /**
   * Check if transition is valid
   */
  canTransitionTo(newState) {
    const allowedTransitions = StateTransitions[this.state] || [];
    return allowedTransitions.includes(newState);
  }

  /**
   * Register state change callback
   */
  onStateChange(callback) {
    const id = Math.random().toString(36);
    this.stateChangeCallbacks.set(id, callback);
    return id;
  }

  /**
   * Remove state change callback
   */
  removeStateChangeCallback(id) {
    return this.stateChangeCallbacks.delete(id);
  }

  /**
   * Change state with validation and callbacks
   */
  setState(newState, data = {}) {
    if (!this.canTransitionTo(newState)) {
      this.log(`❌ Invalid state transition: ${this.state} -> ${newState}`);
      return false;
    }

    const oldState = this.state;
    this.state = newState;
    this.isTransitioning = [
      AvatarStates.LOADING,
      AvatarStates.TRANSITIONING_IN,
      AvatarStates.TRANSITIONING_OUT
    ].includes(newState);

    this.log(`🔄 State changed: ${oldState} -> ${newState}`, data);

    // Notify callbacks
    this.stateChangeCallbacks.forEach(callback => {
      try {
        callback({
          oldState,
          newState,
          data,
          machine: this
        });
      } catch (error) {
        console.error('[AvatarSM] State change callback error:', error);
      }
    });

    return true;
  }

  /**
   * Transition to a new sign with full state management
   */
  async transitionToSign(signName, options = {}) {
    // Prevent concurrent transitions
    if (this.transitionPromise) {
      this.log('⏳ Waiting for current transition to complete...');
      await this.transitionPromise;
    }

    this.transitionPromise = this._performSignTransition(signName, options);
    
    try {
      const result = await this.transitionPromise;
      this.transitionPromise = null;
      return result;
    } catch (error) {
      this.transitionPromise = null;
      throw error;
    }
  }

  /**
   * Internal method to perform the actual sign transition
   */
  async _performSignTransition(signName, options = {}) {
    const startTime = performance.now();
    this.log(`🎬 Starting transition to sign: ${signName}`);

    try {
      // 1. Loading Phase
      if (!this.setState(AvatarStates.LOADING, { signName })) {
        throw new Error('Failed to enter loading state');
      }

      this.previousSign = this.currentSign;
      this.currentSign = signName;

      // Allow external systems to prepare (video loading, etc.)
      if (options.onLoadStart) {
        await options.onLoadStart(signName);
      }

      // 2. Transition Out (if coming from another sign)
      if (this.previousSign && this.state !== AvatarStates.NEUTRAL) {
        this.setState(AvatarStates.TRANSITIONING_OUT, { 
          from: this.previousSign, 
          to: signName 
        });

        if (options.onTransitionOut) {
          await options.onTransitionOut(this.previousSign, signName);
        }

        await this._wait(this.options.transitionOutDuration);
      }

      // 3. Transition In
      this.setState(AvatarStates.TRANSITIONING_IN, { signName });

      if (options.onTransitionIn) {
        await options.onTransitionIn(signName, this.previousSign);
      }

      await this._wait(this.options.transitionInDuration);

      // 4. Signing Phase
      this.setState(AvatarStates.SIGNING, { signName });

      if (options.onSignStart) {
        await options.onSignStart(signName);
      }

      // Dynamic duration based on sign type
      const duration = this._getSignDuration(signName, options.duration);
      await this._wait(duration);

      if (options.onSignEnd) {
        await options.onSignEnd(signName);
      }

      // 5. Return to Neutral (unless interrupted)
      if (this.state === AvatarStates.SIGNING) {
        this.setState(AvatarStates.NEUTRAL, { signName });
      }

      const totalTime = performance.now() - startTime;
      this.log(`✅ Sign transition completed: ${signName} (${totalTime.toFixed(1)}ms)`);

      return {
        success: true,
        signName,
        duration: totalTime,
        previousSign: this.previousSign
      };

    } catch (error) {
      this.log(`❌ Sign transition failed: ${signName}`, error);
      this.setState(AvatarStates.ERROR, { signName, error: error.message });
      
      // Auto-recover after error
      setTimeout(() => {
        if (this.state === AvatarStates.ERROR) {
          this.setState(AvatarStates.NEUTRAL);
        }
      }, 1000);

      throw error;
    }
  }

  /**
   * Process a queue of signs sequentially
   */
  async processSignQueue(signs, options = {}) {
    this.log(`📋 Processing sign queue: [${signs.join(', ')}]`);
    const results = [];

    for (let i = 0; i < signs.length; i++) {
      const sign = signs[i];
      const isLastSign = i === signs.length - 1;

      try {
        const result = await this.transitionToSign(sign, {
          ...options,
          queuePosition: i + 1,
          queueTotal: signs.length,
          isLastInQueue: isLastSign
        });

        results.push(result);

        // Inter-sign delay (except for last sign)
        if (!isLastSign && this.options.interSignDelay > 0) {
          await this._wait(this.options.interSignDelay);
        }

      } catch (error) {
        this.log(`❌ Queue processing failed at sign ${i + 1}: ${sign}`, error);
        results.push({ success: false, signName: sign, error: error.message });
        
        // Continue with next sign or abort based on options
        if (options.abortOnError) {
          break;
        }
      }
    }

    this.log(`✅ Queue processing completed: ${results.filter(r => r.success).length}/${signs.length} successful`);
    return results;
  }

  /**
   * Immediately stop current transition and return to neutral
   */
  async stop() {
    this.log('⏹️ Stopping current transition');
    
    if (this.transitionPromise) {
      // Let current transition complete naturally but don't start new ones
      await this.transitionPromise;
    }
    
    this.setState(AvatarStates.NEUTRAL);
    this.currentSign = null;
    this.previousSign = null;
  }

  /**
   * Force immediate return to neutral state (emergency stop)
   */
  forceReset() {
    this.log('🚨 Force reset to neutral state');
    this.transitionPromise = null;
    this.state = AvatarStates.NEUTRAL;
    this.currentSign = null;
    this.previousSign = null;
    this.isTransitioning = false;
  }

  /**
   * Get appropriate duration for different sign types
   */
  _getSignDuration(signName, overrideDuration) {
    if (overrideDuration) return overrideDuration;

    // Single letters and numbers get shorter duration
    if (signName.length === 1 || /^\d$/.test(signName)) {
      return 1500;
    }

    // Regular words get standard duration
    return this.options.signDuration;
  }

  /**
   * Promise-based wait utility
   */
  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get detailed state information for debugging
   */
  getDebugInfo() {
    return {
      state: this.state,
      currentSign: this.currentSign,
      previousSign: this.previousSign,
      isTransitioning: this.isTransitioning,
      hasActiveTransition: !!this.transitionPromise,
      callbackCount: this.stateChangeCallbacks.size,
      options: this.options,
      validTransitions: StateTransitions[this.state] || []
    };
  }
}

// Default export for easier importing
export default AvatarStateMachine;
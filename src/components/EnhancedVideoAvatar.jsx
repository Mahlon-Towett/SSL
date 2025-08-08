// src/components/EnhancedVideoAvatar.jsx - FIXED to actually play videos
import React, { useRef, useEffect, useState, useCallback } from 'react';

const EnhancedVideoAvatar = ({ 
  currentSign = 'Hello', 
  isPlaying = false, 
  onVideoComplete,
  onStateChange,
  debugMode = false,
  fastMode = false,
  transitionSpeed = 'normal'
}) => {
  // Refs
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  // State
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const [currentVideoPath, setCurrentVideoPath] = useState('');
  const [videoState, setVideoState] = useState('neutral');

  // Debug logger
  const log = useCallback((message, data = null) => {
    if (debugMode) {
      console.log(`[VideoAvatar] ${message}`, data || '');
    }
  }, [debugMode]);

  // Get video path for sign
  const getVideoPath = useCallback((signName) => {
    // Map sign names to video files in public/videos/ folder
    const videoPath = `./videos/${signName}.mp4`;
    log(`Getting video path for ${signName}: ${videoPath}`);
    return videoPath;
  }, [log]);

  // Load video for current sign
  const loadVideo = useCallback(async (signName) => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const videoPath = getVideoPath(signName);
    
    log(`Loading video: ${signName} from ${videoPath}`);
    setVideoState('loading');
    setVideoLoaded(false);
    setVideoError(null);
    onStateChange?.('loading', { signName });

    try {
      // Smooth transition: Don't reset video immediately, let it load in background
      const tempVideo = document.createElement('video');
      tempVideo.src = videoPath;
      tempVideo.preload = 'auto';
      tempVideo.muted = true;
      tempVideo.playsInline = true;
      
      // Load the new video in background
      await new Promise((resolve, reject) => {
        const handleLoadedData = () => {
          log(`✅ Video loaded successfully: ${signName}`);
          
          // Smooth transition: Only now switch the source
          video.pause();
          video.src = videoPath;
          video.currentTime = 0;
          setCurrentVideoPath(videoPath);
          
          // Set states after smooth transition
          setVideoLoaded(true);
          setVideoState('ready');
          onStateChange?.('neutral', { signName });
          resolve();
        };

        const handleError = (e) => {
          const errorMsg = `Failed to load video: ${signName}`;
          log(`❌ ${errorMsg}`, e);
          setVideoError(errorMsg);
          setVideoState('error');
          onStateChange?.('error', { signName, error: errorMsg });
          reject(new Error(errorMsg));
        };

        tempVideo.addEventListener('loadeddata', handleLoadedData, { once: true });
        tempVideo.addEventListener('error', handleError, { once: true });
        
        // Start loading in background
        tempVideo.load();
      });

    } catch (error) {
      log(`❌ Error loading video: ${signName}`, error);
      setVideoError(error.message);
    }
  }, [log, getVideoPath, onStateChange]);

  // Play current video with smooth start
  const playVideo = useCallback(async () => {
    if (!videoRef.current || !videoLoaded) {
      log('⚠️ Cannot play - video not loaded');
      return;
    }

    const video = videoRef.current;
    
    try {
      log(`▶️ Playing video: ${currentSign}`);
      setVideoState('playing');
      onStateChange?.('signing', { signName: currentSign });

      // Smooth start: ensure video is at beginning but don't cause flicker
      if (video.currentTime !== 0) {
        video.currentTime = 0;
      }
      
      // Play the video smoothly
      await video.play();
      
    } catch (error) {
      log(`❌ Error playing video: ${currentSign}`, error);
      setVideoError(`Playback failed: ${error.message}`);
      setVideoState('error');
      onStateChange?.('error', { signName: currentSign, error: error.message });
    }
  }, [videoLoaded, currentSign, log, onStateChange]);

  // Pause and smoothly return to neutral pose
  const pauseVideo = useCallback(() => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    video.pause();
    
    // Smooth transition to neutral without flicker
    setTimeout(() => {
      if (video.currentTime !== 0) {
        video.currentTime = 0;
      }
      setVideoState('neutral');
    }, 50); // Very short delay to prevent flicker
    
    log(`⏸️ Smoothly paused and returned to neutral: ${currentSign}`);
  }, [currentSign, log]);

  // Handle video end - smoother transition to neutral
  const handleVideoEnd = useCallback(() => {
    log(`🏁 Video completed: ${currentSign}, preparing for next transition`);
    
    const video = videoRef.current;
    if (video) {
      // Smooth transition: Keep video at end frame momentarily before neutral
      setTimeout(() => {
        if (video && video.duration > 0) {
          // Smooth fade to neutral: gradually go to frame 0
          video.currentTime = 0;
          setVideoState('neutral');
          log('↩️ Smoothly transitioned to neutral pose');
        }
      }, 200); // Reduced delay for smoother flow
    }
    
    onStateChange?.('neutral', { signName: currentSign });
    onVideoComplete?.(currentSign);
  }, [currentSign, log, onStateChange, onVideoComplete]);

  // Load video when sign changes
  useEffect(() => {
    if (currentSign) {
      loadVideo(currentSign);
    }
  }, [currentSign, loadVideo]);

  // Play video when isPlaying changes to true
  useEffect(() => {
    if (isPlaying && videoLoaded) {
      playVideo();
    } else if (!isPlaying && videoRef.current) {
      pauseVideo(); // Use new pause function that returns to neutral
    }
  }, [isPlaying, videoLoaded, playVideo, pauseVideo]);

  // Set up video event listeners with better timing detection
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Handle video end with proper timing - more conservative
    const handleEnd = () => {
      // Ensure video has fully played before transitioning
      if (video.currentTime >= video.duration - 0.2) { // More tolerant: 0.2s vs 0.1s
        handleVideoEnd();
      }
    };

    // Handle timeupdate to ensure we catch the real end - more conservative
    const handleTimeUpdate = () => {
      if (video.currentTime >= video.duration - 0.1) { // More tolerant timing
        video.pause();
        handleVideoEnd();
      }
    };

    video.addEventListener('ended', handleEnd);
    video.addEventListener('timeupdate', handleTimeUpdate);
    
    return () => {
      video.removeEventListener('ended', handleEnd);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [handleVideoEnd]);

  // Get status color based on state
  const getStatusColor = () => {
    switch (videoState) {
      case 'loading': return '#f59e0b';
      case 'ready': return '#10b981';
      case 'playing': return '#06b6d4';
      case 'neutral': return '#8b5cf6';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  // Get status text
  const getStatusText = () => {
    switch (videoState) {
      case 'loading': return 'Loading';
      case 'ready': return 'Ready';
      case 'playing': return 'Playing';
      case 'neutral': return 'Ready';
      case 'error': return 'Error';
      default: return 'Idle';
    }
  };

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'relative',
        width: '500px',
        height: '400px',
        border: `3px solid ${getStatusColor()}`,
        borderRadius: '16px',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
        boxShadow: `0 10px 40px rgba(0,0,0,0.4), 0 0 20px ${getStatusColor()}33`,
        transition: 'all 0.3s ease'
      }}
    >
      {/* Video Element with smooth transitions */}
      <video
        ref={videoRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          background: '#000',
          transition: 'opacity 0.15s ease-in-out', // Smooth opacity transition
          opacity: videoState === 'loading' ? 0.7 : 1 // Slight fade during loading
        }}
        muted
        playsInline
        preload="auto"
      />
      
      {/* Status Overlay - Only show in debug mode or for errors */}
      {(debugMode || videoState === 'error' || videoState === 'loading') && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          background: 'rgba(0,0,0,0.8)',
          color: getStatusColor(),
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          backdropFilter: 'blur(10px)',
          border: `1px solid ${getStatusColor()}66`
        }}>
          {getStatusText()}
        </div>
      )}

      {/* Current Sign Display - Only show in debug mode */}
      {debugMode && (
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'rgba(0,0,0,0.8)',
          color: '#ffffff',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '14px',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.3)'
        }}>
          {currentSign?.replace('_', ' ') || 'None'}
        </div>
      )}

      {/* Neutral Pose Indicator */}
      {videoState === 'neutral' && videoLoaded && (
        <div style={{
          position: 'absolute',
          bottom: '12px',
          right: fastMode ? '140px' : '12px',
          background: 'rgba(139, 92, 246, 0.9)',
          color: '#ffffff',
          padding: '6px 10px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(139, 92, 246, 0.6)'
        }}>
          🤲 Neutral Pose
        </div>
      )}
      {fastMode && (
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          background: 'rgba(16, 185, 129, 0.9)',
          color: '#ffffff',
          padding: '4px 8px',
          borderRadius: '6px',
          fontSize: '10px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          ⚡ {transitionSpeed.toUpperCase()} MODE
        </div>
      )}

      {/* Error Display */}
      {videoError && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.9)',
          color: '#ef4444',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px'
          }}>
            ❌
          </div>
          <h3 style={{
            margin: '0 0 8px 0',
            fontSize: '18px',
            fontWeight: 'bold'
          }}>
            {currentSign?.toUpperCase() || 'ERROR'}
          </h3>
          <p style={{
            margin: 0,
            fontSize: '14px',
            opacity: 0.8,
            maxWidth: '300px'
          }}>
            {videoError}
          </p>
          <p style={{
            margin: '12px 0 0 0',
            fontSize: '12px',
            opacity: 0.6
          }}>
            Check: {currentVideoPath}
          </p>
        </div>
      )}

      {/* Loading Display */}
      {videoState === 'loading' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)',
          color: '#f59e0b'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid transparent',
            borderTop: '4px solid #f59e0b',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px'
          }} />
          <p style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 'bold'
          }}>
            Loading {currentSign}...
          </p>
        </div>
      )}

      {/* Debug Info */}
      {debugMode && (
        <div style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          background: 'rgba(0,0,0,0.9)',
          color: '#00ff00',
          padding: '8px',
          borderRadius: '6px',
          fontSize: '10px',
          fontFamily: 'monospace',
          maxWidth: '200px',
          lineHeight: '1.3'
        }}>
          <div>Sign: {currentSign}</div>
          <div>State: {videoState}</div>
          <div>Loaded: {videoLoaded ? 'Yes' : 'No'}</div>
          <div>Playing: {isPlaying ? 'Yes' : 'No'}</div>
          <div>Fast: {fastMode ? 'Yes' : 'No'}</div>
          <div>Speed: {transitionSpeed}</div>
          <div>Neutral: {videoState === 'neutral' ? 'Yes' : 'No'}</div>
          {videoError && <div style={{color: '#ff4444'}}>Error: {videoError}</div>}
        </div>
      )}

      {/* CSS Animation Styles */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default EnhancedVideoAvatar;
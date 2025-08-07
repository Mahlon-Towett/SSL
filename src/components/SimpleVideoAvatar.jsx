// src/components/SimpleVideoAvatar.jsx - Simple fallback video avatar
import React, { useRef, useEffect, useState } from 'react';

const SimpleVideoAvatar = ({ 
  currentSign = 'Hello', 
  isPlaying = false, 
  onVideoComplete 
}) => {
  const videoRef = useRef(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [error, setError] = useState(null);

  // Simple video mappings
  const getVideoPath = (signName) => {
    return `./videos/${signName}.mp4`;
  };

  // Handle sign changes
  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const videoPath = getVideoPath(currentSign);
    
    // Reset states
    setVideoLoaded(false);
    setError(null);
    
    // Load new video
    video.src = videoPath;
    video.load();
    
    const handleLoadedData = () => {
      setVideoLoaded(true);
      video.currentTime = 0;
    };
    
    const handleError = () => {
      setError(`Video not found: ${currentSign}`);
      setVideoLoaded(false);
    };
    
    const handleEnded = () => {
      video.currentTime = 0;
      onVideoComplete?.(currentSign);
    };
    
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    video.addEventListener('ended', handleEnded);
    
    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      video.removeEventListener('ended', handleEnded);
    };
  }, [currentSign, onVideoComplete]);

  // Handle play/pause
  useEffect(() => {
    if (!videoRef.current || !videoLoaded) return;

    const video = videoRef.current;
    
    if (isPlaying) {
      video.currentTime = 0;
      video.play().catch(e => {
        console.warn('Video play failed:', e);
      });
    } else {
      video.pause();
    }
  }, [isPlaying, videoLoaded]);

  return (
    <div style={{
      position: 'relative',
      width: '500px',
      height: '400px',
      border: '3px solid #444',
      borderRadius: '15px',
      overflow: 'hidden',
      background: '#1a1a1a'
    }}>
      {/* Video Element */}
      <video
        ref={videoRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain'
        }}
        muted
        playsInline
      />
      
      {/* Loading Overlay */}
      {!videoLoaded && !error && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)',
          color: '#fff',
          gap: '16px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #333',
            borderTop: '4px solid #6366f1',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <p>Loading {currentSign}...</p>
        </div>
      )}
      
      {/* Error Overlay */}
      {error && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)',
          color: '#ff6b6b',
          gap: '16px',
          textAlign: 'center',
          padding: '20px'
        }}>
          <h3>{currentSign.toUpperCase()}</h3>
          <p style={{ fontSize: '14px', opacity: 0.8 }}>{error}</p>
        </div>
      )}
      
      {/* Status Indicators */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'rgba(0,0,0,0.7)',
        color: videoLoaded ? '#00ff00' : '#ffaa00',
        padding: '5px 10px',
        borderRadius: '5px',
        fontSize: '12px',
        fontFamily: 'monospace'
      }}>
        {videoLoaded ? '● READY' : '● LOADING'}
      </div>

      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'rgba(0,0,0,0.7)',
        color: isPlaying ? '#00ff00' : '#ffaa00',
        padding: '5px 10px',
        borderRadius: '5px',
        fontSize: '12px',
        fontFamily: 'monospace'
      }}>
        {isPlaying ? '▶ PLAYING' : '⏸ PAUSED'}
      </div>
    </div>
  );
};

export default SimpleVideoAvatar;
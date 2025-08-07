// src/components/EnhancedVideoAvatar.jsx - New improved video avatar with state management

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import VideoPoolManager from '../utils/VideoPoolManager';
import AvatarStateMachine, { AvatarStates } from '../utils/AvatarStateMachine';
import { VIDEO_MAPPINGS, PRIORITY_SIGNS, getVideoPath, hasVideo } from '../constants/videoMappings';

const EnhancedVideoAvatar = ({ 
  currentSign = 'Hello', 
  isPlaying = false, 
  onVideoComplete,
  onStateChange,
  debugMode = false 
}) => {
  // Refs
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const animationRef = useRef(null);
  const currentVideoRef = useRef(null);
  const cleanupRef = useRef(null);

  // State
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [preloadStatus, setPreloadStatus] = useState({ loaded: 0, total: 0, percentage: 0 });
  const [avatarState, setAvatarState] = useState(AvatarStates.NEUTRAL);
  const [error, setError] = useState(null);

  // Managers (created once)
  const videoPoolManager = useMemo(() => new VideoPoolManager(), []);
  const avatarStateMachine = useMemo(() => new AvatarStateMachine({
    debugMode,
    transitionInDuration: 300,
    transitionOutDuration: 200,
    signDuration: 2500,
    interSignDelay: 150
  }), [debugMode]);

  const log = useCallback((message, data = null) => {
    if (debugMode) {
      console.log(`[EnhancedAvatar] ${message}`, data || '');
    }
  }, [debugMode]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;

    log('🎬 Initializing Three.js scene');

    let mounted = true;

    // Clear previous content safely
    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 500/400, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    
    renderer.setSize(500, 400);
    renderer.setClearColor(0x1a1a1a, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    // Only append if still mounted
    if (mounted && mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    // Professional lighting setup
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(2, 4, 3);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x87CEEB, 0.4);
    fillLight.position.set(-2, 2, 1);
    scene.add(fillLight);

    // Position camera
    camera.position.set(0, 0, 3);
    camera.lookAt(0, 0, 0);

    // Store references
    sceneRef.current = { scene, camera, renderer, mounted };

    // Cleanup function
    const cleanup = () => {
      log('🧹 Cleaning up Three.js scene');
      mounted = false;
      
      // Clean up video
      if (currentVideoRef.current) {
        try {
          currentVideoRef.current.pause();
          currentVideoRef.current.src = '';
          currentVideoRef.current.load();
        } catch (e) {
          console.warn('Video cleanup warning:', e);
        }
        currentVideoRef.current = null;
      }
      
      // Clean up Three.js
      try {
        // Dispose of all scene objects
        scene.traverse((object) => {
          if (object.geometry) {
            object.geometry.dispose();
          }
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => {
                if (material.map) material.map.dispose();
                material.dispose();
              });
            } else {
              if (object.material.map) object.material.map.dispose();
              object.material.dispose();
            }
          }
        });
        
        // Clear scene
        scene.clear();
        
        // Remove renderer DOM element safely
        if (renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
        
        // Dispose renderer
        renderer.dispose();
      } catch (e) {
        console.warn('Three.js cleanup warning:', e);
      }
      
      // Clear reference
      if (sceneRef.current) {
        sceneRef.current.mounted = false;
      }
    };

    cleanupRef.current = cleanup;
    return cleanup;
  }, [log]);

  // Preload critical videos on mount
  useEffect(() => {
    let isMounted = true;

    const preloadCriticalVideos = async () => {
      log('📦 Starting critical video preload');
      
      try {
        // Update preload status
        const updateStatus = () => {
          if (isMounted) {
            const status = videoPoolManager.getPreloadStatus();
            setPreloadStatus(status);
          }
        };

        // Preload in batches with status updates
        await videoPoolManager.preloadBatch(VIDEO_MAPPINGS, PRIORITY_SIGNS);
        updateStatus();

        log('✅ Critical videos preloaded successfully');
      } catch (error) {
        log('❌ Critical video preload failed:', error);
        if (isMounted) {
          setError(`Preload failed: ${error.message}`);
        }
      }
    };

    preloadCriticalVideos();

    return () => {
      isMounted = false;
    };
  }, [videoPoolManager, log]);

  // Avatar state machine integration
  useEffect(() => {
    const stateChangeHandler = ({ newState, data }) => {
      log(`🤖 Avatar state changed: ${newState}`, data);
      setAvatarState(newState);
      onStateChange?.(newState, data);
    };

    const callbackId = avatarStateMachine.onStateChange(stateChangeHandler);

    return () => {
      avatarStateMachine.removeStateChangeCallback(callbackId);
    };
  }, [avatarStateMachine, onStateChange, log]);

  // Create video avatar with proper resource management
  const createVideoAvatar = useCallback(async (signName) => {
    if (!sceneRef.current || !sceneRef.current.mounted) return null;

    log(`🎭 Creating video avatar for: ${signName}`);

    try {
      // Get video from pool
      const videoPath = getVideoPath(signName);
      const videoData = await videoPoolManager.getVideo(signName, videoPath);
      
      // Check if video actually loaded
      if (!videoData.loaded || !videoData.element) {
        log(`⚠️ Video not available for ${signName}, using fallback`);
        return createFallbackAvatar(signName);
      }

      // Create a clone for playback
      const clonedVideoData = videoPoolManager.createVideoClone(signName);
      const video = clonedVideoData.element;
      
      // Clean up previous video safely
      if (currentVideoRef.current) {
        try {
          currentVideoRef.current.pause();
          currentVideoRef.current.src = '';
          currentVideoRef.current.load();
        } catch (e) {
          console.warn('Previous video cleanup warning:', e);
        }
      }
      currentVideoRef.current = video;

      // Create Three.js components
      const avatarGroup = new THREE.Group();

      // Video texture setup
      const videoTexture = new THREE.VideoTexture(video);
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;
      videoTexture.format = THREE.RGBAFormat;
      videoTexture.flipY = true;

      // Calculate dimensions based on video aspect ratio
      const planeHeight = 2.5;
      const planeWidth = planeHeight * clonedVideoData.aspectRatio;
      
      const videoGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
      const videoMaterial = new THREE.MeshBasicMaterial({ 
        map: videoTexture,
        transparent: true,
        alphaTest: 0.1,
        side: THREE.FrontSide
      });
      
      const videoPlane = new THREE.Mesh(videoGeometry, videoMaterial);
      videoPlane.position.z = 0.1;

      // Professional frame
      const frameGeometry = new THREE.PlaneGeometry(planeWidth + 0.1, planeHeight + 0.1);
      const frameMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x2a2a2a,
        transparent: true,
        opacity: 0.9
      });
      const frame = new THREE.Mesh(frameGeometry, frameMaterial);
      frame.position.z = 0;

      // Add components to group
      avatarGroup.add(frame);
      avatarGroup.add(videoPlane);

      // Video event handlers with safety checks
      const handleLoadedMetadata = () => {
        if (video === currentVideoRef.current && sceneRef.current?.mounted) {
          setVideoLoaded(true);
          setVideoDuration(video.duration);
          video.currentTime = 0;
          log(`📹 Video metadata loaded: ${signName} (${video.duration}s)`);
        }
      };

      const handleTimeUpdate = () => {
        if (video === currentVideoRef.current && sceneRef.current?.mounted) {
          setCurrentTime(video.currentTime);
        }
      };

      const handleEnded = () => {
        if (video === currentVideoRef.current && sceneRef.current?.mounted) {
          log(`🏁 Video playback ended: ${signName}`);
          onVideoComplete?.(signName);
        }
      };

      const handleError = (e) => {
        if (video === currentVideoRef.current && sceneRef.current?.mounted) {
          const errorMsg = `Video playback error: ${signName}`;
          log(`❌ ${errorMsg}`, e);
          setError(errorMsg);
        }
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('ended', handleEnded, { once: true });
      video.addEventListener('error', handleError, { once: true });

      return avatarGroup;

    } catch (error) {
      log(`❌ Failed to create video avatar: ${signName}`, error);
      return createFallbackAvatar(signName);
    }
  }, [videoPoolManager, onVideoComplete, log]);

  // Fallback avatar for missing videos
  const createFallbackAvatar = useCallback((signName) => {
    log(`🔄 Creating fallback avatar for: ${signName}`);
    
    const group = new THREE.Group();
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 512;

    context.fillStyle = '#333333';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.fillStyle = '#ffffff';
    context.font = '48px Arial';
    context.textAlign = 'center';
    context.fillText(`${signName.toUpperCase()}`, canvas.width/2, canvas.height/2);
    context.fillText('Video Not Available', canvas.width/2, canvas.height/2 + 60);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const plane = new THREE.Mesh(geometry, material);
    
    group.add(plane);
    return group;
  }, [log]);

  // Handle sign changes through state machine
  useEffect(() => {
    if (!currentSign || !sceneRef.current?.mounted) return;

    const processSignChange = async () => {
      try {
        await avatarStateMachine.transitionToSign(currentSign, {
          onLoadStart: async (signName) => {
            log(`📡 Loading video: ${signName}`);
            setVideoLoaded(false);
            setError(null);
          },
          
          onTransitionIn: async (signName) => {
            if (!sceneRef.current?.mounted) return;
            
            log(`🎬 Transitioning to: ${signName}`);
            
            // Remove old avatar safely
            if (sceneRef.current.avatarGroup) {
              try {
                // Dispose of old avatar resources
                sceneRef.current.avatarGroup.traverse((object) => {
                  if (object.geometry) object.geometry.dispose();
                  if (object.material) {
                    if (Array.isArray(object.material)) {
                      object.material.forEach(mat => {
                        if (mat.map) mat.map.dispose();
                        mat.dispose();
                      });
                    } else {
                      if (object.material.map) object.material.map.dispose();
                      object.material.dispose();
                    }
                  }
                });
                
                sceneRef.current.scene.remove(sceneRef.current.avatarGroup);
                sceneRef.current.avatarGroup = null;
              } catch (e) {
                console.warn('Old avatar cleanup warning:', e);
              }
            }
            
            // Create and add new avatar
            const newAvatar = await createVideoAvatar(signName);
            if (newAvatar && sceneRef.current?.mounted) {
              sceneRef.current.scene.add(newAvatar);
              sceneRef.current.avatarGroup = newAvatar;
            }
          },

          onSignStart: async (signName) => {
            if (!sceneRef.current?.mounted) return;
            
            log(`▶️ Starting sign playback: ${signName}`);
            
            if (currentVideoRef.current && isPlaying) {
              try {
                currentVideoRef.current.currentTime = 0;
                const playPromise = currentVideoRef.current.play();
                if (playPromise) {
                  await playPromise;
                }
              } catch (playError) {
                // Ignore play errors that commonly occur during rapid transitions
                if (playError.name !== 'AbortError' && playError.name !== 'NotAllowedError') {
                  log(`❌ Video play failed: ${signName}`, playError);
                  setError(`Playback failed: ${signName}`);
                }
              }
            }
          },

          onSignEnd: async (signName) => {
            if (!sceneRef.current?.mounted) return;
            
            log(`⏹️ Sign playback ended: ${signName}`);
            
            if (currentVideoRef.current) {
              try {
                currentVideoRef.current.pause();
                currentVideoRef.current.currentTime = 0;
              } catch (e) {
                // Ignore cleanup errors during transitions
                console.warn('Video end cleanup warning:', e);
              }
            }
          }
        });
      } catch (error) {
        if (sceneRef.current?.mounted) {
          log(`❌ Sign transition failed: ${currentSign}`, error);
          setError(`Transition failed: ${error.message}`);
        }
      }
    };

    processSignChange();
  }, [currentSign, isPlaying, avatarStateMachine, createVideoAvatar, log]);

  // Animation loop
  useEffect(() => {
    let animationId;
    
    const animate = () => {
      if (sceneRef.current?.mounted) {
        animationId = requestAnimationFrame(animate);
        
        try {
          if (sceneRef.current.renderer && sceneRef.current.scene && sceneRef.current.camera) {
            sceneRef.current.renderer.render(sceneRef.current.scene, sceneRef.current.camera);
          }
        } catch (e) {
          console.warn('Render warning:', e);
        }
      }
    };
    
    animate();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sceneRef.current) {
        sceneRef.current.mounted = false;
      }
      
      if (cleanupRef.current) {
        try {
          cleanupRef.current();
        } catch (e) {
          console.warn('Cleanup warning:', e);
        }
      }
      
      try {
        videoPoolManager.dispose();
      } catch (e) {
        console.warn('Video pool cleanup warning:', e);
      }
      
      try {
        avatarStateMachine.forceReset();
      } catch (e) {
        console.warn('State machine cleanup warning:', e);
      }
    };
  }, [videoPoolManager, avatarStateMachine]);

  const getStatusColor = (status) => {
    switch (status) {
      case AvatarStates.NEUTRAL: return '#ffaa00';
      case AvatarStates.LOADING: return '#00aaff';
      case AvatarStates.SIGNING: return '#00ff00';
      case AvatarStates.ERROR: return '#ff0000';
      default: return '#888888';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case AvatarStates.NEUTRAL: return '⏸ READY';
      case AvatarStates.LOADING: return '⏳ LOADING';
      case AvatarStates.TRANSITIONING_IN: return '🔄 TRANSITION';
      case AvatarStates.SIGNING: return '▶ SIGNING';
      case AvatarStates.TRANSITIONING_OUT: return '🔄 FINISHING';
      case AvatarStates.ERROR: return '❌ ERROR';
      default: return '⚪ UNKNOWN';
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div 
        ref={mountRef} 
        style={{
          border: '3px solid #444',
          borderRadius: '15px',
          overflow: 'hidden',
          display: 'inline-block',
          boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
          background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)'
        }} 
      />
      
      {/* Status indicators */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'rgba(0,0,0,0.8)',
        color: getStatusColor(avatarState),
        padding: '5px 10px',
        borderRadius: '5px',
        fontSize: '12px',
        fontFamily: 'monospace',
        fontWeight: 'bold'
      }}>
        {getStatusText(avatarState)}
      </div>

      {/* Current sign indicator */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'rgba(0,0,0,0.8)',
        color: '#ffffff',
        padding: '5px 10px',
        borderRadius: '5px',
        fontSize: '12px',
        fontFamily: 'monospace'
      }}>
        {currentSign?.replace('_', ' ') || 'None'}
      </div>

      {/* Preload progress (only show during initial loading) */}
      {preloadStatus.total > 0 && preloadStatus.percentage < 100 && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.8)',
          borderRadius: '5px',
          padding: '5px',
          fontSize: '11px',
          fontFamily: 'monospace',
          color: '#00ff00'
        }}>
          <div style={{ marginBottom: '3px' }}>
            Loading: {preloadStatus.loaded}/{preloadStatus.total} ({preloadStatus.percentage}%)
          </div>
          <div style={{
            width: '100%',
            height: '3px',
            background: '#333',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${preloadStatus.percentage}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #00ff00, #00aa00)',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          right: '10px',
          background: 'rgba(255,0,0,0.9)',
          color: '#ffffff',
          padding: '8px',
          borderRadius: '5px',
          fontSize: '11px',
          fontFamily: 'monospace',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      {/* Debug info (only in debug mode) */}
      {debugMode && (
        <div style={{
          position: 'absolute',
          top: '45px',
          left: '10px',
          background: 'rgba(0,0,0,0.9)',
          color: '#00ff00',
          padding: '8px',
          borderRadius: '5px',
          fontSize: '10px',
          fontFamily: 'monospace',
          maxWidth: '200px'
        }}>
          <div>Duration: {videoDuration.toFixed(1)}s</div>
          <div>Time: {currentTime.toFixed(1)}s</div>
          <div>Pool: {videoPoolManager.getMemoryStats().loadedVideos} loaded</div>
          <div>State: {avatarState}</div>
        </div>
      )}
    </div>
  );
};

export default EnhancedVideoAvatar;
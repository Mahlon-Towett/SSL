import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const VideoBasedAvatar = ({ currentSign = 'hello', isPlaying = false, onVideoComplete }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const animationRef = useRef(null);
  const videoRef = useRef(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

 // Map your downloaded videos to sign names
  const videoMappings = {
    'hello': './videos/Hello.mp4',
    'thank_you': './videos/ThankYou.mp4',
    'Beautiful': './videos/Beautiful.mp4',
    'Better': './videos/Better.mp4',
    'Happy': './videos/Happy.mp4',
    'good': './videos/Good.mp4',
    'name': './videos/Name.mp4',
    'Welcome': './videos/Welcome.mp4',
        // Add more as you have them
  };

  useEffect(() => {
    if (!mountRef.current) return;

    // Clear previous content
    mountRef.current.innerHTML = '';

    // Scene setup with professional lighting
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
    
    mountRef.current.appendChild(renderer.domElement);

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

    // Create video avatar
    const avatarGroup = createVideoAvatar(currentSign);
    scene.add(avatarGroup);

    // Position camera for optimal viewing
    camera.position.set(0, 0, 3);
    camera.lookAt(0, 0, 0);

    // Store references
    sceneRef.current = { 
      scene, 
      camera, 
      renderer, 
      avatarGroup
    };

    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Create properly oriented video avatar
  const createVideoAvatar = (signName) => {
    const avatarGroup = new THREE.Group();

    // Check if video exists for this sign
    const videoPath = videoMappings[signName];
    if (!videoPath) {
      console.warn(`No video found for sign: ${signName}`);
      return createFallbackAvatar(signName);
    }

    // Create video element with proper settings
    const video = document.createElement('video');
    video.src = videoPath;
    video.loop = false; // DON'T loop - play once per trigger
    video.muted = true;
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.preload = 'metadata';
    
    // Store video reference
    videoRef.current = video;

    // Create video texture with proper orientation
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBAFormat;
    videoTexture.flipY = true; // Fix upside-down issue

    // Calculate proper aspect ratio based on video dimensions
    let aspectRatio = 16/9; // Default fallback
    
    // Create video plane with proper dimensions
    const planeHeight = 2.5;
    const planeWidth = planeHeight * aspectRatio;
    
    const videoGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    const videoMaterial = new THREE.MeshBasicMaterial({ 
      map: videoTexture,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.FrontSide // Only show front side
    });
    
    const videoPlane = new THREE.Mesh(videoGeometry, videoMaterial);
    videoPlane.position.z = 0.1;

    // Add professional frame
    const frameGeometry = new THREE.PlaneGeometry(planeWidth + 0.1, planeHeight + 0.1);
    const frameMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x2a2a2a,
      transparent: true,
      opacity: 0.9
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.position.z = 0;

    // Add technical overlay
    const overlayGroup = createTechnicalOverlay();
    
    avatarGroup.add(frame);
    avatarGroup.add(videoPlane);
    avatarGroup.add(overlayGroup);

    // Video event handlers
    video.addEventListener('loadedmetadata', () => {
      setVideoLoaded(true);
      setVideoDuration(video.duration);
      
      // Ensure video starts at first frame for thumbnail effect
      video.currentTime = 0;
      
      // Update aspect ratio based on actual video dimensions
      const actualAspectRatio = video.videoWidth / video.videoHeight;
      
      // Resize plane to match video aspect ratio
      const newWidth = planeHeight * actualAspectRatio;
      videoPlane.geometry.dispose();
      videoPlane.geometry = new THREE.PlaneGeometry(newWidth, planeHeight);
      
      // Update frame size
      frame.geometry.dispose();
      frame.geometry = new THREE.PlaneGeometry(newWidth + 0.1, planeHeight + 0.1);
      
      console.log(`Animation loaded: ${video.videoWidth}x${video.videoHeight}, duration: ${video.duration}s`);
    });

    video.addEventListener('timeupdate', () => {
      setCurrentTime(video.currentTime);
      // Progress tracking removed for professional animation appearance
    });

    video.addEventListener('ended', () => {
      console.log('Video playback ended');
      
      // Notify parent component that video completed (for queue management)
      if (onVideoComplete) {
        onVideoComplete();
      }
      
      // Add natural delay and smooth transition back to first frame
      setTimeout(() => {
        if (videoRef.current) {
          // Fade out briefly
          const videoPlane = sceneRef.current?.avatarGroup?.children.find(child => 
            child.material && child.material.map && child.material.map.isVideoTexture
          );
          
          if (videoPlane) {
            // Quick fade out
            videoPlane.material.opacity = 0.3;
            
            // Return to first frame during fade
            setTimeout(() => {
              videoRef.current.currentTime = 0;
              setCurrentTime(0);
              
              // Fade back in to show first frame
              setTimeout(() => {
                if (videoPlane) {
                  videoPlane.material.opacity = 1.0;
                }
              }, 200);
            }, 150);
          } else {
            // Fallback if no video plane found
            videoRef.current.currentTime = 0;
            setCurrentTime(0);
          }
        }
      }, 300); // Natural pause before returning to pose
    });

    video.addEventListener('error', (e) => {
      console.error(`Video error for ${signName}:`, e);
      setVideoLoaded(false);
    });

    return avatarGroup;
  };

  // Create technical overlay
  const createTechnicalOverlay = () => {
    const overlayGroup = new THREE.Group();

    const createInfoPanel = (text, position) => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = 256;
      canvas.height = 64;

      context.fillStyle = 'rgba(0, 0, 0, 0.8)';
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      context.fillStyle = '#00ff00';
      context.font = '12px monospace';
      context.fillText(text, 10, 20);

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.MeshBasicMaterial({ 
        map: texture, 
        transparent: true,
        opacity: 0.7
      });
      const geometry = new THREE.PlaneGeometry(0.5, 0.125);
      const panel = new THREE.Mesh(geometry, material);
      panel.position.copy(position);
      
      return panel;
    };

    // Technical info panels
    const panels = [
      { text: 'Motion Capture: 30fps', pos: new THREE.Vector3(-1.5, 1.3, 0.2) },
      { text: 'Hand Joints: 25/hand', pos: new THREE.Vector3(1.5, 1.3, 0.2) },
      { text: 'Facial Blend: 52 shapes', pos: new THREE.Vector3(-1.5, -1.3, 0.2) },
      { text: 'IK Solver: Active', pos: new THREE.Vector3(1.5, -1.3, 0.2) }
    ];

    panels.forEach(panel => {
      overlayGroup.add(createInfoPanel(panel.text, panel.pos));
    });

    return overlayGroup;
  };

  // Fallback avatar if video not found
  const createFallbackAvatar = (signName) => {
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
    context.fillText('Video Not Found', canvas.width/2, canvas.height/2 + 60);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const plane = new THREE.Mesh(geometry, material);
    
    group.add(plane);
    return group;
  };

  // Control video playback with smooth transitions
  useEffect(() => {
    if (videoRef.current && videoLoaded) {
      if (isPlaying) {
        // Start from beginning and play
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(e => {
          console.log('Video play failed:', e);
        });
      } else {
        videoRef.current.pause();
        // When paused, smoothly return to first frame
        const videoPlane = sceneRef.current?.avatarGroup?.children.find(child => 
          child.material && child.material.map && child.material.map.isVideoTexture
        );
        
        if (videoPlane) {
          // Smooth fade transition
          videoPlane.material.opacity = 0.5;
          setTimeout(() => {
            videoRef.current.currentTime = 0;
            setTimeout(() => {
              if (videoPlane) {
                videoPlane.material.opacity = 1.0;
              }
            }, 100);
          }, 100);
        } else {
          videoRef.current.currentTime = 0;
        }
      }
    }
  }, [isPlaying, videoLoaded]);

  // Change video when sign changes with smooth crossfade transition
  useEffect(() => {
    if (sceneRef.current && sceneRef.current.scene) {
      // Get current avatar for fade out
      const oldAvatar = sceneRef.current.avatarGroup;
      
      if (oldAvatar) {
        // Fade out old avatar
        const oldVideoPlane = oldAvatar.children.find(child => 
          child.material && child.material.map && child.material.map.isVideoTexture
        );
        
        if (oldVideoPlane) {
          oldVideoPlane.material.opacity = 0.3;
        }
        
        // Short delay then switch to new video
        setTimeout(() => {
          // Remove old avatar
          sceneRef.current.scene.remove(oldAvatar);
          
          // Add new avatar
          const newAvatar = createVideoAvatar(currentSign);
          sceneRef.current.scene.add(newAvatar);
          sceneRef.current.avatarGroup = newAvatar;
          
          // Ensure video shows first frame when loaded
          if (videoRef.current) {
            videoRef.current.currentTime = 0;
          }
          
          // Fade in new avatar
          setTimeout(() => {
            const newVideoPlane = newAvatar.children.find(child => 
              child.material && child.material.map && child.material.map.isVideoTexture
            );
            
            if (newVideoPlane) {
              newVideoPlane.material.opacity = 0.3;
              // Smooth fade in
              setTimeout(() => {
                if (newVideoPlane) {
                  newVideoPlane.material.opacity = 1.0;
                }
              }, 150);
            }
          }, 50);
          
        }, 200); // Natural transition timing
      } else {
        // First load - no transition needed
        const newAvatar = createVideoAvatar(currentSign);
        sceneRef.current.scene.add(newAvatar);
        sceneRef.current.avatarGroup = newAvatar;
        
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
        }
      }
      
      // Reset time tracking
      setCurrentTime(0);
      setVideoDuration(0);
    }
  }, [currentSign]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      
      // Render the scene
      if (sceneRef.current) {
        sceneRef.current.renderer.render(sceneRef.current.scene, sceneRef.current.camera);
      }
    };
    
    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

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
        background: 'rgba(0,0,0,0.7)',
        color: videoLoaded ? '#00ff00' : '#ff0000',
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
        {isPlaying ? '▶ ANIMATING' : '⏸ POSED'}
      </div>
    </div>
  );
};

export default VideoBasedAvatar;
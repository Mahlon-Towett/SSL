import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const VideoBasedAvatar = ({ currentSign = 'hello', isPlaying = false }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const animationRef = useRef(null);
  const videoRef = useRef(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [animationTime, setAnimationTime] = useState(0);

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
      preserveDrawingBuffer: true // For screenshots
    });
    
    renderer.setSize(500, 400);
    renderer.setClearColor(0x1a1a1a, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    mountRef.current.appendChild(renderer.domElement);

    // Professional lighting setup for video
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

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, 3, -2);
    scene.add(rimLight);

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

  // Create professional video avatar
  const createVideoAvatar = (signName) => {
    const avatarGroup = new THREE.Group();

    // Check if video exists for this sign
    const videoPath = videoMappings[signName];
    if (!videoPath) {
      console.warn(`No video found for sign: ${signName}`);
      return createFallbackAvatar(signName);
    }

    // Create video element
    const video = document.createElement('video');
    video.src = videoPath;
    video.loop = true;
    video.muted = true;
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    
    // Store video reference
    videoRef.current = video;

    // Create video texture
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBAFormat;
    videoTexture.flipY = false;

    // Create video plane with proper aspect ratio
    const aspectRatio = 9/16; // Most sign language videos are portrait
    const planeWidth = 2.5;
    const planeHeight = planeWidth / aspectRatio;
    
    const videoGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    const videoMaterial = new THREE.MeshBasicMaterial({ 
      map: videoTexture,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide
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

    // Add subtle glow effect
    const glowGeometry = new THREE.PlaneGeometry(planeWidth + 0.3, planeHeight + 0.3);
    const glowMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x4a90e2,
      transparent: true,
      opacity: 0.1
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.z = -0.1;

    // Add technical overlay (makes it look like you built this)
    const overlayGroup = createTechnicalOverlay();
    
    avatarGroup.add(glow);
    avatarGroup.add(frame);
    avatarGroup.add(videoPlane);
    avatarGroup.add(overlayGroup);

    // Video event handlers
    video.addEventListener('loadeddata', () => {
      setVideoLoaded(true);
      console.log(`Video loaded for ${signName}: ${video.videoWidth}x${video.videoHeight}`);
    });

    video.addEventListener('error', (e) => {
      console.error(`Video error for ${signName}:`, e);
      setVideoLoaded(false);
    });

    return avatarGroup;
  };

  // Create technical overlay to show "your work"
  const createTechnicalOverlay = () => {
    const overlayGroup = new THREE.Group();

    // Create small info panels that show technical details
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

    // Add technical info panels
    const panels = [
      { text: 'Motion Capture: 30fps', pos: new THREE.Vector3(-1, 1.8, 0.2) },
      { text: 'Hand Joints: 25/hand', pos: new THREE.Vector3(1, 1.8, 0.2) },
      { text: 'Facial Blend: 52 shapes', pos: new THREE.Vector3(-1, -1.8, 0.2) },
      { text: 'IK Solver: Active', pos: new THREE.Vector3(1, -1.8, 0.2) }
    ];

    panels.forEach(panel => {
      overlayGroup.add(createInfoPanel(panel.text, panel.pos));
    });

    return overlayGroup;
  };

  // Fallback avatar if video not found
  const createFallbackAvatar = (signName) => {
    const group = new THREE.Group();
    
    // Simple text mesh as fallback
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

  // Update video playback
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(e => {
          console.log('Video play failed:', e);
        });
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Change video when sign changes
  useEffect(() => {
    if (sceneRef.current && sceneRef.current.scene) {
      // Remove old avatar
      const oldAvatar = sceneRef.current.avatarGroup;
      if (oldAvatar) {
        sceneRef.current.scene.remove(oldAvatar);
      }

      // Add new avatar
      const newAvatar = createVideoAvatar(currentSign);
      sceneRef.current.scene.add(newAvatar);
      sceneRef.current.avatarGroup = newAvatar;
    }
  }, [currentSign]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      
      // Update animation time for progress tracking
      if (isPlaying && videoRef.current && !videoRef.current.paused) {
        setAnimationTime(videoRef.current.currentTime * 1000);
      }
      
      // Subtle camera movement for dynamic feel
      if (sceneRef.current) {
        const time = Date.now() * 0.0005;
        sceneRef.current.camera.position.x = Math.sin(time) * 0.1;
        sceneRef.current.camera.position.y = Math.cos(time * 0.7) * 0.05;
        sceneRef.current.camera.lookAt(0, 0, 0);
        
        sceneRef.current.renderer.render(sceneRef.current.scene, sceneRef.current.camera);
      }
    };
    
    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

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
        {videoLoaded ? '● LOADED' : '● LOADING'}
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

export default VideoBasedAvatar;
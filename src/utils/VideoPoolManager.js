// src/utils/VideoPoolManager.js - Centralized video resource management
export class VideoPoolManager {
  constructor() {
    this.videoPool = new Map();
    this.preloadQueue = [];
    this.maxConcurrentLoads = 3;
    this.currentLoads = 0;
    this.eventListeners = new Map();
  }

  /**
   * Check if video file actually exists
   */
  async checkVideoExists(videoPath) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      const cleanup = () => {
        video.src = '';
        video.load();
      };
      
      video.addEventListener('loadedmetadata', () => {
        cleanup();
        resolve(true);
      }, { once: true });
      
      video.addEventListener('error', () => {
        cleanup();
        resolve(false);
      }, { once: true });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        cleanup();
        resolve(false);
      }, 5000);
      
      video.src = videoPath;
    });
  }

  /**
   * Preload a video and add it to the pool
   */
  async preloadVideo(signName, videoPath) {
    if (this.videoPool.has(signName)) {
      return this.videoPool.get(signName);
    }

    // Limit concurrent loads to prevent overwhelming the browser
    if (this.currentLoads >= this.maxConcurrentLoads) {
      return new Promise(resolve => {
        this.preloadQueue.push(() => this.preloadVideo(signName, videoPath).then(resolve));
      });
    }

    this.currentLoads++;

    try {
      const video = document.createElement('video');
      video.src = videoPath;
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      video.loop = false;

      const videoData = await new Promise((resolve, reject) => {
        const cleanup = () => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
        };

        const onLoadedMetadata = () => {
          cleanup();
          const data = {
            element: video,
            loaded: true,
            duration: video.duration,
            width: video.videoWidth,
            height: video.videoHeight,
            aspectRatio: video.videoWidth / video.videoHeight || 16/9
          };
          resolve(data);
        };

        const onError = (e) => {
          cleanup();
          console.warn(`Video not found: ${signName} at ${videoPath}`);
          // Don't reject, just mark as unavailable
          resolve({
            element: null,
            loaded: false,
            error: `Video not found: ${videoPath}`
          });
        };

        video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
        video.addEventListener('error', onError, { once: true });

        // Shorter timeout for faster feedback
        setTimeout(() => {
          cleanup();
          resolve({
            element: null,
            loaded: false,
            error: `Video load timeout: ${signName}`
          });
        }, 5000);
      });

      this.videoPool.set(signName, videoData);
      
      if (videoData.loaded) {
        console.log(`✅ Video preloaded: ${signName} (${videoData.width}x${videoData.height})`);
      } else {
        console.warn(`⚠️ Video unavailable: ${signName}`);
      }
      
      return videoData;

    } catch (error) {
      console.error(`❌ Failed to preload video ${signName}:`, error);
      // Store error state
      this.videoPool.set(signName, { 
        element: null, 
        loaded: false, 
        error: error.message 
      });
      return this.videoPool.get(signName);
    } finally {
      this.currentLoads--;
      
      // Process next in queue
      if (this.preloadQueue.length > 0) {
        const nextLoad = this.preloadQueue.shift();
        nextLoad();
      }
    }
  }

  /**
   * Get a video from the pool, load if not available
   */
  async getVideo(signName, videoPath) {
    if (!this.videoPool.has(signName)) {
      await this.preloadVideo(signName, videoPath);
    }
    
    const videoData = this.videoPool.get(signName);
    
    // Return the data even if not loaded - let the avatar handle fallback
    return videoData;
  }

  /**
   * Preload multiple videos with priority
   */
  async preloadBatch(signMappings, priority = []) {
    const priorityPromises = [];
    const regularPromises = [];

    // Process priority signs first
    for (const signName of priority) {
      if (signMappings[signName]) {
        priorityPromises.push(
          this.preloadVideo(signName, signMappings[signName]).catch(error => {
            console.warn(`Priority preload failed for ${signName}:`, error);
          })
        );
      }
    }

    // Wait for priority videos
    await Promise.all(priorityPromises);

    // Then process remaining videos
    for (const [signName, videoPath] of Object.entries(signMappings)) {
      if (!priority.includes(signName)) {
        regularPromises.push(
          this.preloadVideo(signName, videoPath).catch(error => {
            console.warn(`Regular preload failed for ${signName}:`, error);
          })
        );
      }
    }

    // Process regular videos in batches to avoid overwhelming
    const batchSize = 5;
    for (let i = 0; i < regularPromises.length; i += batchSize) {
      const batch = regularPromises.slice(i, i + batchSize);
      await Promise.all(batch);
      
      // Small delay between batches
      if (i + batchSize < regularPromises.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Create a clone of a video element for playback
   */
  createVideoClone(signName) {
    const videoData = this.videoPool.get(signName);
    if (!videoData || !videoData.loaded || !videoData.element) {
      throw new Error(`Video not available for cloning: ${signName}`);
    }

    const originalVideo = videoData.element;
    const clonedVideo = document.createElement('video');
    
    // Copy all relevant properties
    clonedVideo.src = originalVideo.src;
    clonedVideo.muted = originalVideo.muted;
    clonedVideo.playsInline = originalVideo.playsInline;
    clonedVideo.crossOrigin = originalVideo.crossOrigin;
    clonedVideo.loop = false;
    clonedVideo.preload = 'auto';

    return {
      element: clonedVideo,
      duration: videoData.duration,
      aspectRatio: videoData.aspectRatio,
      width: videoData.width,
      height: videoData.height
    };
  }

  /**
   * Get preload status
   */
  getPreloadStatus() {
    const total = this.videoPool.size;
    const loaded = Array.from(this.videoPool.values()).filter(v => v.loaded).length;
    const failed = Array.from(this.videoPool.values()).filter(v => v.error).length;
    
    return {
      total,
      loaded,
      failed,
      percentage: total > 0 ? Math.round((loaded / total) * 100) : 0
    };
  }

  /**
   * Check if a video is ready for playback
   */
  isVideoReady(signName) {
    const videoData = this.videoPool.get(signName);
    return videoData && videoData.loaded && !videoData.error;
  }

  /**
   * Get video path for a sign with fallback
   */
  getVideoPath(signName, videoMappings) {
    return videoMappings[signName] || videoMappings['Hello'] || './videos/Hello.mp4';
  }

  /**
   * Clean up resources
   */
  dispose() {
    // Clear event listeners and video elements
    for (const [signName, videoData] of this.videoPool.entries()) {
      if (videoData.element) {
        videoData.element.src = '';
        videoData.element.load();
      }
    }
    
    this.videoPool.clear();
    this.preloadQueue = [];
    this.eventListeners.clear();
    this.currentLoads = 0;
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats() {
    const videos = Array.from(this.videoPool.values());
    return {
      totalVideos: videos.length,
      loadedVideos: videos.filter(v => v.loaded).length,
      failedVideos: videos.filter(v => v.error).length,
      queueLength: this.preloadQueue.length,
      activeLoads: this.currentLoads
    };
  }
}

// Default export for easier importing
export default VideoPoolManager;
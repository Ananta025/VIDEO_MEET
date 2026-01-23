/**
 * Video Layout Manager for handling dynamic arrangement of video elements
 */

import { CustomHTMLVideoElement } from '@/types';

/**
 * Adjusts the layout of videos based on count and screen sharing status
 * @param container - The container element holding all video elements
 * @param videoCount - Number of videos currently in the call
 * @param isScreenSharing - Boolean indicating if someone is screen sharing
 */
export const updateVideoLayout = (
  container: HTMLDivElement | null,
  videoCount: number,
  isScreenSharing: boolean
): void => {
  if (!container) return;
  
  const videos = container.querySelectorAll('video') as NodeListOf<CustomHTMLVideoElement>;
  
  // Reset container styles
  container.style.gridTemplateColumns = '';
  container.style.gridTemplateRows = '';
  container.style.gridGap = '10px'; // Increased gap for better separation
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.padding = '10px'; // Add padding to prevent videos from touching container edge
  
  // Get container dimensions for responsive sizing
  const containerRect = container.getBoundingClientRect();
  const isMobile = containerRect.width < 500;
  const isTablet = containerRect.width >= 500 && containerRect.width < 900;
  
  if (isScreenSharing) {
    // If screen sharing, find the screen sharing video and make it full size
    const screenShareVideo = Array.from(videos).find(
      video => video.dataset.isScreenShare === 'true'
    );
    
    if (screenShareVideo) {
      // Make screen share video fill the container
      videos.forEach(video => {
        if (video === screenShareVideo) {
          video.style.width = '100%';
          video.style.height = '100%';
          video.style.objectFit = 'contain';
          video.style.zIndex = '10';
          video.style.backgroundColor = '#000'; // Black background for screen shares
        } else {
          // On mobile, completely hide other videos during screen sharing
          if (isMobile) {
            video.style.display = 'none';
          } else {
            // On larger screens, make them small thumbnails
            video.style.width = '20%';
            video.style.position = 'absolute';
            video.style.bottom = '10px';
            video.style.right = '10px';
            video.style.zIndex = '15';
            video.style.borderRadius = '8px';
            video.style.border = '1px solid white';
          }
        }
      });
      
      return;
    }
  }
  
  // Show all videos when not screen sharing
  videos.forEach(video => {
    video.style.display = 'block';
    video.style.objectFit = 'cover';
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.zIndex = '1';
    video.style.maxHeight = '100%';
    video.style.maxWidth = '100%';
    // Remove any previous styling
    video.style.position = '';
    video.style.top = '';
    video.style.left = '';
    video.style.transform = '';
    video.style.margin = '0'; // Reset margins
    video.style.boxSizing = 'border-box'; // Ensure padding is included in dimensions
  });
  
  // Calculate optimal grid layout
  if (videoCount === 0) {
    return;
  } else if (videoCount === 1) {
    // Single video centered
    container.style.display = 'flex';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
  } else {
    // Grid layout for multiple videos
    container.style.display = 'grid';
    
    // Calculate grid dimensions based on aspect ratio of container
    const containerWidth = containerRect.width - 20; // Account for padding
    const containerHeight = containerRect.height - 20; // Account for padding
    const containerAspect = containerWidth / containerHeight;
    
    // Determine optimal grid layout based on number of videos and device type
    let cols: number, rows: number;
    
    if (videoCount === 2) {
      if (isMobile || containerAspect < 0.8) {
        // Stack vertically on narrow screens
        cols = 1;
        rows = 2;
      } else {
        // Side by side on wider screens
        cols = 2;
        rows = 1;
      }
    } else if (videoCount === 3 || videoCount === 4) {
      if (isMobile) {
        // Stack more on mobile
        cols = 1;
        rows = videoCount;
      } else if (isTablet) {
        // 2x2 grid on tablet
        cols = 2;
        rows = Math.ceil(videoCount / 2);
      } else {
        // 2x2 grid on desktop
        cols = 2;
        rows = 2;
      }
    } else if (videoCount <= 6) {
      if (isMobile) {
        // Single column on mobile
        cols = 1;
        rows = videoCount;
      } else if (isTablet) {
        // 2x3 grid on tablet
        cols = 2;
        rows = Math.ceil(videoCount / 2);
      } else {
        // 3x2 grid on desktop
        cols = 3;
        rows = 2;
      }
    } else if (videoCount <= 9) {
      if (isMobile) {
        // 2 columns on mobile for more than 6
        cols = 2;
        rows = Math.ceil(videoCount / 2);
      } else if (isTablet) {
        // 2x5 grid max on tablet
        cols = 2;
        rows = Math.ceil(videoCount / 2);
      } else {
        // 3x3 grid on desktop
        cols = 3;
        rows = 3;
      }
    } else {
      // For more videos, calculate based on aspect ratio and device
      if (isMobile) {
        cols = 2;
        rows = Math.ceil(videoCount / 2);
      } else if (isTablet) {
        cols = 3;
        rows = Math.ceil(videoCount / 3);
      } else if (containerAspect > 1) {
        // Wider than tall
        cols = Math.ceil(Math.sqrt(videoCount * containerAspect));
        rows = Math.ceil(videoCount / cols);
      } else {
        // Taller than wide
        rows = Math.ceil(Math.sqrt(videoCount / containerAspect));
        cols = Math.ceil(videoCount / rows);
      }
    }
    
    // Set grid template with fixed aspect ratio cells for consistent video display
    container.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    container.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
    
    // Apply styles to ensure videos display properly within grid cells
    Array.from(videos).forEach((video) => {
      // Override default video styles for grid layout
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.aspectRatio = isMobile ? 'auto' : '16/9'; // Don't force aspect ratio on mobile
      video.style.objectFit = 'cover';
      video.style.borderRadius = '8px';
      video.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      video.style.boxSizing = 'border-box';
    });
  }
};

/**
 * Marks a specific video as a screen share
 * @param videoElement - The video element to mark as screen share
 * @param isScreenShare - Boolean indicating if this is a screen share video
 */
export const markAsScreenShare = (
  videoElement: HTMLVideoElement | null,
  isScreenShare: boolean = true
): void => {
  if (videoElement) {
    (videoElement as CustomHTMLVideoElement).dataset.isScreenShare = isScreenShare.toString();
    
    // Add visual enhancements for screen sharing
    if (isScreenShare) {
      videoElement.style.objectFit = 'contain';
      videoElement.style.backgroundColor = '#000'; // Black background for screen shares
    } else {
      videoElement.style.objectFit = 'cover';
      videoElement.style.backgroundColor = '';
    }
  }
};

/**
 * Updates the size and position of the local video based on remote video count
 * @param localVideoContainer - The container element for the local video
 * @param remoteVideoCount - Number of remote videos in the call
 * @param isScreenSharing - Boolean indicating if someone is screen sharing
 */
export const updateLocalVideoPosition = (
  localVideoContainer: HTMLDivElement | null,
  remoteVideoCount: number,
  isScreenSharing: boolean
): void => {
  if (!localVideoContainer) return;
  
  // Check screen size for responsive positioning
  const isMobile = window.innerWidth < 480;
  const isTablet = window.innerWidth >= 480 && window.innerWidth < 768;
  
  if (remoteVideoCount === 0) {
    // If no remote videos, make local video large and centered
    localVideoContainer.style.width = isMobile ? '85%' : '70%';
    localVideoContainer.style.height = 'auto';
    localVideoContainer.style.position = 'static';
    localVideoContainer.style.margin = '0 auto';
    localVideoContainer.style.aspectRatio = '16/9';
  } else if (isScreenSharing) {
    // During screen sharing, make local video a small picture-in-picture
    if (isMobile) {
      localVideoContainer.style.width = '40vw';
      localVideoContainer.style.right = '0.5rem';
      localVideoContainer.style.bottom = '0.5rem';
    } else if (isTablet) {
      localVideoContainer.style.width = '25vw';
      localVideoContainer.style.right = '1rem';
      localVideoContainer.style.bottom = '1rem';
    } else {
      localVideoContainer.style.width = '15vw';
      localVideoContainer.style.right = '3rem';
      localVideoContainer.style.bottom = '3rem';
    }
    localVideoContainer.style.height = 'auto';
    localVideoContainer.style.position = 'absolute';
    localVideoContainer.style.zIndex = '100';
    localVideoContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.4)';
    localVideoContainer.style.transition = 'all 0.3s ease';
  } else {
    // Default position for local video based on screen size
    if (isMobile) {
      localVideoContainer.style.width = '40vw';
      localVideoContainer.style.right = '0.5rem';
      localVideoContainer.style.bottom = '0.5rem';
    } else if (isTablet) {
      localVideoContainer.style.width = '25vw';
      localVideoContainer.style.right = '1rem';
      localVideoContainer.style.bottom = '1rem';
    } else {
      localVideoContainer.style.width = '15vw';
      localVideoContainer.style.right = '3rem';
      localVideoContainer.style.bottom = '3rem';
    }
    localVideoContainer.style.height = 'auto';
    localVideoContainer.style.position = 'absolute';
    localVideoContainer.style.zIndex = '100';
    localVideoContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.4)';
  }
};

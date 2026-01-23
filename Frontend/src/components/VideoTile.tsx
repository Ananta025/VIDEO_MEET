import { memo, useRef, useEffect, useState, useCallback } from 'react';

/**
 * VideoTile Props
 * 
 * IMPORTANT: We pass the stream directly instead of storing it in the video object.
 * This is because MediaStream should NOT be stored in React state.
 * The parent component stores streams in a useRef<Map> and passes them here.
 */
interface VideoTileProps {
  participantId: string;
  stream: MediaStream | null;
  isScreenShare?: boolean;
  // Counter that changes when streams are updated - forces re-render
  streamUpdateCounter?: number;
}

/**
 * Custom comparison function for React.memo
 * Only re-render when participant changes or stream reference changes
 */
const arePropsEqual = (prevProps: VideoTileProps, nextProps: VideoTileProps): boolean => {
  // Different participant = always re-render
  if (prevProps.participantId !== nextProps.participantId) return false;
  
  // Stream reference changed = re-render
  if (prevProps.stream !== nextProps.stream) return false;
  
  // Update counter changed = re-render (forces refresh when tracks change)
  if (prevProps.streamUpdateCounter !== nextProps.streamUpdateCounter) return false;
  
  // Screen share flag changed
  if (prevProps.isScreenShare !== nextProps.isScreenShare) return false;
  
  return true;
};

/**
 * VideoTile Component
 * 
 * Renders a single REMOTE video participant.
 * This component is ONLY for remote streams, NOT for local video.
 * 
 * DESIGN PRINCIPLES:
 * 1. Receives stream from parent (stored in useRef, not state)
 * 2. Handles srcObject binding carefully to avoid black tiles
 * 3. Shows avatar placeholder when video track is missing/disabled
 * 4. NOT muted (remote audio should be heard)
 * 5. Uses stable participantId as key (never array index)
 * 6. NEVER clears srcObject unnecessarily (causes flicker)
 */
const VideoTile = memo(function VideoTile({ 
  participantId, 
  stream, 
  isScreenShare = false,
  streamUpdateCounter,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideoTrack, setHasVideoTrack] = useState(false);
  
  // Track what we've attached to avoid unnecessary reattachments
  const attachedStreamIdRef = useRef<string | null>(null);
  const lastTrackCountRef = useRef<number>(0);
  
  // Memoized play function with autoplay retry logic
  const tryPlay = useCallback(async (element: HTMLVideoElement) => {
    if (!element.srcObject) return;
    
    if (element.paused) {
      try {
        await element.play();
        console.log("[VideoTile] Playback started for", participantId);
      } catch (err) {
        // Autoplay was blocked - add click listener to retry
        console.warn("[VideoTile] Autoplay blocked for", participantId, "- will retry on interaction");
        const handleInteraction = () => {
          element.play().catch(() => {});
          document.removeEventListener('click', handleInteraction);
          document.removeEventListener('touchstart', handleInteraction);
        };
        document.addEventListener('click', handleInteraction, { once: true });
        document.addEventListener('touchstart', handleInteraction, { once: true });
      }
    }
  }, [participantId]);
  
  // Main effect to sync stream to video element
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) {
      console.warn("[VideoTile] No video element ref for", participantId);
      return;
    }
    
    // ============================================
    // CASE 1: No stream provided
    // ============================================
    if (!stream) {
      console.log("[VideoTile] No stream yet for", participantId);
      // Don't clear srcObject if we had one - prevents flicker
      // Parent should unmount us if stream is gone
      setHasVideoTrack(false);
      return;
    }
    
    // ============================================
    // CASE 2: Stream exists - analyze tracks
    // ============================================
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();
    const totalTracks = videoTracks.length + audioTracks.length;
    
    // Check if video is actually available
    const hasLiveVideo = videoTracks.length > 0 && 
                          videoTracks.some(t => t.readyState === 'live');
    
    console.log("[VideoTile] Processing stream for", participantId, {
      streamId: stream.id,
      videoTracks: videoTracks.length,
      audioTracks: audioTracks.length,
      hasLiveVideo,
      streamUpdateCounter,
    });
    
    setHasVideoTrack(hasLiveVideo);
    
    // ============================================
    // CASE 3: Decide if we need to attach/reattach
    // Only reattach if stream ID changed OR track count changed
    // This prevents unnecessary DOM manipulation
    // ============================================
    const streamIdChanged = attachedStreamIdRef.current !== stream.id;
    const trackCountChanged = lastTrackCountRef.current !== totalTracks;
    
    if (streamIdChanged || trackCountChanged) {
      console.log("[VideoTile] Attaching stream for", participantId, 
        { streamIdChanged, trackCountChanged, oldCount: lastTrackCountRef.current, newCount: totalTracks });
      
      // Update tracking refs
      attachedStreamIdRef.current = stream.id;
      lastTrackCountRef.current = totalTracks;
      
      // CRITICAL: Set srcObject - this is what makes video display
      videoElement.srcObject = stream;
      
      // Ensure playback starts
      tryPlay(videoElement);
    }
    
    // ============================================
    // Track event handlers for dynamic changes
    // ============================================
    const handleTrackAdded = (event: MediaStreamTrackEvent) => {
      console.log("[VideoTile] Track added for", participantId, event.track.kind);
      lastTrackCountRef.current = stream.getTracks().length;
      
      if (event.track.kind === 'video') {
        setHasVideoTrack(true);
        // Reattach to ensure new video track is visible
        videoElement.srcObject = stream;
        tryPlay(videoElement);
      }
    };
    
    const handleTrackRemoved = (event: MediaStreamTrackEvent) => {
      console.log("[VideoTile] Track removed for", participantId, event.track.kind);
      lastTrackCountRef.current = stream.getTracks().length;
      
      if (event.track.kind === 'video') {
        setHasVideoTrack(stream.getVideoTracks().length > 0);
      }
    };
    
    // Video track-level listeners
    const handleTrackEnded = () => {
      console.log("[VideoTile] Video track ended for", participantId);
      setHasVideoTrack(false);
    };
    
    const handleTrackUnmute = () => {
      console.log("[VideoTile] Video track unmuted for", participantId);
      setHasVideoTrack(true);
      tryPlay(videoElement);
    };
    
    const handleTrackMute = () => {
      console.log("[VideoTile] Video track muted for", participantId);
      // Keep hasVideoTrack true - track exists, just muted
      // User will see frozen frame or black depending on browser
    };
    
    // Attach stream-level listeners
    stream.addEventListener('addtrack', handleTrackAdded);
    stream.addEventListener('removetrack', handleTrackRemoved);
    
    // Attach video track-level listeners
    videoTracks.forEach(track => {
      track.addEventListener('ended', handleTrackEnded);
      track.addEventListener('unmute', handleTrackUnmute);
      track.addEventListener('mute', handleTrackMute);
    });
    
    // Cleanup function
    return () => {
      stream.removeEventListener('addtrack', handleTrackAdded);
      stream.removeEventListener('removetrack', handleTrackRemoved);
      
      videoTracks.forEach(track => {
        track.removeEventListener('ended', handleTrackEnded);
        track.removeEventListener('unmute', handleTrackUnmute);
        track.removeEventListener('mute', handleTrackMute);
      });
    };
  }, [stream, participantId, tryPlay, streamUpdateCounter]);
  
  // Video element event handlers
  const handleLoadedMetadata = useCallback(() => {
    console.log("[VideoTile] Metadata loaded for", participantId);
    if (videoRef.current) {
      tryPlay(videoRef.current);
    }
  }, [participantId, tryPlay]);
  
  const handleCanPlay = useCallback(() => {
    console.log("[VideoTile] Can play for", participantId);
    if (videoRef.current) {
      tryPlay(videoRef.current);
    }
  }, [participantId, tryPlay]);
  
  return (
    <div className={`video-tile-wrapper ${!hasVideoTrack ? 'no-video' : ''}`}>
      <video
        ref={videoRef}
        data-participant-id={participantId}
        autoPlay
        playsInline
        // CRITICAL: Remote videos must NOT be muted to hear other participants
        muted={false}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        className={`remote-video ${isScreenShare ? 'screen-share' : ''}`}
      />
      {!hasVideoTrack && (
        <div className="video-placeholder">
          <span className="placeholder-icon">👤</span>
          <span className="placeholder-text">Camera off</span>
        </div>
      )}
    </div>
  );
}, arePropsEqual);

export default VideoTile;

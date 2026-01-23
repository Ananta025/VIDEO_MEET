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
 * Key behaviors:
 * - Receives stream from parent (stored in useRef, not state)
 * - Handles srcObject binding carefully to avoid black tiles
 * - NOT muted (remote audio should be heard)
 * - Uses stable participantId as key (never array index)
 */
const VideoTile = memo(function VideoTile({ 
  participantId, 
  stream, 
  isScreenShare = false,
  streamUpdateCounter,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideoTrack, setHasVideoTrack] = useState(false);
  const attachedStreamIdRef = useRef<string | null>(null);
  const lastTrackCountRef = useRef<number>(0);
  
  // Memoized play function
  const tryPlay = useCallback(async (element: HTMLVideoElement) => {
    if (element.paused && element.srcObject) {
      try {
        await element.play();
        console.log("VideoTile: Playback started for", participantId);
      } catch {
        console.warn("VideoTile: Autoplay blocked for", participantId, "- will retry on user interaction");
        // Add a click listener to retry playback
        const handleClick = () => {
          element.play().catch(() => {});
          document.removeEventListener('click', handleClick);
        };
        document.addEventListener('click', handleClick, { once: true });
      }
    }
  }, [participantId]);
  
  // Main effect to sync stream to video element
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) {
      console.warn("VideoTile: No video element ref for", participantId);
      return;
    }
    
    // Handle null/undefined stream
    if (!stream) {
      console.log("VideoTile: No stream yet for", participantId);
      if (videoElement.srcObject) {
        videoElement.srcObject = null;
        attachedStreamIdRef.current = null;
      }
      setHasVideoTrack(false);
      return;
    }
    
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();
    const currentTrackCount = videoTracks.length + audioTracks.length;
    
    console.log("VideoTile: Processing stream for", participantId, {
      streamId: stream.id,
      videoTracks: videoTracks.length,
      audioTracks: audioTracks.length,
      videoTrackEnabled: videoTracks[0]?.enabled,
      videoTrackState: videoTracks[0]?.readyState,
      streamUpdateCounter,
    });
    
    // Update video track state
    const hasVideo = videoTracks.length > 0 && videoTracks[0]?.readyState === 'live';
    setHasVideoTrack(hasVideo);
    
    // Check if we need to attach/reattach the stream
    const streamIdChanged = attachedStreamIdRef.current !== stream.id;
    const trackCountChanged = lastTrackCountRef.current !== currentTrackCount;
    const needsAttach = streamIdChanged || trackCountChanged;
    
    if (needsAttach) {
      console.log("VideoTile: Attaching stream to video element for", participantId, 
        { streamIdChanged, trackCountChanged });
      attachedStreamIdRef.current = stream.id;
      lastTrackCountRef.current = currentTrackCount;
      
      // CRITICAL: Set srcObject directly
      videoElement.srcObject = stream;
      
      // Ensure playback starts
      tryPlay(videoElement);
    }
    
    // Track event handlers
    const handleTrackAdded = (event: MediaStreamTrackEvent) => {
      console.log("VideoTile: Track added for", participantId, event.track.kind);
      if (event.track.kind === 'video') {
        setHasVideoTrack(true);
      }
      // Reattach stream to ensure new track is visible
      videoElement.srcObject = stream;
      lastTrackCountRef.current = stream.getTracks().length;
      tryPlay(videoElement);
    };
    
    const handleTrackRemoved = (event: MediaStreamTrackEvent) => {
      console.log("VideoTile: Track removed for", participantId, event.track.kind);
      if (event.track.kind === 'video') {
        setHasVideoTrack(stream.getVideoTracks().length > 0);
      }
      lastTrackCountRef.current = stream.getTracks().length;
    };
    
    // Track-level listeners
    const handleTrackEnded = () => {
      console.log("VideoTile: Track ended for", participantId);
      setHasVideoTrack(false);
    };
    
    const handleTrackUnmute = () => {
      console.log("VideoTile: Track unmuted for", participantId);
      setHasVideoTrack(true);
      tryPlay(videoElement);
    };
    
    const handleTrackMute = () => {
      console.log("VideoTile: Track muted for", participantId);
      // Don't set hasVideoTrack to false on mute - track is still there, just muted
    };
    
    // Add listeners
    stream.addEventListener('addtrack', handleTrackAdded);
    stream.addEventListener('removetrack', handleTrackRemoved);
    
    videoTracks.forEach(track => {
      track.addEventListener('ended', handleTrackEnded);
      track.addEventListener('unmute', handleTrackUnmute);
      track.addEventListener('mute', handleTrackMute);
    });
    
    // Cleanup
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
    console.log("VideoTile: Metadata loaded for", participantId);
    if (videoRef.current) {
      tryPlay(videoRef.current);
    }
  }, [participantId, tryPlay]);
  
  const handleCanPlay = useCallback(() => {
    console.log("VideoTile: Can play for", participantId);
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

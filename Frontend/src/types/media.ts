/**
 * Media-related type definitions
 */

/**
 * Video stream information for rendering
 */
export interface VideoStream {
  socketId: string;
  stream: MediaStream;
  autoPlay: boolean;
  playsInline: boolean;
  isScreenShare?: boolean;
}

/**
 * Media availability state
 */
export interface MediaAvailability {
  videoAvailable: boolean;
  audioAvailable: boolean;
  screenAvailable: boolean;
}

/**
 * Media toggle state
 */
export interface MediaToggleState {
  video: boolean;
  audio: boolean;
  screen: boolean;
}

/**
 * Screen sharing state
 */
export interface ScreenShareState {
  isScreenSharing: boolean;
  screenStream: MediaStream | null;
}

/**
 * Recording notification state
 */
export interface RecordingNotification {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info';
}

/**
 * Props for RecordingControls component
 */
export interface RecordingControlsProps {
  meetingId: string;
  isHost: boolean;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

/**
 * Custom HTML video element with dataset properties
 */
export interface CustomHTMLVideoElement extends HTMLVideoElement {
  dataset: {
    isScreenShare?: string;
    socketId?: string;
  };
}

/**
 * Redux media slice state (serializable only - NO MediaStream)
 * This is for Redux Toolkit slice - stores UI flags only
 */
export interface MediaSliceState {
  micOn: boolean;
  camOn: boolean;
  screenSharing: boolean;
  selectedMicId: string | null;
  selectedCamId: string | null;
  permissionGranted: boolean;
}

/**
 * Central export file for all TypeScript types
 * Import types from this file: import { User, Meeting, Participant } from '@/types'
 */

// User types
export type {
  User,
  UserContextType,
  UserProviderProps,
  LoginPayload,
  RegisterPayload,
  StoredUserData,
} from './user';

// Participant types
export type {
  Participant,
  ParticipantMap,
  HostPermissions,
  MeetingParticipant,
  ParticipantSlice,
  ParticipantsSliceState,
} from './participant';

// Meeting types
export type {
  MeetingStatus,
  MeetingHistoryItem,
  MeetingRecording,
  MeetingTranscript,
  Meeting,
  PaginationInfo,
  FeedbackPayload,
  MeetingSliceStatus,
  MeetingSliceState,
} from './meeting';

// Media types
export type {
  VideoStream,
  MediaAvailability,
  MediaToggleState,
  ScreenShareState,
  RecordingNotification,
  RecordingControlsProps,
  CustomHTMLVideoElement,
  MediaSliceState,
} from './media';

// WebRTC types
export type {
  PeerConnectionMap,
  ConnectionsType,
  OfferPayload,
  AnswerPayload,
  IceCandidatePayload,
  WebRTCSignalData,
  ConnectionRetryCount,
  PeerConnectionConfig,
} from './webrtc';

// Socket types
export type {
  ChatMessage,
  ClientToServerEvents,
  ServerToClientEvents,
  SocketConnectionState,
  SocketEventName,
} from './socket';

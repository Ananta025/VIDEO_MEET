/**
 * Participant-related type definitions
 */

/**
 * Represents a meeting participant
 */
export interface Participant {
  id: string;
  name: string;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
}

/**
 * Map of participants by ID
 */
export type ParticipantMap = {
  [key: string]: Participant;
};

/**
 * Host-specific permissions
 */
export interface HostPermissions {
  canKickParticipants: boolean;
  canMuteParticipants: boolean;
  canRecordMeeting: boolean;
  canShareScreen: boolean;
}

/**
 * Participant in meeting history (from API)
 */
export interface MeetingParticipant {
  _id: string;
  name: string;
  email: string;
}

/**
 * Redux participant slice - serializable participant metadata
 * NOTE: Does NOT store MediaStream, video elements, or peer connections
 */
export interface ParticipantSlice {
  id: string;
  name: string;
  micOn: boolean;
  camOn: boolean;
  isHost: boolean;
  joinedAt: number;
}

/**
 * Redux participants slice state (normalized)
 */
export interface ParticipantsSliceState {
  byId: Record<string, ParticipantSlice>;
  allIds: string[];
}

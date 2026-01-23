/**
 * Meeting-related type definitions
 */

import { MeetingParticipant } from './participant';

/**
 * Meeting status enum
 */
export type MeetingStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled';

/**
 * Meeting history item - represents a past meeting
 */
export interface MeetingHistoryItem {
  _id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  meetingLink: string;
  participants: string[];
  status: MeetingStatus;
  createdAt: string;
}

/**
 * Meeting recording information
 */
export interface MeetingRecording {
  isRecorded: boolean;
  recordingUrl: string;
  recordingSize: number;
  recordingFormat: string;
  recordingStartTime: string;
  recordingEndTime: string;
}

/**
 * Meeting transcript information
 */
export interface MeetingTranscript {
  isGenerated: boolean;
  transcriptUrl: string;
  transcriptText: string;
  vttUrl?: string;
  duration?: number;
  generatedAt: string;
}

/**
 * Full meeting details from API (used in HistoryPage)
 */
export interface Meeting {
  _id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  status: MeetingStatus;
  hostId: MeetingParticipant;
  participants: MeetingParticipant[];
  recording?: MeetingRecording;
  transcript?: MeetingTranscript;
  createdAt: string;
}

/**
 * Pagination info for meeting history
 */
export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalMeetings: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Feedback payload for post-meeting feedback
 */
export interface FeedbackPayload {
  rating: string | null;
  feedback: string;
}

/**
 * Redux meeting slice status
 */
export type MeetingSliceStatus = 'idle' | 'joining' | 'joined' | 'left';

/**
 * Redux meeting slice state
 * This replaces the MeetingContext state
 */
export interface MeetingSliceState {
  // Core meeting state
  meetingId: string | null;
  status: MeetingSliceStatus;
  isHost: boolean;
  isJoined: boolean;
  startedAt: number | null;
  
  // Meeting history
  meetingHistory: MeetingHistoryItem[];
  isHistoryLoading: boolean;
  historyError: string | null;
}

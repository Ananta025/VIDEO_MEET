import type { RootState } from '@/app/store';

/**
 * Meeting Selectors
 * 
 * Memoized selectors for accessing meeting state.
 * Use these instead of accessing state.meeting directly.
 */

export const selectMeetingId = (state: RootState) => state.meeting.meetingId;
export const selectMeetingStatus = (state: RootState) => state.meeting.status;
export const selectIsHost = (state: RootState) => state.meeting.isHost;
export const selectIsJoined = (state: RootState) => state.meeting.isJoined;
export const selectStartedAt = (state: RootState) => state.meeting.startedAt;
export const selectMeetingHistory = (state: RootState) => state.meeting.meetingHistory;
export const selectIsHistoryLoading = (state: RootState) => state.meeting.isHistoryLoading;
export const selectHistoryError = (state: RootState) => state.meeting.historyError;

// Combined selector for core meeting info
export const selectMeetingState = (state: RootState) => state.meeting;

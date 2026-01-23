import type { RootState } from '@/app/store';
import type { ParticipantSlice } from '@/types';

/**
 * Participants Selectors
 * 
 * Selectors for accessing normalized participant state.
 * Use these instead of accessing state.participants directly.
 */

// Get all participant IDs
export const selectAllParticipantIds = (state: RootState) => state.participants.allIds;

// Get participants lookup object
export const selectParticipantsById = (state: RootState) => state.participants.byId;

// Get participant count
export const selectParticipantCount = (state: RootState) => state.participants.allIds.length;

// Get a specific participant by ID
export const selectParticipantById = (state: RootState, participantId: string): ParticipantSlice | undefined =>
  state.participants.byId[participantId];

// Get all participants as array (derived)
export const selectAllParticipants = (state: RootState): ParticipantSlice[] =>
  state.participants.allIds.map(id => state.participants.byId[id]);

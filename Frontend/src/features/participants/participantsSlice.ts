import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ParticipantSlice, ParticipantsSliceState } from '@/types';

/**
 * Participants Redux Slice
 * 
 * This slice manages participant metadata in a normalized structure.
 * NOTE: This stores ONLY serializable metadata.
 * 
 * ⚠️ IMPORTANT: MediaStream, video elements, and RTCPeerConnection
 * objects are NOT stored here. They remain in components/refs.
 */

const initialState: ParticipantsSliceState = {
  byId: {},
  allIds: [],
};

const participantsSlice = createSlice({
  name: 'participants',
  initialState,
  reducers: {
    addParticipant: (state, action: PayloadAction<ParticipantSlice>) => {
      const participant = action.payload;
      // Prevent duplicate IDs
      if (!state.byId[participant.id]) {
        state.byId[participant.id] = participant;
        state.allIds.push(participant.id);
      }
    },
    removeParticipant: (state, action: PayloadAction<string>) => {
      const participantId = action.payload;
      if (state.byId[participantId]) {
        delete state.byId[participantId];
        state.allIds = state.allIds.filter(id => id !== participantId);
      }
    },
    updateParticipant: (
      state,
      action: PayloadAction<{ id: string; changes: Partial<ParticipantSlice> }>
    ) => {
      const { id, changes } = action.payload;
      if (state.byId[id]) {
        state.byId[id] = { ...state.byId[id], ...changes };
      }
    },
    clearParticipants: (state) => {
      state.byId = {};
      state.allIds = [];
    },
  },
});

// Export actions
export const {
  addParticipant,
  removeParticipant,
  updateParticipant,
  clearParticipants,
} = participantsSlice.actions;

// Export reducer as default
export default participantsSlice.reducer;

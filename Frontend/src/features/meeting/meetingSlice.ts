import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import type { MeetingSliceState, MeetingSliceStatus, MeetingHistoryItem } from '@/types';

/**
 * Meeting Redux Slice
 * 
 * This slice manages meeting state in Redux.
 * Replaces the MeetingContext for state management.
 * WebRTC and Socket logic remain in components.
 */

const initialState: MeetingSliceState = {
  meetingId: null,
  status: 'idle',
  isHost: false,
  isJoined: false,
  startedAt: null,
  meetingHistory: [],
  isHistoryLoading: false,
  historyError: null,
};

// ============ Async Thunks ============

/**
 * Fetch meeting history from API
 */
export const fetchMeetingHistory = createAsyncThunk<
  MeetingHistoryItem[],
  void,
  { rejectValue: string }
>(
  'meeting/fetchHistory',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return rejectWithValue('No authentication token found');
      }
      
      const response = await axios.get(
        `${import.meta.env.VITE_BASE_URL}/users/history`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      if (response.data.success) {
        return response.data.data;
      } else {
        return rejectWithValue('Failed to fetch meeting history');
      }
    } catch (error: any) {
      console.error('Error fetching meeting history:', error);
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch history');
    }
  }
);

/**
 * Add meeting to history via API
 */
export const addMeetingToHistory = createAsyncThunk<
  MeetingHistoryItem | null,
  Partial<MeetingHistoryItem>,
  { rejectValue: string }
>(
  'meeting/addToHistory',
  async (meetingData, { rejectWithValue }) => {
    try {
      // Extract meeting ID from link or use provided ID
      let meetingId;
      if (meetingData.meetingLink) {
        try {
          const url = new URL(meetingData.meetingLink);
          const pathParts = url.pathname.split('/');
          meetingId = pathParts[pathParts.length - 1];
        } catch {
          meetingId = meetingData.meetingLink.split('/').pop();
        }
      }
      
      const token = localStorage.getItem('token');
      if (!token) {
        console.log("No token found, skipping meeting history update");
        return null;
      }
      
      const response = await axios.post(
        `${import.meta.env.VITE_BASE_URL}/users/history`,
        {
          ...meetingData,
          meetingId: meetingId, // Public meeting ID (e.g., "meeting-f52oxj4")
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      console.log("Meeting added to history successfully:", response.data);
      return response.data.data;
    } catch (error: any) {
      console.error("API error adding meeting to history:", error?.response?.data || error);
      // Don't reject - just return null to not block the flow
      return null;
    }
  }
);

// ============ Slice ============

const meetingSlice = createSlice({
  name: 'meeting',
  initialState,
  reducers: {
    setMeetingId: (state, action: PayloadAction<string | null>) => {
      state.meetingId = action.payload;
    },
    setMeetingStatus: (state, action: PayloadAction<MeetingSliceStatus>) => {
      state.status = action.payload;
    },
    setHost: (state, action: PayloadAction<boolean>) => {
      state.isHost = action.payload;
    },
    setJoined: (state, action: PayloadAction<boolean>) => {
      state.isJoined = action.payload;
    },
    setStartedAt: (state, action: PayloadAction<number | null>) => {
      state.startedAt = action.payload;
    },
    /**
     * Create a new meeting - generates ID and sets host status
     */
    createMeeting: (state) => {
      const newMeetingId = `meeting-${Math.random().toString(36).substring(2, 9)}`;
      state.meetingId = newMeetingId;
      state.isHost = true;
      state.status = 'joining';
      state.startedAt = Date.now();
    },
    /**
     * Join an existing meeting
     */
    joinMeeting: (state, action: PayloadAction<string>) => {
      state.meetingId = action.payload;
      state.isJoined = true;
      state.status = 'joined';
    },
    /**
     * Leave the current meeting
     */
    leaveMeeting: (state) => {
      state.meetingId = null;
      state.isJoined = false;
      state.isHost = false;
      state.status = 'left';
    },
    /**
     * Reset meeting state to initial
     */
    resetMeeting: () => initialState,
  },
  extraReducers: (builder) => {
    // Fetch meeting history
    builder
      .addCase(fetchMeetingHistory.pending, (state) => {
        state.isHistoryLoading = true;
        state.historyError = null;
      })
      .addCase(fetchMeetingHistory.fulfilled, (state, action) => {
        state.isHistoryLoading = false;
        state.meetingHistory = action.payload;
      })
      .addCase(fetchMeetingHistory.rejected, (state, action) => {
        state.isHistoryLoading = false;
        state.historyError = action.payload || 'Failed to fetch history';
      });
    
    // Add meeting to history
    builder
      .addCase(addMeetingToHistory.fulfilled, (state, action) => {
        if (action.payload) {
          state.meetingHistory.unshift(action.payload);
        }
      });
  },
});

// Export actions
export const {
  setMeetingId,
  setMeetingStatus,
  setHost,
  setJoined,
  setStartedAt,
  createMeeting,
  joinMeeting,
  leaveMeeting,
  resetMeeting,
} = meetingSlice.actions;

// Export reducer as default
export default meetingSlice.reducer;

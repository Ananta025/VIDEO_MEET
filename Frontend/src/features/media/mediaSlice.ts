import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { MediaSliceState } from '@/types';

/**
 * Media Redux Slice
 * 
 * This slice manages media UI state flags in Redux.
 * NOTE: This stores ONLY serializable primitive values.
 * 
 * ⚠️ IMPORTANT: MediaStream, MediaTrack, and getUserMedia logic
 * remain in components/Context. Redux only tracks UI toggle states.
 */

const initialState: MediaSliceState = {
  micOn: true,
  camOn: true,
  screenSharing: false,
  selectedMicId: null,
  selectedCamId: null,
  permissionGranted: false,
};

const mediaSlice = createSlice({
  name: 'media',
  initialState,
  reducers: {
    toggleMic: (state) => {
      state.micOn = !state.micOn;
    },
    toggleCam: (state) => {
      state.camOn = !state.camOn;
    },
    setScreenSharing: (state, action: PayloadAction<boolean>) => {
      state.screenSharing = action.payload;
    },
    setSelectedMic: (state, action: PayloadAction<string | null>) => {
      state.selectedMicId = action.payload;
    },
    setSelectedCam: (state, action: PayloadAction<string | null>) => {
      state.selectedCamId = action.payload;
    },
    setPermissionGranted: (state, action: PayloadAction<boolean>) => {
      state.permissionGranted = action.payload;
    },
    resetMedia: (state) => {
      state.micOn = initialState.micOn;
      state.camOn = initialState.camOn;
      state.screenSharing = initialState.screenSharing;
      state.selectedMicId = initialState.selectedMicId;
      state.selectedCamId = initialState.selectedCamId;
      state.permissionGranted = initialState.permissionGranted;
    },
  },
});

// Export actions
export const {
  toggleMic,
  toggleCam,
  setScreenSharing,
  setSelectedMic,
  setSelectedCam,
  setPermissionGranted,
  resetMedia,
} = mediaSlice.actions;

// Export reducer as default
export default mediaSlice.reducer;

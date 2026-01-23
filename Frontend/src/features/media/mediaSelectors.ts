import type { RootState } from '@/app/store';

/**
 * Media Selectors
 * 
 * Memoized selectors for accessing media state.
 * Use these instead of accessing state.media directly.
 */

// Individual selectors for specific values
export const selectMicOn = (state: RootState) => state.media.micOn;
export const selectCamOn = (state: RootState) => state.media.camOn;
export const selectScreenSharing = (state: RootState) => state.media.screenSharing;
export const selectSelectedMicId = (state: RootState) => state.media.selectedMicId;
export const selectSelectedCamId = (state: RootState) => state.media.selectedCamId;
export const selectPermissionGranted = (state: RootState) => state.media.permissionGranted;

// Combined selector for all media UI state
export const selectMediaState = (state: RootState) => state.media;

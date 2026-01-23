import { configureStore } from '@reduxjs/toolkit';
import meetingReducer from '@/features/meeting/meetingSlice';
import mediaReducer from '@/features/media/mediaSlice';
import participantsReducer from '@/features/participants/participantsSlice';

/**
 * Redux Store Configuration
 * 
 * This is a clean Redux Toolkit setup ready for future slices.
 * No existing Context state has been migrated - this is additive infrastructure only.
 */

export const store = configureStore({
  reducer: {
    meeting: meetingReducer,
    media: mediaReducer,
    participants: participantsReducer,
  },
  // DevTools enabled by default in development
  devTools: process.env.NODE_ENV !== 'production',
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

import { io, Socket } from 'socket.io-client';
import { store } from '@/app/store';
import {
  setMeetingStatus,
  setStartedAt,
  resetMeeting,
} from '@/features/meeting/meetingSlice';
import {
  addParticipant,
  removeParticipant,
  updateParticipant,
  clearParticipants,
} from '@/features/participants/participantsSlice';
import type { ParticipantSlice } from '@/types';

/**
 * Socket Service
 * 
 * Centralized Socket.io client that dispatches Redux actions on server events.
 * 
 * ⚠️ IMPORTANT:
 * - Socket instance is NOT stored in Redux (non-serializable)
 * - This service only handles Redux state updates
 * - WebRTC signaling remains in VideoMeetingPage component
 * - UI components should NOT import this directly for now
 */

const SERVER_URL = import.meta.env.VITE_SERVER_URL;

// Module-level socket instance (NOT in Redux)
let socket: Socket | null = null;
let isInitialized = false;

/**
 * Initialize socket connection and set up Redux event listeners
 * Safe to call multiple times - will only initialize once
 */
export const initSocket = (): Socket | null => {
  // Prevent duplicate initialization
  if (isInitialized && socket?.connected) {
    console.log('[SocketService] Already initialized');
    return socket;
  }

  if (!SERVER_URL) {
    console.error('[SocketService] VITE_SERVER_URL is not defined');
    return null;
  }

  console.log('[SocketService] Initializing socket connection to:', SERVER_URL);

  socket = io(SERVER_URL, {
    autoConnect: false, // Don't connect immediately - let components control this
    reconnection: true,
    reconnectionAttempts: 3,
    reconnectionDelay: 1000,
    timeout: 10000,
    transports: ['websocket', 'polling'],
  });

  // Set up Redux-integrated event listeners
  setupReduxEventListeners();

  isInitialized = true;
  console.log('[SocketService] Socket service initialized (not yet connected)');

  return socket;
};

/**
 * Set up socket event listeners that dispatch Redux actions
 * These listeners only update Redux state - no WebRTC logic here
 */
const setupReduxEventListeners = () => {
  if (!socket) return;

  // Remove any existing listeners to prevent duplicates
  socket.off('meeting-joined');
  socket.off('user-joined');
  socket.off('user-left');
  socket.off('participant-updated');
  socket.off('meeting-ended');

  /**
   * Event: meeting-joined
   * Fired when the current user successfully joins a meeting
   */
  socket.on('meeting-joined', (data: { roomId: string; timestamp: number }) => {
    console.log('[SocketService] meeting-joined:', data);
    store.dispatch(setMeetingStatus('joined'));
    store.dispatch(setStartedAt(data.timestamp || Date.now()));
  });

  /**
   * Event: user-joined
   * Fired when another participant joins the meeting
   */
  socket.on('user-joined', (data: {
    id: string;
    name: string;
    isHost?: boolean;
  }) => {
    console.log('[SocketService] user-joined:', data);
    
    const participant: ParticipantSlice = {
      id: data.id,
      name: data.name || 'Unknown',
      micOn: true, // Default to on, will be updated by participant-updated
      camOn: true,
      isHost: data.isHost || false,
      joinedAt: Date.now(),
    };
    
    store.dispatch(addParticipant(participant));
  });

  /**
   * Event: user-left
   * Fired when a participant leaves the meeting
   */
  socket.on('user-left', (userId: string) => {
    console.log('[SocketService] user-left:', userId);
    store.dispatch(removeParticipant(userId));
  });

  /**
   * Event: participant-updated
   * Fired when a participant's state changes (mic/cam toggle, etc.)
   */
  socket.on('participant-updated', (data: {
    id: string;
    changes: Partial<ParticipantSlice>;
  }) => {
    console.log('[SocketService] participant-updated:', data);
    store.dispatch(updateParticipant({
      id: data.id,
      changes: data.changes,
    }));
  });

  /**
   * Event: meeting-ended
   * Fired when the host ends the meeting for everyone
   */
  socket.on('meeting-ended', () => {
    console.log('[SocketService] meeting-ended');
    store.dispatch(resetMeeting());
    store.dispatch(clearParticipants());
  });

  console.log('[SocketService] Redux event listeners registered');
};

/**
 * Connect the socket to the server
 * Call this when user is ready to join a meeting
 */
export const connectSocket = (): void => {
  if (socket && !socket.connected) {
    console.log('[SocketService] Connecting socket...');
    socket.connect();
  }
};

/**
 * Disconnect socket and clean up
 */
export const disconnectSocket = (): void => {
  if (socket) {
    console.log('[SocketService] Disconnecting socket...');
    socket.disconnect();
  }
};

/**
 * Get the current socket instance
 * Returns null if not initialized
 */
export const getSocket = (): Socket | null => {
  return socket;
};

/**
 * Check if socket is currently connected
 */
export const isSocketConnected = (): boolean => {
  return socket?.connected || false;
};

/**
 * Clean up socket service completely
 * Call this on app unmount
 */
export const destroySocket = (): void => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  isInitialized = false;
  console.log('[SocketService] Socket service destroyed');
};

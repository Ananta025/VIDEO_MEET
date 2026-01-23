/**
 * Socket.IO event type definitions
 */

/**
 * Chat message structure
 */
export interface ChatMessage {
  data: string;
  sender: string;
}

/**
 * Client to Server events
 */
export interface ClientToServerEvents {
  'join-call': (data: { meetingId: string; name: string }) => void;
  'signal': (clientId: string, signal: string) => void;
  'chat-message': (data: ChatMessage, roomId: string) => void;
  'leave-call': () => void;
}

/**
 * Server to Client events
 */
export interface ServerToClientEvents {
  'user-joined': (data: { clients: string[]; socketId: string; name: string }) => void;
  'user-left': (socketId: string) => void;
  'signal': (fromSocketId: string, signal: string) => void;
  'chat-message': (data: ChatMessage) => void;
}

/**
 * Socket connection state
 */
export interface SocketConnectionState {
  socketConnected: boolean;
  socketError: string | null;
  socketRetries: number;
}

/**
 * Socket event names (for type-safe event handling)
 */
export type SocketEventName = keyof ClientToServerEvents | keyof ServerToClientEvents;

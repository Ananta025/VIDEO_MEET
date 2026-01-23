/**
 * WebRTC-related type definitions
 */

/**
 * Map of peer connections by socket ID
 */
export type PeerConnectionMap = {
  [key: string]: RTCPeerConnection;
};

/**
 * Alias for backward compatibility
 */
export type ConnectionsType = PeerConnectionMap;

/**
 * WebRTC offer payload
 */
export interface OfferPayload {
  sdp: RTCSessionDescriptionInit;
  fromSocketId: string;
}

/**
 * WebRTC answer payload
 */
export interface AnswerPayload {
  sdp: RTCSessionDescriptionInit;
  fromSocketId: string;
}

/**
 * ICE candidate payload
 */
export interface IceCandidatePayload {
  candidate: RTCIceCandidate;
  fromSocketId: string;
}

/**
 * WebRTC signal data (combined type for all signal types)
 */
export interface WebRTCSignalData {
  ice?: RTCIceCandidate;
  sdp?: RTCSessionDescriptionInit;
}

/**
 * Connection retry tracking
 */
export type ConnectionRetryCount = {
  [key: string]: number;
};

/**
 * Peer connection configuration
 */
export interface PeerConnectionConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize?: number;
}

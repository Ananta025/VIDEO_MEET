import { useState, useRef, useEffect, useContext, useCallback } from 'react'
import '../styles/VideoMeetingPage.css'
// Update import to use TypeScript version
import { updateVideoLayout, markAsScreenShare, updateLocalVideoPosition } from "../scripts/videoLayoutManager";
import { UserContext } from '../contexts/userContext'
import { useAuthCheck, validateMeetingAccess } from '../utils/AuthUtils'
import { ConnectionsType, VideoStream, ChatMessage, ConnectionRetryCount } from '@/types';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { selectMicOn, selectCamOn, selectScreenSharing } from '@/features/media/mediaSelectors';
import { toggleMic, toggleCam, setScreenSharing, setPermissionGranted } from '@/features/media/mediaSlice';
import { selectMeetingId, selectIsHost } from '@/features/meeting/meetingSelectors';
import { setMeetingId, setJoined, resetMeeting } from '@/features/meeting/meetingSlice';
import { selectAllParticipantIds, selectParticipantsById } from '@/features/participants/participantsSelectors';
import { addParticipant, removeParticipant, clearParticipants } from '@/features/participants/participantsSlice';
import VideoTile from '../components/VideoTile';

import { IconButton, Button, TextField, Alert } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import PresentToAllIcon from "@mui/icons-material/PresentToAll"; // Changed from ScreenshareIcon
import CancelPresentationIcon from "@mui/icons-material/CancelPresentation"; // Changed from StopscreenshareIcon
import ChatIcon from "@mui/icons-material/Chat";
import PeopleIcon from "@mui/icons-material/People";
import ThreeDotsIcon from "@mui/icons-material/MoreVert";
import RecordingControls from "../components/RecordingControls";
import { useNavigate, useParams } from 'react-router-dom';
import io, { Socket } from 'socket.io-client';
import axios from 'axios';

// Add server URL
const server_url = import.meta.env.VITE_SERVER_URL;
// Define peer connection config
const peerConfigConnection: RTCConfiguration = {
  iceServers: [
    { 
      urls: "stun:stun.l.google.com:19302"
    },
    {
      urls: "turn:numb.viagenie.ca",
      credential: "muazkh",
      username: "webrtc@live.com"
    }
  ],
  iceCandidatePoolSize: 10 // Add this to improve connection establishment
};

// Store connections globally to prevent recreation
const connectionsStore: ConnectionsType = {};

// Extending Window interface to include localStream property
declare global {
  interface Window {
    localStream: MediaStream;
  }
}

export default function VideoMeetingPage() {
  const navigate = useNavigate();
  const { meetingId, url } = useParams(); // Get meeting ID from URL params
  const actualMeetingId = meetingId || url; // Use either meetingId or url param
  
  const { user } = useContext(UserContext);
  const { isAuthenticated, loading } = useAuthCheck();
  const [meetingAccessChecked, setMeetingAccessChecked] = useState(false);
  const [meetingAccessError, setMeetingAccessError] = useState<string | null>(null);
  
  // Redux state
  const dispatch = useAppDispatch();
  const micOn = useAppSelector(selectMicOn);
  const camOn = useAppSelector(selectCamOn);
  const screenSharing = useAppSelector(selectScreenSharing);
  const reduxMeetingId = useAppSelector(selectMeetingId);
  const reduxIsHost = useAppSelector(selectIsHost);
  const participantIds = useAppSelector(selectAllParticipantIds);
  const participantsById = useAppSelector(selectParticipantsById);
  
  const [participentModal, setParticipentModal] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [videoAvailable, setVideoAvailable] = useState<boolean>(true);
  const [audioAvailable, setAudioAvailable] = useState<boolean>(true);
  const [screenAvailable, setScreenAvailable] = useState<boolean>(true); // Added missing state
  // Local state synced with Redux for track manipulation
  const [video, setVideo] = useState<boolean>(false);
  const [audio, setAudio] = useState<boolean>(false);
  const [screen, setScreen] = useState<boolean>(false);
  // isScreenSharing from Redux - local alias for backwards compatibility
  const isScreenSharing = screenSharing;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState<string>("");
  const [newMessages, setNewMessages] = useState<number>(0);
  const [askForUsername, setAskForUsername] = useState<boolean>(true);
  const [username, setUsername] = useState<string>("");
  
  // ============================================
  // CRITICAL FIX: Store MediaStreams in useRef, NOT in React state
  // MediaStream objects are mutable and don't work well with React's
  // immutable state model. Storing them in state causes:
  // - Missed re-renders when tracks change
  // - Black video tiles
  // - Stale stream references
  // ============================================
  
  // Store only participant IDs in state (triggers re-renders)
  const [remoteParticipantIds, setRemoteParticipantIds] = useState<string[]>([]);
  
  // Store actual MediaStream objects in a ref (mutable, doesn't trigger re-renders)
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  
  // Counter to force re-render when streams are updated
  const [streamUpdateCounter, setStreamUpdateCounter] = useState(0);
  
  const [localStreamReady, setLocalStreamReady] = useState<boolean>(false);
  
  // Pending connections: store clientId and whether to create an offer
  const pendingConnectionsRef = useRef<Array<{clientId: string, createOffer: boolean}>>([]);
  
  const connectionsRef = useRef<ConnectionsType>(connectionsStore);
  
  // Add ref to track if video state was updated
  const videoUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastVideoUpdateRef = useRef<number>(0);
  
  // Add missing refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const socketIdRef = useRef<string>("");

  // Add a ref for the chat display container
  const chatDisplayRef = useRef<HTMLDivElement>(null);

  // Add ref for remote video container
  const remoteVideoContainerRef = useRef<HTMLDivElement>(null);
  const localVideoContainerRef = useRef<HTMLDivElement>(null);

  // Add these state variables to the component
  const [connectionRetryCount, setConnectionRetryCount] = useState<ConnectionRetryCount>({});
  const streamReadyRef = useRef<boolean>(false);

  // Add these new state variables near the other state declarations
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [socketRetries, setSocketRetries] = useState<number>(0);
  const MAX_SOCKET_RETRIES = 3;
  const socketRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // ============================================
  // ICE CANDIDATE QUEUEING
  // ICE candidates may arrive before setRemoteDescription is called.
  // We must queue them and apply after remote description is set.
  // ============================================
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());
  
  // Track which connections have remote description set
  const remoteDescriptionSetRef = useRef<Set<string>>(new Set());

  // Add state for chat visibility on mobile
  const [isChatVisible, setIsChatVisible] = useState<boolean>(false);
  const [isMobileView, setIsMobileView] = useState<boolean>(window.innerWidth <= 768);
  const isHost = reduxIsHost; // Use Redux state
  const [isRecording, setIsRecording] = useState<boolean>(false);

  // Handle window resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const closeParticipantModal = () => {
    setIsClosing(true)
    timeoutRef.current = setTimeout(() => {
      setParticipentModal(false)
      setIsClosing(false)
    }, 500)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, []);

  // Update the getPermissions function to properly handle stream readiness
  const getPermissions = useCallback(async () => {
    try {
      console.log("Getting media permissions...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setVideoAvailable(true);
      setAudioAvailable(true);
      setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);
      
      setVideo(true);
      setAudio(true);
      
      // Update Redux permission state
      dispatch(setPermissionGranted(true));

      window.localStream = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Set both state and ref for stream readiness
      setLocalStreamReady(true);
      streamReadyRef.current = true;
      console.log("Local stream initialized successfully");
      
      // Process any pending connections that came in before stream was ready
      if (pendingConnectionsRef.current.length > 0 && socketRef.current) {
        console.log("Processing pending connections:", pendingConnectionsRef.current);
        const pendingConnections = [...pendingConnectionsRef.current];
        pendingConnectionsRef.current = [];
        
        // Process the pending connections with a small delay to ensure all states are updated
        setTimeout(() => {
          pendingConnections.forEach(({ clientId, createOffer }) => {
            createConnectionForClient(clientId, createOffer);
          });
        }, 500);
      }
    } catch (err: unknown) {
      console.error("Error getting media permissions:", err);
      const error = err as Error & { name?: string };
      if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        setVideoAvailable(false);
        setAudioAvailable(false);
      }
      
      // Even with no devices, we should create a black/silent stream
      console.log("Creating fallback black/silent stream");
      const BlackSilence = () => new MediaStream([silence(), black()]);
      window.localStream = BlackSilence();
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = window.localStream;
      }
      setLocalStreamReady(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  // ============================================
  // Helper function to add/update remote stream
  // 
  // KEY RESPONSIBILITIES:
  // 1. Store MediaStream in ref (NOT React state)
  // 2. Merge tracks when ontrack fires multiple times
  // 3. Manage participant ID list for rendering
  // 4. Trigger UI updates when stream becomes ready
  // 
  // MUST be defined BEFORE createConnectionForClient (which uses it)
  // ============================================
  const addRemoteStream = useCallback((clientId: string, remoteStream: MediaStream) => {
    const videoTracks = remoteStream.getVideoTracks();
    const audioTracks = remoteStream.getAudioTracks();
    
    console.log("[addRemoteStream] Called for:", clientId, {
      streamId: remoteStream.id,
      videoTracks: videoTracks.length,
      audioTracks: audioTracks.length,
      videoTrackStates: videoTracks.map(t => ({ id: t.id, ready: t.readyState, enabled: t.enabled }))
    });
    
    // SAFETY: Validate this is NOT our local stream
    if (window.localStream && remoteStream.id === window.localStream.id) {
      console.error("[addRemoteStream] BUG: Attempted to add local stream as remote! Blocking.");
      return;
    }
    
    // SAFETY: Don't add self
    if (clientId === socketIdRef.current) {
      console.warn("[addRemoteStream] Attempted to add self to remote videos, blocking");
      return;
    }
    
    // Check existing stream
    const existingStream = remoteStreamsRef.current.get(clientId);
    
    if (existingStream) {
      // ============================================
      // CASE 1: Stream already exists - MERGE TRACKS
      // This handles ontrack firing separately for audio/video
      // ============================================
      const existingTrackIds = new Set(existingStream.getTracks().map(t => t.id));
      let tracksAdded = false;
      let newTrackKinds: string[] = [];
      
      remoteStream.getTracks().forEach(track => {
        if (!existingTrackIds.has(track.id)) {
          console.log("[addRemoteStream] Merging new track:", track.kind, track.id);
          existingStream.addTrack(track);
          tracksAdded = true;
          newTrackKinds.push(track.kind);
        }
      });
      
      // Check if stream ID changed (indicates renegotiation)
      const streamIdChanged = existingStream.id !== remoteStream.id;
      
      if (streamIdChanged) {
        // Stream replaced entirely - use new stream
        console.log("[addRemoteStream] Stream ID changed, replacing for:", clientId);
        remoteStreamsRef.current.set(clientId, remoteStream);
        setStreamUpdateCounter(c => c + 1);
      } else if (tracksAdded) {
        // New tracks merged - trigger UI update
        console.log("[addRemoteStream] Tracks merged (", newTrackKinds.join(', '), ") for:", clientId);
        setStreamUpdateCounter(c => c + 1);
      }
      // If nothing changed, no UI update needed
      
    } else {
      // ============================================
      // CASE 2: New stream - STORE AND RENDER
      // ============================================
      console.log("[addRemoteStream] Storing NEW stream for:", clientId);
      
      // Step 1: Store in ref FIRST (before any state updates)
      remoteStreamsRef.current.set(clientId, remoteStream);
      
      // Step 2: Add to participant list if not already present
      // This triggers a re-render
      setRemoteParticipantIds(prev => {
        if (!prev.includes(clientId)) {
          console.log("[addRemoteStream] Adding participant to render list:", clientId);
          return [...prev, clientId];
        }
        return prev;
      });
      
      // Step 3: Force additional re-render after React processes state update
      // This ensures the render sees the ref value we just set
      // Using queueMicrotask for better timing than setTimeout
      queueMicrotask(() => {
        setStreamUpdateCounter(c => c + 1);
      });
    }
  }, []);

  // Create a helper function to set up a connection with proper error handling
  const createConnectionForClient = useCallback((clientId: string, createOffer = false) => {
    if (clientId === socketRef.current?.id) return;
    
    console.log("createConnectionForClient:", clientId, "createOffer:", createOffer);
    
    // Check if stream is ready using both state and ref for reliability
    if (!window.localStream || !streamReadyRef.current) {
      console.warn("Local stream not ready, queueing connection for:", clientId, "createOffer:", createOffer);
      // Queue with the createOffer flag so we know whether to initiate later
      const alreadyQueued = pendingConnectionsRef.current.some(p => p.clientId === clientId);
      if (!alreadyQueued) {
        pendingConnectionsRef.current.push({ clientId, createOffer });
      }
      return;
    }
    
    // ============================================
    // CRITICAL FIX FOR 3+ USERS:
    // Handle existing connections properly based on their state
    // ============================================
    const existingConnection = connectionsRef.current[clientId];
    if (existingConnection) {
      const state = existingConnection.connectionState;
      const iceState = existingConnection.iceConnectionState;
      
      console.log(`Existing connection for ${clientId}: state=${state}, iceState=${iceState}, createOffer=${createOffer}`);
      
      // Connection is in failed/closed state - close and recreate
      if (state === 'failed' || state === 'closed' || iceState === 'failed' || iceState === 'closed') {
        console.log(`Connection to ${clientId} is ${state}/${iceState}, recreating`);
        existingConnection.close();
        delete connectionsRef.current[clientId];
        // Clear related state
        remoteDescriptionSetRef.current.delete(clientId);
        pendingIceCandidatesRef.current.delete(clientId);
        // Continue to create new connection below
      } else if (createOffer) {
        // We need to create an offer for an existing connection
        // This happens when an existing user needs to initiate with a new user
        console.log(`Creating offer for existing connection to ${clientId}`);
        
        // Ensure local tracks are added
        const senders = existingConnection.getSenders();
        if (senders.length === 0 && window.localStream) {
          console.log("Adding local tracks to existing connection:", clientId);
          window.localStream.getTracks().forEach(track => {
            existingConnection.addTrack(track, window.localStream);
          });
        }
        
        // Create and send offer
        existingConnection
          .createOffer()
          .then((description) => {
            return existingConnection.setLocalDescription(description);
          })
          .then(() => {
            console.log("Sending offer to:", clientId);
            socketRef.current?.emit(
              "signal",
              clientId,
              JSON.stringify({ sdp: existingConnection.localDescription })
            );
          })
          .catch((e) => console.error("Error creating offer for existing connection:", e));
        return;
      } else {
        // No offer needed - connection already exists
        // For states: 'new', 'connecting', 'connected'
        // The connection is in progress or already established
        if (state === 'connected') {
          console.log(`Connection to ${clientId} already connected, no action needed`);
        } else {
          console.log(`Connection to ${clientId} is ${state}, waiting for signaling`);
        }
        return;
      }
    }
    
    // Create new RTCPeerConnection
    console.log("Creating new RTCPeerConnection for:", clientId);
    connectionsRef.current[clientId] = new RTCPeerConnection(peerConfigConnection);
    
    // Handle ICE candidates
    connectionsRef.current[clientId].onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        console.log("Sending ICE candidate to:", clientId);
        socketRef.current.emit(
          "signal",
          clientId,
          JSON.stringify({ ice: event.candidate })
        );
      }
    };
    
    // Track ICE connection state changes
    connectionsRef.current[clientId].oniceconnectionstatechange = () => {
      const connectionState = connectionsRef.current[clientId].iceConnectionState;
      console.log(`ICE connection state for ${clientId}: ${connectionState}`);
      
      // Handle failed connections with retry logic
      if (connectionState === 'failed' || connectionState === 'disconnected') {
        const retryCount = connectionRetryCount[clientId] || 0;
        if (retryCount < 3) {
          console.log(`Retrying connection to ${clientId}, attempt ${retryCount + 1}`);
          // Wait a bit before retrying
          setTimeout(() => {
            // Close the old connection
            connectionsRef.current[clientId].close();
            delete connectionsRef.current[clientId];
            
            // Clear ICE state
            remoteDescriptionSetRef.current.delete(clientId);
            pendingIceCandidatesRef.current.delete(clientId);
            
            // Increment retry count
            setConnectionRetryCount(prev => ({
              ...prev,
              [clientId]: retryCount + 1
            }));
            
            // Create a new connection - use recursive call pattern
            createConnectionForClient(clientId, true);
          }, 1000);
        } else {
          console.log(`Maximum retry attempts reached for ${clientId}`);
        }
      }
    };
    
    // ============================================
    // CRITICAL: ontrack handler for receiving remote media
    // 
    // ontrack fires ONCE PER TRACK (typically 2x: audio + video)
    // We must handle this correctly:
    // 1. Use event.streams[0] as source of truth (contains all tracks)
    // 2. If no stream, create one and add the track
    // 3. Pass to addRemoteStream which merges tracks intelligently
    // 4. UI will show placeholder until stream has tracks
    // ============================================
    connectionsRef.current[clientId].ontrack = (event) => {
      console.log("[ontrack] Received track from:", clientId, 
        "Kind:", event.track.kind, 
        "ReadyState:", event.track.readyState,
        "Enabled:", event.track.enabled);
      
      // Get the remote stream - event.streams[0] is the source of truth
      // It contains ALL tracks that have been negotiated for this peer
      let remoteStream = event.streams[0];
      
      if (!remoteStream) {
        // Fallback: create stream manually (rare edge case)
        console.log("[ontrack] No stream in event, creating new MediaStream for:", clientId);
        
        // Check if we already have a stream for this client
        const existingStream = remoteStreamsRef.current.get(clientId);
        if (existingStream) {
          // Add track to existing stream
          console.log("[ontrack] Adding track to existing stream for:", clientId);
          const existingTrackIds = new Set(existingStream.getTracks().map(t => t.id));
          if (!existingTrackIds.has(event.track.id)) {
            existingStream.addTrack(event.track);
          }
          remoteStream = existingStream;
        } else {
          // Create new stream
          remoteStream = new MediaStream();
          remoteStream.addTrack(event.track);
        }
      }
      
      // Log stream state for debugging
      console.log("[ontrack] Stream state for", clientId, ":", {
        streamId: remoteStream.id,
        audioTracks: remoteStream.getAudioTracks().length,
        videoTracks: remoteStream.getVideoTracks().length,
        totalTracks: remoteStream.getTracks().length
      });
      
      // Pass to addRemoteStream - it handles:
      // - Storing in ref
      // - Merging tracks if stream already exists
      // - Triggering UI update
      addRemoteStream(clientId, remoteStream);
    };
    
    // Add local stream to the new connection using tracks (modern approach)
    try {
      if (window.localStream) {
        console.log("Adding local tracks to new connection:", clientId);
        window.localStream.getTracks().forEach(track => {
          connectionsRef.current[clientId].addTrack(track, window.localStream);
        });
      }
    } catch (err) {
      console.error("Error adding tracks to new connection:", err);
    }
    
    // If createOffer flag is true, create an offer
    if (createOffer && window.localStream) {
      console.log("Creating offer for:", clientId);
      connectionsRef.current[clientId]
        .createOffer()
        .then((description) => {
          console.log("Setting local description for:", clientId);
          connectionsRef.current[clientId]
            .setLocalDescription(description)
            .then(() => {
              console.log("Sending signal to:", clientId);
              socketRef.current?.emit(
                "signal",
                clientId,
                JSON.stringify({
                  sdp: connectionsRef.current[clientId].localDescription,
                })
              );
            })
            .catch((e) => console.error("Error setting local description:", e));
        })
        .catch((e) => console.error("Error creating offer:", e));
    }
  }, [connectionRetryCount, addRemoteStream]);
  
  // Helper function to get stream for a participant (used by VideoTile)
  const getRemoteStream = useCallback((participantId: string): MediaStream | null => {
    return remoteStreamsRef.current.get(participantId) || null;
  }, []);

  const getUserMediaSuccess = (stream: MediaStream) => {
    try {
      if (window.localStream) {
        window.localStream.getTracks().forEach((track) => track.stop());
      }
    } catch (err) {
      console.log(err);
    }
    window.localStream = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    
    // Mark stream as ready
    streamReadyRef.current = true;
    setLocalStreamReady(true);
    console.log("getUserMediaSuccess: Local stream set and ready");

    for (const peerId in connectionsRef.current) {
      if (peerId === socketRef.current?.id) {
        continue;
      }
      
      // Use addTrack instead of addStream (which is deprecated)
      try {
        // Remove any existing tracks first
        const senders = connectionsRef.current[peerId].getSenders();
        senders.forEach(sender => {
          connectionsRef.current[peerId].removeTrack(sender);
        });
        
        // Add new tracks
        stream.getTracks().forEach(track => {
          connectionsRef.current[peerId].addTrack(track, stream);
        });
      } catch (e) {
        console.error("Error updating tracks for peer:", peerId, e);
      }
      
      connectionsRef.current[peerId].createOffer().then((description) => {
        connectionsRef.current[peerId]
          .setLocalDescription(description)
          .then(() => {
            socketRef.current?.emit(
              "signal",
              peerId,
              JSON.stringify({ sdp: connectionsRef.current[peerId].localDescription })
            );
          })
          .catch((err) => console.log(err));
      });
    }
    
    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          setVideo(false);
          setAudio(false);
          try {
            if (localVideoRef.current && localVideoRef.current.srcObject) {
              const stream = localVideoRef.current.srcObject as MediaStream;
              stream.getTracks().forEach((track) => track.stop());
            }
          } catch (err) {
            console.log(err);
          }
          //Todo BlackSilence
          const BlackSilence = () => new MediaStream([silence(), black()]);
          window.localStream = BlackSilence();
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = window.localStream;
          }
          for (const peerId in connectionsRef.current) {
            if (peerId === socketRef.current?.id) {
              continue;
            }
            // removeStream is deprecated, use getSenders().forEach(sender => connection.removeTrack(sender)) instead
          window.localStream.getTracks().forEach(track => {
            const senders = connectionsRef.current[peerId].getSenders().filter(sender => sender.track === track);
            senders.forEach(sender => connectionsRef.current[peerId].removeTrack(sender));
          });
            connectionsRef.current[peerId].createOffer().then((description) => {
              connectionsRef.current[peerId]
                .setLocalDescription(description)
                .then(() => {
                  socketRef.current?.emit(
                    "signal",
                    peerId,
                    JSON.stringify({
                      sdp: connectionsRef.current[peerId].localDescription,
                    })
                  );
                })
                .catch((err) => console.log(err));
            });
          }
        })
    );
  };
  const silence = () => {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    // Fix the AudioNode stream property error by accessing MediaStreamAudioDestinationNode correctly
    return Object.assign((dst as MediaStreamAudioDestinationNode).stream.getAudioTracks()[0], { enabled: false });
  };

  const black = ({ width = 640, height = 480 } = {}) => {
    const canvas = Object.assign(document.createElement("canvas"), {
      width,
      height,
    });
    canvas.getContext("2d")?.fillRect(0, 0, width, height);
    const stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  const getUserMedia = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((video && videoAvailable) || (audio && audioAvailable)) {
        // Store current enabled states before getting new stream
        const previousVideoEnabled = video;
        const previousAudioEnabled = audio;
        
        navigator.mediaDevices
          .getUserMedia({
            video: videoAvailable ? video : false,
            audio: audioAvailable ? audio : false,
          })
          .then((stream) => {
            // Apply previous enabled states to new tracks
            if (stream.getVideoTracks().length > 0) {
              stream.getVideoTracks().forEach(track => {
                track.enabled = previousVideoEnabled;
              });
            }
            
            if (stream.getAudioTracks().length > 0) {
              stream.getAudioTracks().forEach(track => {
                track.enabled = previousAudioEnabled;
              });
            }
            
            // Continue with the rest of the process
            getUserMediaSuccess(stream);
            resolve();
          })
          .catch((err) => {
            console.error("getUserMedia error:", err);
            reject(err);
          });
      } else {
        // No media requested - ensure we still have a valid stream (black/silence)
        console.log("getUserMedia: No media requested, ensuring fallback stream");
        
        // Check if we already have a valid stream from getPermissions
        if (window.localStream && window.localStream.active) {
          console.log("Using existing localStream from getPermissions");
          // Ensure local video ref is set
          if (localVideoRef.current && !localVideoRef.current.srcObject) {
            localVideoRef.current.srcObject = window.localStream;
          }
          streamReadyRef.current = true;
          setLocalStreamReady(true);
          resolve();
        } else {
          // Create a black/silence fallback stream
          console.log("Creating black/silence fallback stream");
          const BlackSilence = () => new MediaStream([silence(), black()]);
          window.localStream = BlackSilence();
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = window.localStream;
          }
          streamReadyRef.current = true;
          setLocalStreamReady(true);
          resolve();
        }
      }
    });
  };

  // ============================================
  // Helper: Apply any pending ICE candidates for a peer
  // Called after setRemoteDescription succeeds
  // ============================================
  const applyPendingIceCandidates = useCallback((peerId: string) => {
    const pendingCandidates = pendingIceCandidatesRef.current.get(peerId);
    if (pendingCandidates && pendingCandidates.length > 0) {
      console.log(`Applying ${pendingCandidates.length} pending ICE candidates for:`, peerId);
      pendingCandidates.forEach(candidate => {
        connectionsRef.current[peerId]
          ?.addIceCandidate(candidate)
          .catch(e => console.error("Error applying pending ICE candidate:", e));
      });
      pendingIceCandidatesRef.current.delete(peerId);
    }
  }, []);

  const gotMessageFromServer = (fromId: string, message: string) => {
    const signal = JSON.parse(message);
    if (fromId !== socketIdRef.current) {
      // Make sure connection exists with local tracks
      if (!connectionsRef.current[fromId]) {
        console.log("Creating connection for incoming signal from:", fromId);
        createConnectionForClient(fromId, false);
      }
      
      // CRITICAL: Verify connection was actually created
      // createConnectionForClient may queue and return if stream isn't ready
      if (!connectionsRef.current[fromId]) {
        console.warn("Connection not created yet for:", fromId, "- signal will be lost");
        // Try again with a small delay
        setTimeout(() => {
          console.log("Retrying gotMessageFromServer for:", fromId);
          gotMessageFromServer(fromId, message);
        }, 100);
        return;
      }
      
      // Ensure local tracks are added to the connection before processing SDP
      // This is crucial for the answer to include our media streams
      if (window.localStream && connectionsRef.current[fromId]) {
        const senders = connectionsRef.current[fromId].getSenders();
        if (senders.length === 0) {
          console.log("Adding local tracks to connection for:", fromId);
          try {
            window.localStream.getTracks().forEach(track => {
              connectionsRef.current[fromId].addTrack(track, window.localStream);
            });
          } catch (err) {
            console.error("Error adding tracks in gotMessageFromServer:", err);
          }
        }
      }
      
      if (signal.sdp) {
        console.log("Processing SDP from:", fromId, "Type:", signal.sdp.type);
        connectionsRef.current[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            // Mark remote description as set for this peer
            remoteDescriptionSetRef.current.add(fromId);
            
            // Apply any pending ICE candidates that arrived before remote description
            applyPendingIceCandidates(fromId);
            
            if (signal.sdp.type === "offer") {
              console.log("Received offer from:", fromId, "- creating answer");
              connectionsRef.current[fromId]
                .createAnswer()
                .then((description) => {
                  connectionsRef.current[fromId]
                    .setLocalDescription(description)
                    .then(() => {
                      console.log("Sending answer to:", fromId);
                      if (socketRef.current) {
                        socketRef.current.emit(
                          "signal",
                          fromId,
                          JSON.stringify({
                            sdp: connectionsRef.current[fromId].localDescription,
                          })
                        );
                      }
                    })
                    .catch((e) => console.error("Error setting local description:", e));
                })
                .catch((e) => console.error("Error creating answer:", e));
            } else if (signal.sdp.type === "answer") {
              console.log("Received answer from:", fromId, "- connection established");
            }
          })
          .catch((e) => console.error("Error setting remote description:", e));
      }

      // ICE CANDIDATE QUEUEING FIX
      // If remote description is not set yet, queue the candidate
      if (signal.ice) {
        const iceCandidate = new RTCIceCandidate(signal.ice);
        
        if (remoteDescriptionSetRef.current.has(fromId)) {
          // Remote description is set, apply immediately
          console.log("Applying ICE candidate immediately for:", fromId);
          connectionsRef.current[fromId]
            ?.addIceCandidate(iceCandidate)
            .catch((e) => console.error("Error adding ICE candidate:", e));
        } else {
          // Queue the candidate for later
          console.log("Queueing ICE candidate for:", fromId, "(remote description not set yet)");
          if (!pendingIceCandidatesRef.current.has(fromId)) {
            pendingIceCandidatesRef.current.set(fromId, []);
          }
          pendingIceCandidatesRef.current.get(fromId)!.push(iceCandidate);
        }
      }
    }
  };

  const addMessage = (data: string, sender: string, socketIdSender: string) => {
    setMessages((prevMessages) => [...prevMessages, {data, sender}]);
    if(socketIdSender !== socketIdRef.current){
      setNewMessages((prevMessages) => (prevMessages || 0) + 1);
    }
  };

  // Add useEffect to scroll to bottom when messages change
  useEffect(() => {
    if (chatDisplayRef.current) {
      chatDisplayRef.current.scrollTop = chatDisplayRef.current.scrollHeight;
    }
  }, [messages]);

  // Update layout whenever remote participants change or screen sharing state changes
  useEffect(() => {
    if (remoteVideoContainerRef.current) {
      updateVideoLayout(remoteVideoContainerRef.current, remoteParticipantIds.length, isScreenSharing);
    }
    
    if (localVideoContainerRef.current) {
      updateLocalVideoPosition(localVideoContainerRef.current, remoteParticipantIds.length, isScreenSharing);
    }
  }, [remoteParticipantIds.length, isScreenSharing]);

  // Add this function to toggle chat visibility on mobile
  const toggleChatVisibility = () => {
    setIsChatVisible(!isChatVisible);
    // Reset new message counter when opening chat
    if (!isChatVisible) {
      setNewMessages(0);
    }
  };

  // Add useEffect to handle resize events
  useEffect(() => {
    const handleResize = () => {
      // Reset chat visibility on larger screens
      if (window.innerWidth > 768 && isChatVisible) {
        setIsChatVisible(false);
      }
      
      // Update video layouts
      if (remoteVideoContainerRef.current) {
        updateVideoLayout(remoteVideoContainerRef.current, remoteParticipantIds.length, isScreenSharing);
      }
      
      if (localVideoContainerRef.current) {
        updateLocalVideoPosition(localVideoContainerRef.current, remoteParticipantIds.length, isScreenSharing);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [remoteParticipantIds.length, isScreenSharing, isChatVisible]);

  // Replace the connectToSocketServer function with this more robust implementation
  const connectToSocketServer = () => {
    console.log("Connecting to socket server:", server_url);
    
    // Clean up any existing socket connection and timeouts
    if (socketRetryTimeoutRef.current) {
      clearTimeout(socketRetryTimeoutRef.current);
      socketRetryTimeoutRef.current = null;
    }
    
    if (socketRef.current) {
      console.log("Cleaning up existing socket connection");
      socketRef.current.offAny();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    // Reset socket error state
    setSocketError(null);
    
    try {
      // Create new socket connection with reconnection options
      socketRef.current = io(server_url, { 
        secure: true,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        timeout: 10000, // Increase timeout to allow for slower connections
        transports: ['websocket', 'polling'] // Try WebSocket first, fallback to polling
      });
      
      // Track connection status
      socketRef.current.on("connect", () => {
        console.log("Connected to socket server with ID:", socketRef.current?.id);
        setSocketConnected(true);
        setSocketRetries(0); // Reset retry counter on successful connection
        socketIdRef.current = socketRef.current?.id ?? '';
        
        // Sync meeting ID to Redux
        if (actualMeetingId) {
          dispatch(setMeetingId(actualMeetingId));
          dispatch(setJoined(true));
        }
        
        // Join call room after successful connection
        socketRef.current?.emit("join-call", window.location.href);
        
        // Set up all the event handlers after successful connection
        setupSocketEventHandlers();
      });
      
      // Handle connection errors
      socketRef.current.on("connect_error", (error: Error) => {
        console.error("Socket connection error:", error);
        setSocketError(error.message);
        
        // Only attempt auto-reconnect if we haven't exceeded retry limit
        if (socketRetries < MAX_SOCKET_RETRIES) {
          console.log(`Connection failed. Retrying (${socketRetries + 1}/${MAX_SOCKET_RETRIES})...`);
          socketRetryTimeoutRef.current = setTimeout(() => {
            setSocketRetries(prev => prev + 1);
            connectToSocketServer();
          }, 2000); // Wait 2 seconds before retry
        } else {
          console.error("Maximum connection retry attempts reached");
        }
      });
      
      socketRef.current.on("disconnect", (reason: string) => {
        console.log("Socket disconnected:", reason);
        setSocketConnected(false);
        
        // If the server disconnected us on purpose, don't attempt to reconnect
        if (reason === 'io server disconnect') {
          console.log("Server disconnected the socket. Not attempting to reconnect.");
        }
      });
      
      // Handle connection timeout
      socketRef.current.on("connect_timeout", () => {
        console.error("Socket connection timeout");
        setSocketError("Connection timeout");
      });
      
    } catch (err: unknown) {
      console.error("Error creating socket:", err);
      setSocketError(err instanceof Error ? err.message : "Failed to create socket connection");
    }
  };

  // Move socket event handlers to a separate function for cleaner organization
  const setupSocketEventHandlers = () => {
    if (!socketRef.current) return;
    
    socketRef.current.on("signal", (fromId: string, message: string) => {
      console.log("Signal received from:", fromId);
      gotMessageFromServer(fromId, message);
    });
    
    socketRef.current.on("chat-message", (data: string, sender: string, socketIdSender: string) => {
      console.log("Chat message received from:", sender);
      addMessage(data, sender, socketIdSender);
    });
    
    socketRef.current.on("user-left", (id: string) => {
      console.log("User left:", id);
      
      // Close and clean up the connection
      if (connectionsRef.current[id]) {
        connectionsRef.current[id].close();
        delete connectionsRef.current[id];
      }
      
      // Clean up ICE candidate queue and remote description tracking
      pendingIceCandidatesRef.current.delete(id);
      remoteDescriptionSetRef.current.delete(id);
      
      // Remove from Redux participants
      dispatch(removeParticipant(id));
      
      // Remove stream from ref and update participant IDs
      remoteStreamsRef.current.delete(id);
      setRemoteParticipantIds(prev => prev.filter(pid => pid !== id));
      
      // Force UI update
      setStreamUpdateCounter(c => c + 1);
    });
    
    socketRef.current.on("user-joined", (userId: string, clients: string[]) => {
      console.log("User joined event - userId:", userId, "My ID:", socketRef.current?.id);
      console.log("Current clients in room:", clients);
      
      if (!clients || !Array.isArray(clients)) {
        console.error("Invalid clients data received:", clients);
        return;
      }
      
      const isNewUserMe = userId === socketRef.current?.id;
      
      if (isNewUserMe) {
        // ============================================
        // CASE 1: I am the new user who just joined
        // ============================================
        console.log("I am the new user - setting up connections for existing participants");
        
        // Get list of OTHER clients (not me)
        const otherClients = clients.filter(c => c !== socketRef.current?.id);
        console.log("Other clients I need to connect to:", otherClients);
        
        // Add all existing users to our participant list
        otherClients.forEach((clientId) => {
          // Add to Redux participants
          dispatch(addParticipant({
            id: clientId,
            name: `Participant`,
            isHost: false,
            micOn: false,
            camOn: false,
            joinedAt: Date.now(),
          }));
          
          // Create peer connection infrastructure (no offer - existing users will send offers)
          // The existing user will create the offer and send it to us
          createConnectionForClient(clientId, false);
        });
        
      } else {
        // ============================================
        // CASE 2: Someone else joined - I'm existing user
        // ============================================
        console.log("New participant joined:", userId, "- I will create an offer for them");
        
        // Add new participant to Redux
        dispatch(addParticipant({
          id: userId,
          name: `Participant`,
          isHost: false,
          micOn: false,
          camOn: false,
          joinedAt: Date.now(),
        }));
        
        // Existing users MUST create offers for the new user
        // This triggers the WebRTC handshake immediately
        if (window.localStream && streamReadyRef.current) {
          console.log("Creating offer for new user:", userId);
          createConnectionForClient(userId, true); // createOffer = true
        } else {
          console.warn("Local stream not ready, queueing connection for:", userId);
          const alreadyQueued = pendingConnectionsRef.current.some(p => p.clientId === userId);
          if (!alreadyQueued) {
            pendingConnectionsRef.current.push({ clientId: userId, createOffer: true });
          }
        }
      }
    });
  };

  // Update the getMedia function to handle socket errors
  const getMedia = useCallback(async () => {
    try {
      setVideo(videoAvailable);
      setAudio(audioAvailable);
      await getUserMedia();  // Wait for getUserMedia to complete (now properly returns Promise)
      
      // At this point, getUserMediaSuccess has been called and streamReadyRef should be true
      // Verify the stream is actually ready
      if (!streamReadyRef.current || !window.localStream) {
        console.warn("Stream not ready after getUserMedia, using fallback");
        const BlackSilence = () => new MediaStream([silence(), black()]);
        window.localStream = BlackSilence();
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = window.localStream;
        }
        streamReadyRef.current = true;
        setLocalStreamReady(true);
      }
      
      // Small delay to ensure DOM updates are complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log("getMedia: Stream ready, connecting to socket server");
      connectToSocketServer();
    } catch (err) {
      console.error("Error in getMedia:", err);
      // Fall back to a black/silent stream if there's an error
      const BlackSilence = () => new MediaStream([silence(), black()]);
      window.localStream = BlackSilence();
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = window.localStream;
      }
      streamReadyRef.current = true;
      setLocalStreamReady(true);
      connectToSocketServer();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoAvailable, audioAvailable]);

  const connect = () => {
    if (username !== "") {
      setAskForUsername(false);
      getMedia();
    }
  };

  const handleVideo = () => {
    // Toggle Redux state for UI
    dispatch(toggleCam());
    // Toggle local state for immediate UI feedback
    setVideo(!video);
    
    // Apply changes directly to stream tracks
    if (window.localStream) {
      const videoTracks = window.localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks.forEach(track => {
          track.enabled = !video;
        });
      }
    }
  };

  const handleAudio = () => {
    // Toggle Redux state for UI
    dispatch(toggleMic());
    // Toggle local state for immediate UI feedback
    setAudio(!audio);
    
    // Apply changes directly to stream tracks
    if (window.localStream) {
      const audioTracks = window.localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks.forEach(track => {
          track.enabled = !audio;
        });
      }
    }
  };

  const getDisplayMediaSuccess = (stream: MediaStream) => {
    try{
      window.localStream.getTracks().forEach(track => track.stop());
    }catch(err){
      console.error("Error: ", err);}

    window.localStream = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      // Mark the local video as screen sharing
      markAsScreenShare(localVideoRef.current, true);
    }

    // Update Redux screen sharing state
    dispatch(setScreenSharing(true));

    for(const peerId in connectionsRef.current){
      if(peerId === socketRef.current?.id){
        continue;
      }
      
      // Use addTrack instead of addStream (which is deprecated)
      try {
        // Remove any existing tracks first
        const senders = connectionsRef.current[peerId].getSenders();
        senders.forEach(sender => {
          connectionsRef.current[peerId].removeTrack(sender);
        });
        
        // Add new tracks
        stream.getTracks().forEach(track => {
          connectionsRef.current[peerId].addTrack(track, stream);
        });
        
        // Create and send an offer
        connectionsRef.current[peerId].createOffer().then(description => {
          connectionsRef.current[peerId].setLocalDescription(description).then(() => {
            socketRef.current?.emit("signal", peerId, JSON.stringify({sdp: connectionsRef.current[peerId].localDescription}));
          }).catch(err => console.error("Error: ", err));
        }).catch(err => console.error("Error: ", err));
      } catch (e) {
        console.error("Error updating tracks for peer:", peerId, e);
      }
    }
    
    stream.getTracks().forEach(track => track.onended = () => {
      setScreen(false);
      dispatch(setScreenSharing(false)); // Update Redux state when screen sharing ends
      
      if (localVideoRef.current) {
        // Unmark as screen sharing
        markAsScreenShare(localVideoRef.current, false);
      }
      
      try{
        if (localVideoRef.current && localVideoRef.current.srcObject) {
          const stream = localVideoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
        }
      }catch(err){
        console.error("Error: ", err);
      }
      const BlackSilence = () => new MediaStream([silence(), black()]);
      window.localStream = BlackSilence();
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = window.localStream;
      }

      getUserMedia();
    });
  };

  const getDisplayMedia = () => {
    if(!isScreenSharing){
      if(navigator.mediaDevices.getDisplayMedia){
        try{
          navigator.mediaDevices.getDisplayMedia({video: true, audio: true})
          .then(getDisplayMediaSuccess)
          .catch(err => {
            console.error("Error getting display media: ", err);
            setScreen(false);
          });
        }catch(err){
          console.error("Error: ", err);
          setScreen(false);
        }
      }
    } else {
      // If already screen sharing, stop it
      try {
        if (localVideoRef.current && localVideoRef.current.srcObject) {
          const stream = localVideoRef.current.srcObject as MediaStream;
          const screenTracks = stream.getVideoTracks();
          screenTracks.forEach(track => track.stop());
          dispatch(setScreenSharing(false));
          setScreen(false);
          getUserMedia(); // Go back to camera
        }
      } catch(err) {
        console.error("Error stopping screen share: ", err);
      }
    }
  };

  const handleScreen = () => {
    // Only allow screen sharing after username is entered
    if (!askForUsername) {
      if (!isScreenSharing) {
        setScreen(true);
        getDisplayMedia();
      } else {
        setScreen(false);
        try {
          if (localVideoRef.current && localVideoRef.current.srcObject) {
            const stream = localVideoRef.current.srcObject as MediaStream;
            const screenTracks = stream.getVideoTracks();
            screenTracks.forEach(track => track.stop());
            dispatch(setScreenSharing(false));
            getUserMedia(); // Go back to camera
          }
        } catch(err) {
          console.error("Error stopping screen share: ", err);
        }
      }
    }
  };

  const sendMessage = () => {
    if (message.trim() === '') return;
    
    // Add message to local state immediately (don't wait for server echo)
    addMessage(message, username, socketIdRef.current);
    
    // Check if socket is available before trying to emit
    if (socketRef.current && socketConnected) {
      // Emit to other participants
      socketRef.current.emit("chat-message", message, username);
    } else {
      // Add an error message to the chat if socket is disconnected
      addMessage("Message could not be sent (disconnected)", "System", "system");
      console.warn("Cannot send message: Socket not connected");
    }
    
    // Clear input
    setMessage("");
  };

  // Add utility function to properly stop a media stream
  const stopMediaStream = (stream: MediaStream | null) => {
    if (!stream) return;
    
    try {
      // Stop all tracks individually
      stream.getTracks().forEach(track => {
        track.stop();
        stream.removeTrack(track); // Remove track from stream
      });
    } catch (err) {
      console.error("Error stopping media stream tracks:", err);
    }
  };

  // Update this function to handle the custom meeting ID format
  const updateMeetingStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log("No token found, skipping meeting status update");
        return;
      }

      // Extract meeting ID from URL
      const pathParts = window.location.pathname.split('/');
      const meetingId = pathParts[pathParts.length - 1];
      
      console.log("Updating meeting status for ID:", meetingId);
      
      // Current timestamp for accurate end time
      const endTimeStamp = new Date().toISOString();
      
      // First check if the meeting already exists
      try {
        const checkResponse = await axios.get(
          `${import.meta.env.VITE_BASE_URL}/meetings/${meetingId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
        
        // If meeting exists, update it
        if (checkResponse.data.success) {
          console.log("Found existing meeting, updating status");
        }
      } catch (_err) {
        console.log("Meeting not found, no update needed");
        return null;
      }
      
      // Call API to update meeting status
      const response = await axios.put(
        `${import.meta.env.VITE_BASE_URL}/meetings/${meetingId}`,
        {
          status: 'completed',
          endTime: endTimeStamp
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      if (response.data.success) {
        console.log("Meeting status updated successfully");
      } else {
        console.error("Failed to update meeting status:", response.data);
      }
      
      return response;
    } catch (error) {
      console.error("Failed to update meeting status:", error);
      // Don't rethrow so we don't block navigation
      return null;
    }
  };

  const handleEndCall = async () => {
    console.log("Ending call and cleaning up resources...");
    
    try {
      // First update meeting status before any potential issues with media cleanup
      await updateMeetingStatus();
      
      // Stop screen sharing if active
      if (isScreenSharing) {
        dispatch(setScreenSharing(false));
        setScreen(false);
      }
      
      // Stop local video/audio tracks and clear references
      if (window.localStream) {
        console.log("Stopping local stream tracks...");
        stopMediaStream(window.localStream);
        // @ts-expect-error - Intentionally setting to null for cleanup
        window.localStream = null;
      }
      
      // Stop tracks from video element source
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        console.log("Stopping video element source stream...");
        const stream = localVideoRef.current.srcObject as MediaStream;
        stopMediaStream(stream);
        
        // Clear source
        localVideoRef.current.srcObject = null;
      }
      
      // Close all peer connections properly
      console.log("Closing all peer connections...");
      Object.entries(connectionsRef.current).forEach(([id, connection]) => {
        if (connection) {
          // Remove all event listeners
          connection.onicecandidate = null;
          // onaddstream and onremovestream are deprecated
          // Instead, we should be using track events, but we're just cleaning up here
          connection.oniceconnectionstatechange = null;
          
          // Close the connection
          connection.close();
          delete connectionsRef.current[id]; // Remove reference
        }
      });
      
      // Disconnect from socket and remove all listeners
      if (socketRef.current) {
        console.log("Disconnecting socket...");
        socketRef.current.offAny(); // Remove all event listeners
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      // Reset all state
      setVideo(false);
      setAudio(false);
      setScreen(false);
      dispatch(setScreenSharing(false));
      dispatch(clearParticipants()); // Clear Redux participants
      dispatch(resetMeeting()); // Reset Redux meeting state
      
      // Clear remote streams ref and participant IDs
      remoteStreamsRef.current.clear();
      setRemoteParticipantIds([]);
      
      console.log("All media resources cleaned up successfully");
    } catch (err) {
      console.error("Error during call cleanup:", err);
    } finally {
      // Small delay to ensure all cleanup completes
      setTimeout(() => {
        // Navigate back to home after cleanup
        navigate("/home");
      }, 100);
    }
  };

  // Update cleanup in useEffect to use the same thorough cleanup
  useEffect(() => {
    getPermissions();
    
    return () => {
      console.log("Component unmounting, cleaning up resources...");
      // Clean up peer connections
      Object.values(connectionsRef.current).forEach((connection) => {
        if (connection) {
          connection.onicecandidate = null;
          // onaddstream is deprecated
          // Instead, we should be using track events, but we're just cleaning up here
          connection.close();
        }
      });
      
      // Clean up media streams
      if (window.localStream) {
        stopMediaStream(window.localStream);
        // @ts-expect-error - Intentionally setting to null for cleanup
        window.localStream = null;
      }
      
      // Clean up socket
      if (socketRef.current) {
        socketRef.current.offAny();
        socketRef.current.disconnect();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check for logged-in user and set username if available
  useEffect(() => {
    if (!loading) {
      if (isAuthenticated && user?.name) {
        // User is authenticated and we have their name
        setUsername(user.name);
        setAskForUsername(false);
        getMedia();
      } else {
        // Check local storage as fallback
        const token = localStorage.getItem('token');
        
        if (!token) {
          // If no token and not on localhost, redirect to login
          if (!window.location.hostname.includes('localhost')) {
            navigate('/login');
          }
        } else {
          // We have a token but no user data yet - the auth check will handle loading it
          // Just show the username prompt until data loads
          const storedUserData = localStorage.getItem('userData');
          if (storedUserData) {
            try {
              const userData = JSON.parse(storedUserData);
              if (userData.name) {
                setUsername(userData.name);
                setAskForUsername(false);
                getMedia();
              }
            } catch (e) {
              console.error("Error parsing stored user data", e);
            }
          }
        }
      }
    }
  }, [loading, isAuthenticated, user, navigate, getMedia]);

  // First check if the user has access to this meeting
  useEffect(() => {
    const checkMeetingAccess = async () => {
      if (!loading && isAuthenticated && actualMeetingId) {
        try {
          const result = await validateMeetingAccess(actualMeetingId);
          
          if (result.success) {
            console.log("Meeting access granted:", result.meetingData);
            setMeetingAccessChecked(true);
          } else {
            console.error("Meeting access denied:", result.message);
            setMeetingAccessError(result.message);
          }
        } catch (error) {
          console.error("Error checking meeting access:", error);
          setMeetingAccessError("Failed to validate meeting access");
        }
      }
    };
    
    checkMeetingAccess();
  }, [loading, isAuthenticated, actualMeetingId]);
  
  // When user is authenticated and has meeting access, get media first, then connect
  useEffect(() => {
    if (isAuthenticated && meetingAccessChecked && !askForUsername && username) {
      // First get media, then socket connection will follow
      getMedia();
    }
  }, [isAuthenticated, meetingAccessChecked, askForUsername, username, getMedia]);

  // Add another effect to handle reconnections when local stream becomes available
  useEffect(() => {
    // When local stream becomes ready, process any pending connections
    if (localStreamReady && pendingConnectionsRef.current.length > 0 && socketRef.current) {
      console.log("Local stream now ready, processing pending connections");
      const pendingConnections = [...pendingConnectionsRef.current];
      pendingConnectionsRef.current = [];
      
      // Process connections with a small delay to ensure state is fully updated
      setTimeout(() => {
        pendingConnections.forEach(({ clientId, createOffer }) => {
          createConnectionForClient(clientId, createOffer);
        });
      }, 500);
    }
  }, [localStreamReady, createConnectionForClient]);

  // Add a useEffect to reset stream ready status when the component unmounts
  useEffect(() => {
    // Set initial state
    streamReadyRef.current = false;
    
    return () => {
      // Reset on unmount
      streamReadyRef.current = false;
      setLocalStreamReady(false);
    };
  }, []);

  // Add an additional useEffect for cleanup
  useEffect(() => {
    return () => {
      // Clean up socket retry timeout
      if (socketRetryTimeoutRef.current) {
        clearTimeout(socketRetryTimeoutRef.current);
        socketRetryTimeoutRef.current = null;
      }
      
      // Clean up socket
      if (socketRef.current) {
        socketRef.current.offAny();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // Optimize the VideoMeetingPage render to prevent unnecessary updates
  return (
    <>
      {loading ? (
        <div className="loading-screen">
          <h2>Loading...</h2>
        </div>
      ) : !isAuthenticated ? (
        <div className="auth-error-screen">
          <Alert severity="error">
            You must be logged in to join this meeting.
          </Alert>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={() => navigate('/login')}
            sx={{ mt: 2 }}
          >
            Go to Login
          </Button>
        </div>
      ) : meetingAccessError ? (
        <div className="meeting-error-screen">
          <Alert severity="error">
            {meetingAccessError}
          </Alert>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={() => navigate('/home')}
            sx={{ mt: 2 }}
          >
            Return to Home
          </Button>
        </div>
      ) : askForUsername ? (
          <div className="modal">
            <div className="modal-box">
              <h1>Enter your username</h1>
              <TextField
                label="Username"
                variant="outlined"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <Button variant="contained" onClick={connect}>
                Connect
              </Button>
            </div>
          </div>
      ): (
        <div className='main-root-container'>
        {socketError && socketRetries >= MAX_SOCKET_RETRIES && (
          <div className="socket-error-banner">
            <Alert severity="error" onClose={() => setSocketError(null)}>
              Connection error: {socketError}. Please check your internet connection and try refreshing the page.
            </Alert>
          </div>
        )}
        <div className='video-meeting-page-container'>
            <div className="main-video-container">
              <div 
                className="local-video-container"
                ref={localVideoContainerRef}
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`local-video ${isScreenSharing ? 'screen-share' : ''}`}
                ></video>
              </div>
              <div 
                className="remote-video-container"
                ref={remoteVideoContainerRef}
              >
                {remoteParticipantIds.length === 0 ? (
                  <div className="no-remote-videos">
                    <p>No other participants</p>
                  </div>
                ) : (
                  // ============================================
                  // CRITICAL UI FIX: Smart stream readiness detection
                  // - Render VideoTile ONLY when stream has at least one track
                  // - Show "Connecting..." when waiting for any tracks
                  // - Show "Camera off" placeholder when audio-only (handled by VideoTile)
                  // ============================================
                  remoteParticipantIds.map((participantId) => {
                    // Get stream from ref (not from state)
                    const stream = remoteStreamsRef.current.get(participantId);
                    
                    // Stream readiness check:
                    // - Stream must exist
                    // - Stream must have at least ONE track (audio or video)
                    // VideoTile handles the case where video track is missing (shows avatar)
                    const isStreamReady = stream && stream.getTracks().length > 0;
                    
                    return (
                      <div key={participantId} className="video-tile-container">
                        {isStreamReady ? (
                          <VideoTile 
                            participantId={participantId}
                            stream={stream}
                            streamUpdateCounter={streamUpdateCounter}
                          />
                        ) : (
                          // Show connecting placeholder while waiting for ANY tracks
                          <div className="video-tile-wrapper connecting">
                            <div className="video-placeholder">
                              <span className="placeholder-icon">⏳</span>
                              <span className="placeholder-text">Connecting...</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            
            {/* Add className to toggle visibility on mobile */}
            <div className={`main-chat-container ${isChatVisible ? 'visible' : ''}`}>
              <div className="chat-header">
                <h2>In-Call Messages</h2>
              </div>
              <div className="chat-security-info">
                <p>Message can only be seen by people in the call and are deleted when the call ends</p>
              </div>
              <div className="chat-display" ref={chatDisplayRef}>
              {messages.map((msg, index) => {
                // Format timestamp
                const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                return (
                  <div key={index} className={`message ${msg.sender === username ? 'my-message' : 'other-message'}`}>
                    <div className="message-header">
                      <span className="message-sender">{msg.sender === username ? 'You' : msg.sender}</span>
                      <span className="message-time">{timestamp}</span>
                    </div>
                    <p className="message-content">{msg.data}</p>
                  </div>
                );
              })}
              </div>
              <div className="chat-input">
                <input 
                  type="text" 
                  placeholder="Type a message" 
                  className='outline-none text-white w-60'
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && message.trim() && sendMessage()}
                />
                <i 
                  className="fas fa-paper-plane cursor-pointer" 
                  onClick={() => message.trim() && sendMessage()}
                ></i>
              </div>
            </div>
            
            {/* Add mobile chat toggle button */}
            {isMobileView && (
              <div 
                className="chat-toggle-button" 
                onClick={toggleChatVisibility}
              >
                <ChatIcon />
                {newMessages > 0 && (
                  <span className="new-message-indicator">{newMessages}</span>
                )}
              </div>
            )}
            
            <div className="icon-container">
              <IconButton className='icon-button' onClick={handleVideo}>
                {
                  video ? <VideocamIcon fontSize="medium" /> : <VideocamOffIcon fontSize="medium" />
                }
              </IconButton>
              <IconButton className='icon-button' onClick={handleAudio}>
                {
                  audio ? <MicIcon fontSize="medium" /> : <MicOffIcon fontSize="medium" />
                }
              </IconButton>

              <IconButton className='icon-button' onClick={handleScreen}>
                {
                  isScreenSharing ? <CancelPresentationIcon fontSize="medium" /> : <PresentToAllIcon fontSize="medium" />
                }
              </IconButton >
              <IconButton className='icon-button call-end' onClick={handleEndCall}>
                <CallEndIcon fontSize="medium" />
              </IconButton>
              
              <RecordingControls 
                meetingId={actualMeetingId || ''} 
                isHost={isHost} 
                onRecordingStateChange={setIsRecording} 
              />
              
              {/* Only show chat button on larger screens */}
              {!isMobileView && (
                <IconButton className='icon-button' onClick={toggleChatVisibility}>
                  <ChatIcon fontSize="medium" />
                  {newMessages > 0 && (
                    <span className="new-message-indicator">{newMessages}</span>
                  )}
                </IconButton >
              )}
              
              <IconButton className='icon-button' onClick={() => participentModal ? closeParticipantModal() : setParticipentModal(true)}>
                <PeopleIcon fontSize="medium" />
              </IconButton>
              <IconButton className='icon-button'>
                <ThreeDotsIcon fontSize="medium" />
              </IconButton>
            </div>
        </div>
        {participentModal && (
          <div className={`main-participent-container ${isClosing ? 'closing' : ''}`}>
            <div className="participent-header">
              <h2 className='text-xl pl-1'>People</h2>
              <i className="fa-solid fa-xmark cursor-pointer" onClick={closeParticipantModal}></i>
            </div>
            <div className="add-people">
            <i className="fa-solid fa-user-plus"></i>
            <p>Add People</p>
            </div>
            <p className='pl-8 text-white mt-7 opacity-80 text-xs'>IN THE MEETING</p>
            <div className="people-in-meeting">
              <div className="people-header">
                <p>Contributor</p>
                <p>{participantIds.length + 1}</p> {/* +1 to include local user */}
                <i className="fa-solid fa-angle-up"></i>
                <i className="fa-solid fa-angle-down"></i>
              </div>
              <div className="people-list">
                {/* Always show local user */}
                <div className="people py-3 flex items-center text-white">
                  <div className="people-avatar">
                    <h2>{username[0]?.toUpperCase() || 'U'}</h2>
                  </div>
                  <p className='text-white font-medium ml-4 mr-16'>{username || 'You'} (You)</p>
                  <div className="three-dots flex items-center justify-center">
                    <i className="fa-solid fa-ellipsis-vertical"></i>
                  </div>
                </div>
                
                {/* Map remote participants from Redux */}
                {participantIds.map((participantId, index) => {
                  const participant = participantsById[participantId];
                  return (
                    <div key={participantId} className="people py-3 flex items-center text-white">
                      <div className="people-avatar">
                        <h2>{participant?.name?.[0]?.toUpperCase() || 'P'}</h2>
                      </div>
                      <p className='text-white font-medium ml-4 mr-16'>{participant?.name || `Participant ${index + 1}`}</p>
                      <div className="three-dots flex items-center justify-center">
                        <i className="fa-solid fa-ellipsis-vertical"></i>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </>
  )
}

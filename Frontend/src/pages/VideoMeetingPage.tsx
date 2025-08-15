import { useState, useRef, useEffect, useContext, useCallback } from 'react'
import '../styles/VideoMeetingPage.css'
// Update import to use TypeScript version
import { updateVideoLayout, markAsScreenShare, updateLocalVideoPosition } from "../scripts/videoLayoutManager";
import { UserContext } from '../contexts/userContext'
import { useAuthCheck, validateMeetingAccess } from '../utils/AuthUtils'

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
import io from 'socket.io-client';
import { Socket } from "socket.io-client";
import FlipCameraAndroidIcon from '@mui/icons-material/FlipCameraAndroid';
import axios from 'axios';

// Define types for your WebRTC connections
type ConnectionsType = {
  [key: string]: RTCPeerConnection;
};

// Define type for video streams
interface VideoStream {
  socketId: string;
  stream: MediaStream;
  autoPlay: boolean;
  playsInline: boolean;
  isScreenShare?: boolean;
}

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
  
  const [participentModal, setParticipentModal] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [videoAvailable, setVideoAvailable] = useState<boolean>(true);
  const [audioAvailable, setAudioAvailable] = useState<boolean>(true);
  const [video, setVideo] = useState<boolean>(false);
  const [audio, setAudio] = useState<boolean>(false);
    // Using isScreenSharing instead of screen
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false); // Added to track actual screen sharing state
  const [messages, setMessages] = useState<{data: string, sender: string}[]>([]);
  const [message, setMessage] = useState<string>("");
  const [newMessages, setNewMessages] = useState<number>(0);
  const [askForUsername, setAskForUsername] = useState<boolean>(true);
  const [username, setUsername] = useState<string>("");
  const [videos, setVideos] = useState<VideoStream[]>([]);
  const [localStreamReady, setLocalStreamReady] = useState<boolean>(false);
  const pendingConnectionsRef = useRef<string[]>([]);
  const connectionsRef = useRef<ConnectionsType>(connectionsStore);

  const [isMirrored, setIsMirrored] = useState(true);
  
  // Add ref to track if video state was updated
  const videoUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastVideoUpdateRef = useRef<number>(0);
  
  // Add missing refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const socketIdRef = useRef<string>("");
  
  // Create connections object
  const connections: ConnectionsType = {};

  // Add a ref for the chat display container
  const chatDisplayRef = useRef<HTMLDivElement>(null);

  // Add ref for remote video container
  const remoteVideoContainerRef = useRef<HTMLDivElement>(null);
  const localVideoContainerRef = useRef<HTMLDivElement>(null);

  // Add these state variables to the component
  const [connectionRetryCount, setConnectionRetryCount] = useState<{[key: string]: number}>({});
  const streamReadyRef = useRef<boolean>(false);

  // Add these new state variables near the other state declarations
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [socketRetries, setSocketRetries] = useState<number>(0);
  const MAX_SOCKET_RETRIES = 3;
  const socketRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add state for chat visibility on mobile
  const [isChatVisible, setIsChatVisible] = useState<boolean>(false);
  const [isHost] = useState<boolean>(false); // Not using setIsHost
  const [isRecording, setIsRecording] = useState<boolean>(false);

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
  const getPermissions = async () => {
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
        pendingConnections.forEach(clientId => {
          createConnectionForClient(clientId, true);
        });
      }, 500);
    }
  } catch (err) {
    console.error("Error getting media permissions:", err);
    if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      setVideoAvailable(false);
      setAudioAvailable(false);
    }
    
    // Even with no devices, we should create a black/silent stream
    console.log("Creating fallback black/silent stream");
    const BlackSilence = (...args: Array<{width?: number, height?: number}>) =>
      new MediaStream([silence(), black(...args[0])]);
    window.localStream = BlackSilence();
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = window.localStream;
    }
    setLocalStreamReady(true);
  }
}; 

  // Create a helper function to set up a connection with proper error handling
  const createConnectionForClient = (clientId: string, createOffer = false) => {
    if (clientId === socketRef.current?.id) return;
    
    console.log("Creating/updating connection for:", clientId);
    
    // Check if stream is ready using both state and ref for reliability
    if (!window.localStream || !streamReadyRef.current) {
      console.warn("Local stream not ready, queueing connection for:", clientId);
      if (!pendingConnectionsRef.current.includes(clientId)) {
        pendingConnectionsRef.current.push(clientId);
      }
      return;
    }
    
    // Create new RTCPeerConnection if it doesn't exist
    if (!connectionsRef.current[clientId]) {
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
              
              // Increment retry count
              setConnectionRetryCount(prev => ({
                ...prev,
                [clientId]: retryCount + 1
              }));
              
              // Create a new connection
              createConnectionForClient(clientId, true);
            }, 1000);
          } else {
            console.log(`Maximum retry attempts reached for ${clientId}`);
          }
        }
      };
      
      // Handle remote stream with debounced updates
      connectionsRef.current[clientId].ontrack = (event) => {
        console.log("Received track from:", clientId, event.streams[0]);
        
        // Use the first stream
        const remoteStream = event.streams[0];
        if (!remoteStream) return;
        
        // Use time-based debouncing for video updates
        const now = Date.now();
        if (now - lastVideoUpdateRef.current < 300) {
          // If we recently updated videos, debounce this update
          if (videoUpdateTimeoutRef.current) {
            clearTimeout(videoUpdateTimeoutRef.current);
          }
          
          videoUpdateTimeoutRef.current = setTimeout(() => {
            addRemoteStream(clientId, remoteStream);
            lastVideoUpdateRef.current = Date.now();
          }, 300);
        } else {
          // It's been a while since last update, do it immediately
          addRemoteStream(clientId, remoteStream);
          lastVideoUpdateRef.current = now;
        }
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
              socketRef.current.emit(
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
  };

  // Helper function to add remote stream with proper state management
  const addRemoteStream = (clientId: string, remoteStream: MediaStream) => {
    console.log("Adding/updating remote stream for client:", clientId);
    
    setVideos((prevVideos) => {
      // Check if we already have this client's video
      const existingIndex = prevVideos.findIndex(v => v.socketId === clientId);
      
      if (existingIndex >= 0) {
        // Update existing video stream if needed
        const currentVideo = prevVideos[existingIndex];
        
        // Check if the stream is different before updating
        if (currentVideo.stream !== remoteStream) {
          const updatedVideos = [...prevVideos];
          updatedVideos[existingIndex] = {
            ...currentVideo,
            stream: remoteStream
          };
          return updatedVideos;
        }
        return prevVideos; // No change needed
      } else {
        // Add new video
        return [
          ...prevVideos,
          {
            socketId: clientId,
            stream: remoteStream,
            autoPlay: true,
            playsInline: true,
          },
        ];
      }
    });
  };

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

    for (let peerId in connectionsRef.current) {
      if (peerId === socketRef.current.id) {
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
            socketRef.current.emit(
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
          const BlackSilence = (...args: Array<{width?: number, height?: number}>) =>
            new MediaStream([silence(), black(...args[0])]);
          window.localStream = BlackSilence();
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = window.localStream;
          }
          for (const peerId in connectionsRef.current) {
            if (peerId === socketRef.current.id) {
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
                  socketRef.current.emit(
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

  const getUserMedia = () => {
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
        })
        .catch((err) => {
          console.log(err);
        });
    } else {
      try {
        if (localVideoRef.current && localVideoRef.current.srcObject) {
          const stream = localVideoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach((track) => track.stop());
        }
      } catch (err) {
        console.log(err);
      }
    }
  };

  const gotMessageFromServer = (fromId: string, message: string) => {
    const signal = JSON.parse(message);
    if (fromId !== socketIdRef.current) {
      // Make sure connection exists
      if (!connectionsRef.current[fromId]) {
        createConnectionForClient(fromId, false);
      }
      
      if (signal.sdp) {
        connectionsRef.current[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            if (signal.sdp.type === "offer") {
              connectionsRef.current[fromId]
                .createAnswer()
                .then((description) => {
                  connectionsRef.current[fromId]
                    .setLocalDescription(description)
                    .then(() => {
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
                    .catch((e) => console.log(e));
                })
                .catch((e) => console.log(e));
            }
          })
          .catch((e) => console.log(e));
      }

      if (signal.ice) {
        connectionsRef.current[fromId]
          .addIceCandidate(new RTCIceCandidate(signal.ice))
          .catch((e) => console.log(e));
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

  // Update layout whenever videos array changes or screen sharing state changes
  useEffect(() => {
    if (remoteVideoContainerRef.current) {
      updateVideoLayout(remoteVideoContainerRef.current, videos.length, isScreenSharing);
    }
    
    if (localVideoContainerRef.current) {
      updateLocalVideoPosition(localVideoContainerRef.current, videos.length, isScreenSharing);
    }
  }, [videos.length, isScreenSharing]);

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
        updateVideoLayout(remoteVideoContainerRef.current, videos.length, isScreenSharing);
      }
      
      if (localVideoContainerRef.current) {
        updateLocalVideoPosition(localVideoContainerRef.current, videos.length, isScreenSharing);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [videos.length, isScreenSharing, isChatVisible]);

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
        console.log("Connected to socket server with ID:", socketRef.current.id);
        setSocketConnected(true);
        setSocketRetries(0); // Reset retry counter on successful connection
        socketIdRef.current = socketRef.current.id;
        
        // Join call room after successful connection
        socketRef.current.emit("join-call", window.location.href);
        
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
      
      setVideos((prevVideos) => prevVideos.filter((video) => video.socketId !== id));
    });
    
    socketRef.current.on("user-joined", (userId: string, clients: string[]) => {
      console.log("User joined:", userId, "Current clients:", clients);
      
      if (!clients || !Array.isArray(clients)) {
        console.error("Invalid clients data received:", clients);
        return;
      }
      
      // Create connections for all clients except self
      clients.forEach((clientId) => {
        if (clientId !== socketRef.current.id) {
          createConnectionForClient(clientId);
        }
      });
      
      // If we're the new user, initiate offers to all existing users
      if (userId === socketRef.current.id && streamReadyRef.current) {
        console.log("I'm the new user, initiating connections");
        clients.forEach((clientId) => {
          if (clientId === socketRef.current.id) return;
          
          // Create connections with offers if local stream is ready
          if (window.localStream && streamReadyRef.current) {
            createConnectionForClient(clientId, true);
          } else {
            console.warn("Local stream not ready, postponing offer creation for:", clientId);
            if (!pendingConnectionsRef.current.includes(clientId)) {
              pendingConnectionsRef.current.push(clientId);
            }
          }
        });
      }
    });
  };

  // Update the getMedia function to handle socket errors
  const getMedia = useCallback(async () => {
    try {
      setVideo(videoAvailable);
      setAudio(audioAvailable);
      await getUserMedia();  // Wait for getUserMedia to complete
      
      // Wait a bit to ensure the stream is fully initialized before connecting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Make sure component is still mounted before connecting
      if (streamReadyRef.current) {
        connectToSocketServer(); // Connect to socket server after media is ready
      }
    } catch (err) {
      console.error("Error in getMedia:", err);
      // Fall back to a black/silent stream if there's an error
      const BlackSilence = (...args: Array<{width?: number, height?: number}>) => new MediaStream([silence(), black(...args[0])]);
      window.localStream = BlackSilence();
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = window.localStream;
      }
      streamReadyRef.current = true;
      setLocalStreamReady(true);
      connectToSocketServer();
    }
  }, [videoAvailable, audioAvailable, connectToSocketServer, streamReadyRef, localVideoRef, setLocalStreamReady, silence, black]);

  const connect = () => {
    if (username !== "") {
      setAskForUsername(false);
      getMedia();
    }
  };

  const handleVideo = () => {
    // Toggle state for UI
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
    // Toggle state for UI
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

    // Update screen sharing state
    setIsScreenSharing(true);

    for(const peerId in connectionsRef.current){
      if(peerId === socketRef.current.id){
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
            socketRef.current.emit("signal", peerId, JSON.stringify({sdp: connectionsRef.current[peerId].localDescription}));
          }).catch(err => console.error("Error: ", err));
        }).catch(err => console.error("Error: ", err));
      } catch (e) {
        console.error("Error updating tracks for peer:", peerId, e);
      }
    }
    
    stream.getTracks().forEach(track => track.onended = () => {
      setScreen(false);
      setIsScreenSharing(false); // Update screen sharing state when ended
      
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
      let BlackSilence = (...args: Array<{width?: number, height?: number}>) => new MediaStream([silence(), black(...args[0])]);
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
          setIsScreenSharing(false);
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
            setIsScreenSharing(false);
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
        setIsScreenSharing(false);
        setScreen(false);
      }
      
      // Stop local video/audio tracks and clear references
      if (window.localStream) {
        console.log("Stopping local stream tracks...");
        stopMediaStream(window.localStream);
        window.localStream = null as unknown; // Clear reference
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
      Object.entries(connections).forEach(([id, connection]) => {
        if (connection) {
          // Remove all event listeners
          connection.onicecandidate = null;
          // onaddstream and onremovestream are deprecated
          // Instead, we should be using track events, but we're just cleaning up here
          connection.oniceconnectionstatechange = null;
          
          // Close the connection
          connection.close();
          delete connections[id]; // Remove reference
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
      setIsScreenSharing(false);
      setVideos([]); // Clear videos array
      
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
      Object.values(connections).forEach((connection) => {
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
        window.localStream = null as unknown;
      }
      
      // Clean up socket
      if (socketRef.current) {
        socketRef.current.offAny();
        socketRef.current.disconnect();
      }
    };
  }, [connections, getPermissions]);

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
        pendingConnections.forEach(clientId => {
          createConnectionForClient(clientId, true);
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
                className="local-video-container relative"
                ref={localVideoContainerRef}
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`local-video ${isScreenSharing ? 'screen-share' : ''} ${isMirrored ? 'scale-x-[-1]' : ''}`}
                ></video>

                {/* Flip Camera button - bottom-left overlay */}
                <button
                  onClick={() => setIsMirrored(!isMirrored)}
                  className="absolute bottom-2 left-2 bg-gray-800 bg-opacity-50 text-white px-2.5 py-2 rounded-full 
                  hover:bg-opacity-70 transition border border-white/30 shadow-lg"
                  title={isMirrored ? "Unflip Camera" : "Flip Camera"}
                >
                  <FlipCameraAndroidIcon fontSize="small" className="mb-1"/>
                </button>
              </div>
              <div 
                className="remote-video-container"
                ref={remoteVideoContainerRef}
              >
                {videos.length === 0 ? (
                  <div className="no-remote-videos">
                    <p>No other participants</p>
                  </div>
                ) : (
                  videos.map((video) => (
                    <video
                      key={video.socketId}
                      data-socket-id={video.socketId}
                      ref={(ref) => {
                        if (ref && video.stream && ref.srcObject !== video.stream) {
                          ref.srcObject = video.stream;
                        }}}
                      autoPlay
                      playsInline
                      className={`remote-video ${video.isScreenShare ? 'screen-share' : ''}`}
                    ></video>
                  ))
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
            {window.innerWidth <= 768 && (
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
              {window.innerWidth > 768 && (
                <IconButton className='icon-button' onClick={() => participentModal ? closeParticipantModal() : setParticipentModal(true)}>
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
                <p>{videos.length + 1}</p> {/* +1 to include local user */}
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
                
                {/* Map remote participants */}
                {videos.map((video, index) => (
                  <div key={video.socketId} className="people py-3 flex items-center text-white">
                    <div className="people-avatar">
                      <h2>P</h2>
                    </div>
                    <p className='text-white font-medium ml-4 mr-16'>Participant {index + 1}</p>
                    <div className="three-dots flex items-center justify-center">
                      <i className="fa-solid fa-ellipsis-vertical"></i>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </>
  )
}

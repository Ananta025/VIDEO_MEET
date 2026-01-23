import { useState, useEffect, useRef } from 'react';
import { 
  IconButton, 
  Tooltip, 
  Badge, 
  CircularProgress, 
  Menu, 
  MenuItem, 
  ListItemIcon, 
  ListItemText,
  Snackbar,
  Alert
} from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';
import DescriptionIcon from '@mui/icons-material/Description';
import DownloadIcon from '@mui/icons-material/Download';
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import axios from 'axios';
import { RecordingControlsProps, RecordingNotification } from '@/types';

const RecordingControls = ({ meetingId, isHost, onRecordingStateChange }: RecordingControlsProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [hasTranscript, setHasTranscript] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [isGeneratingTranscript, setIsGeneratingTranscript] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [notification, setNotification] = useState<RecordingNotification>({ open: false, message: '', severity: 'info' });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<Date | null>(null);

  // Carefully managed context references
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const checkTranscript = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const response = await axios.get(
          `${import.meta.env.VITE_BASE_URL}/meetings/${meetingId}/transcript`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.data.success) setHasTranscript(true);
      } catch {
        setHasTranscript(false);
      }
    };
    if (meetingId) checkTranscript();
  }, [meetingId]);

  useEffect(() => {
    return () => {
      stopRecording();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      if (isRecording) return; // Prevent double-recording

      // 1. Audio: Combine all audio tracks into a single stream using AudioContext.
      const localStream = (window as any).localStream as MediaStream;
      if (!localStream) {
        console.error('No local stream available');
        return;
      }
      const audioTracks: MediaStreamTrack[] = [];
      const localAudioTrack = localStream.getAudioTracks()[0];
      if (localAudioTrack) audioTracks.push(localAudioTrack);

      const remoteVideoElements = document.querySelectorAll('video:not(#localVideo)');
      remoteVideoElements.forEach(videoEl => {
        const stream = (videoEl as HTMLVideoElement).srcObject as MediaStream;
        if (stream) {
          const track = stream.getAudioTracks()[0];
          if (track) audioTracks.push(track);
        }
      });

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();

      audioTracks.forEach(track => {
        try {
          const src = audioContext.createMediaStreamSource(new MediaStream([track]));
          src.connect(destination);
        } catch (e) {
          // Some browsers can only connect once per track (ignore repeat)
        }
      });

      // 2. Video: Setup a Canvas, and draw a grid of local and remote videos (2x2, with safety guards).
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
      let width = 640, height = 480;
      if (localVideo && localVideo.readyState >= 2) {
        width = localVideo.videoWidth || 640;
        height = localVideo.videoHeight || 480;
      }
      canvas.width = width;
      canvas.height = height;

      // Drawing function
      const drawVideoToCanvas = () => {
        if (!ctx) return;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Always check that the video is ready
        let videoIndex = 0;
        // Draw local video top-left
        if (localVideo && localVideo.readyState >= 2 && localVideo.srcObject) {
          ctx.drawImage(localVideo, 0, 0, canvas.width / 2, canvas.height / 2);
          videoIndex = 1;
        }
        // Draw up to 3 remote videos
        let pos = 0;
        remoteVideoElements.forEach((videoEl) => {
          const v = videoEl as HTMLVideoElement;
          if (v.srcObject && v.readyState >= 2) {
            let x = (pos % 2) * (canvas.width / 2);
            let y = Math.floor(pos / 2) * (canvas.height / 2);
            // If local video is placed at top-left, next fill in the grid
            if (videoIndex > 0) {
              // positions: [top-right, bottom-left, bottom-right]
              if (pos === 0) x = canvas.width / 2, y = 0;
              else if (pos === 1) x = 0, y = canvas.height / 2;
              else x = canvas.width / 2, y = canvas.height / 2;
            }
            ctx.drawImage(v, x, y, canvas.width / 2, canvas.height / 2);
            pos++;
            if (pos >= 3) return; // Only fit three remotes in grid with local
          }
        });
        requestAnimationFrame(drawVideoToCanvas);
      };
      drawVideoToCanvas();

      // 3. MediaStream from canvas (video) + audio destination
      const canvasStream = canvas.captureStream(30); // 30 FPS
      destination.stream.getAudioTracks().forEach((track) => {
        canvasStream.addTrack(track);
      });

      // 4. MediaRecorder set up
      const options = { mimeType: 'video/webm;codecs=vp9,opus' };
      const mediaRecorder = new MediaRecorder(canvasStream, options);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };

      mediaRecorder.start(1000); // 1-second chunks for upload
      setIsRecording(true);
      recordingStartTimeRef.current = new Date();
      setRecordingTime(0);
      timerIntervalRef.current && clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      onRecordingStateChange?.(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Error starting recording. See console for details.');
    }
  };

  const stopRecording = async () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setIsRecording(false);
      onRecordingStateChange?.(false);
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
      await uploadRecording();
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  };

  const uploadRecording = async () => {
    if (recordedChunksRef.current.length === 0) {
      console.log('No recorded data available');
      return;
    }
    try {
      setIsUploading(true);
      const recordingBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const formData = new FormData();
      formData.append('recording', recordingBlob, `recording_${meetingId}.webm`);
      if (recordingStartTimeRef.current) {
        formData.append('recordingStartTime', recordingStartTimeRef.current.toISOString());
      }
      formData.append('recordingEndTime', new Date().toISOString());

      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication token not found');
      const response = await axios.post(
        `${import.meta.env.VITE_BASE_URL}/meetings/${meetingId}/recording`,
        formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setHasRecording(true);
        setNotification({
          open: true,
          message: 'Recording uploaded successfully!',
          severity: 'success'
        });
        await generateTranscript();
      }
    } catch (error) {
      console.error('Error uploading recording:', error);
      setNotification({
        open: true,
        message: 'Failed to upload recording',
        severity: 'error'
      });
    } finally {
      setIsUploading(false);
      recordedChunksRef.current = [];
    }
  };

  const generateTranscript = async () => {
    try {
      setIsGeneratingTranscript(true);
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication token not found');
      const response = await axios.post(
        `${import.meta.env.VITE_BASE_URL}/meetings/${meetingId}/transcript`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setHasTranscript(true);
        setNotification({
          open: true,
          message: 'Transcript generated successfully!',
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('Error generating transcript:', error);
      setNotification({
        open: true,
        message: 'Failed to generate transcript',
        severity: 'error'
      });
    } finally {
      setIsGeneratingTranscript(false);
    }
  };

  const handleDownloadRecording = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_BASE_URL}/meetings/${meetingId}/recording/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `meeting_${meetingId}_recording.webm`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading recording:', error);
      setNotification({
        open: true,
        message: 'Failed to download recording',
        severity: 'error'
      });
    }
  };

  const handleDownloadTranscript = async (format: 'txt' | 'vtt' = 'txt') => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_BASE_URL}/meetings/${meetingId}/transcript/download?format=${format}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `meeting_${meetingId}_transcript.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading transcript:', error);
      setNotification({
        open: true,
        message: 'Failed to download transcript',
        severity: 'error'
      });
    }
  };

  const viewTranscript = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication token not found');
      const response = await axios.get(
        `${import.meta.env.VITE_BASE_URL}/meetings/${meetingId}/transcript`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        const transcriptText = response.data.data.transcriptText;
        const transcriptWindow = window.open('', '_blank');
        if (transcriptWindow) {
          transcriptWindow.document.write(`
            <html>
              <head>
                <title>Meeting Transcript</title>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
                  h1 { color: #333; }
                  .transcript { white-space: pre-wrap; background: #f5f5f5; padding: 15px; border-radius: 5px; }
                </style>
              </head>
              <body>
                <h1>Meeting Transcript</h1>
                <div class="transcript">${transcriptText}</div>
              </body>
            </html>
          `);
        }
      }
    } catch (error) {
      console.error('Error viewing transcript:', error);
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  return (
    <>
      <div className="recording-controls">
        {isHost && (
          !isRecording ? (
            <Tooltip title="Start Recording">
              <IconButton onClick={startRecording} color="primary" disabled={isUploading}>
                <FiberManualRecordIcon style={{ color: '#ff0000' }} />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Stop Recording">
              <IconButton onClick={stopRecording} color="primary" disabled={isUploading}>
                <Badge
                  badgeContent={formatTime(recordingTime)}
                  color="error"
                  overlap="rectangular"
                  anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                >
                  <StopIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          )
        )}
        
        {isUploading && (
          <Tooltip title="Uploading recording...">
            <CircularProgress size={24} style={{ marginLeft: 8 }} />
          </Tooltip>
        )}
        
        {isGeneratingTranscript && (
          <Tooltip title="Generating transcript...">
            <CircularProgress size={24} style={{ marginLeft: 8 }} />
          </Tooltip>
        )}
        
        {/* Recording and Transcript Actions Menu */}
        {(hasRecording || hasTranscript) && (
          <>
            <Tooltip title="Recording & Transcript Options">
              <IconButton onClick={handleMenuClick} color="primary">
                <PlayArrowIcon />
              </IconButton>
            </Tooltip>
            
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={handleMenuClose}
            >
              {hasRecording && (
                <MenuItem onClick={() => { handleDownloadRecording(); handleMenuClose(); }}>
                  <ListItemIcon>
                    <DownloadIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Download Recording</ListItemText>
                </MenuItem>
              )}
              
              {hasTranscript && [
                <MenuItem key="view" onClick={() => { viewTranscript(); handleMenuClose(); }}>
                  <ListItemIcon>
                    <DescriptionIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>View Transcript</ListItemText>
                </MenuItem>,
                
                <MenuItem key="txt" onClick={() => { handleDownloadTranscript('txt'); handleMenuClose(); }}>
                  <ListItemIcon>
                    <DownloadIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Download Transcript (TXT)</ListItemText>
                </MenuItem>,
                
                <MenuItem key="vtt" onClick={() => { handleDownloadTranscript('vtt'); handleMenuClose(); }}>
                  <ListItemIcon>
                    <SubtitlesIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Download Subtitles (VTT)</ListItemText>
                </MenuItem>
              ]}
            </Menu>
          </>
        )}
      </div>
      
      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert
          onClose={() => setNotification({ ...notification, open: false })}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default RecordingControls;

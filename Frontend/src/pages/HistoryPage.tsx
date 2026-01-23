import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Grid,
  Box,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Download as DownloadIcon,
  Description as TranscriptIcon,
  VideoCall as VideoIcon,
  AccessTime as TimeIcon,
  People as PeopleIcon,
  Subtitles as SubtitlesIcon
} from '@mui/icons-material';
import axios from 'axios';
import { UserContext } from '../contexts/userContext';
import { useAuthCheck } from '../utils/AuthUtils';
import Navbar from '../components/Navbar';
import { Meeting, PaginationInfo } from '@/types';

const HistoryPage = () => {
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const { isAuthenticated, loading: authLoading } = useAuthCheck();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalMeetings: 0,
    hasNext: false,
    hasPrev: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [transcriptDialog, setTranscriptDialog] = useState<{
    open: boolean;
    meeting: Meeting | null;
  }>({ open: false, meeting: null });

  const fetchMeetings = async (page = 1, status = '') => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });

      if (status) {
        params.append('status', status);
      }

      const response = await axios.get(
        `${import.meta.env.VITE_BASE_URL}/meetings/history?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setMeetings(response.data.data.meetings);
        setPagination(response.data.data.pagination);
        setError(null);
      }
    } catch (err: any) {
      console.error('Error fetching meetings:', err);
      setError(err.response?.data?.message || 'Failed to fetch meetings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchMeetings();
    } else if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, navigate]);

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    fetchMeetings(page, statusFilter);
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    fetchMeetings(1, status);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (meeting: Meeting) => {
    // Use server-calculated duration if available
    if (meeting.duration && meeting.duration > 0) {
      const minutes = Math.floor(meeting.duration / (1000 * 60));
      const hours = Math.floor(minutes / 60);
      
      if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
      }
      return `${minutes}m`;
    }
    
    // Fallback to calculating from times
    const start = new Date(meeting.startTime);
    const end = new Date(meeting.endTime);
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'ongoing':
        return 'warning';
      case 'scheduled':
        return 'info';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const handleDownloadRecording = async (meetingId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_BASE_URL}/meetings/${meetingId}/recording/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          },
          responseType: 'blob'
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `meeting_${meetingId}_recording.webm`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading recording:', err);
      setError('Failed to download recording');
    }
  };

  const handleDownloadTranscript = async (meetingId: string, format: 'txt' | 'vtt' = 'txt') => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_BASE_URL}/meetings/${meetingId}/transcript/download?format=${format}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          },
          responseType: 'blob'
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `meeting_${meetingId}_transcript.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading transcript:', err);
      setError('Failed to download transcript');
    }
  };

  const handleViewTranscript = (meeting: Meeting) => {
    setTranscriptDialog({ open: true, meeting });
  };

  const closeTranscriptDialog = () => {
    setTranscriptDialog({ open: false, meeting: null });
  };

  if (authLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Meeting History
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Filters */}
        <Box sx={{ mb: 3 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Filter by Status</InputLabel>
            <Select
              value={statusFilter}
              label="Filter by Status"
              onChange={(e) => handleStatusFilterChange(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="ongoing">Ongoing</MenuItem>
              <MenuItem value="scheduled">Scheduled</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : meetings.length === 0 ? (
          <Box textAlign="center" py={4}>
            <VideoIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No meetings found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {statusFilter ? `No ${statusFilter} meetings found.` : 'You haven\'t participated in any meetings yet.'}
            </Typography>
          </Box>
        ) : (
          <>
            <Grid container spacing={3}>
              {meetings.map((meeting) => (
                <Grid item xs={12} key={meeting.meetingId || meeting._id}>
                  <Card>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                        <Typography variant="h6" component="h2">
                          {meeting.title}
                        </Typography>
                        <Chip
                          label={meeting.status.toUpperCase()}
                          color={getStatusColor(meeting.status) as any}
                          size="small"
                        />
                      </Box>

                      {meeting.description && (
                        <Typography variant="body2" color="text.secondary" paragraph>
                          {meeting.description}
                        </Typography>
                      )}

                      <Box display="flex" flexWrap="wrap" gap={2} mb={2}>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <TimeIcon fontSize="small" color="action" />
                          <Typography variant="body2">
                            {formatDate(meeting.startTime)}
                          </Typography>
                        </Box>

                        {meeting.status === 'completed' && (
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <TimeIcon fontSize="small" color="action" />
                            <Typography variant="body2">
                              Duration: {formatDuration(meeting)}
                            </Typography>
                          </Box>
                        )}

                        <Box display="flex" alignItems="center" gap={0.5}>
                          <PeopleIcon fontSize="small" color="action" />
                          <Typography variant="body2">
                            {meeting.participants.length + 1} participants
                          </Typography>
                        </Box>

                        <Typography variant="body2" color="text.secondary">
                          Host: {meeting.hostId._id === user?._id ? 'You' : meeting.hostId.name}
                        </Typography>
                      </Box>

                      {/* Recording and Transcript Info */}
                      {(meeting.recording?.isRecorded || meeting.transcript?.isGenerated) && (
                        <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, mb: 2 }}>
                          {meeting.recording?.isRecorded && (
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                              <PlayIcon fontSize="small" color="primary" />
                              <Typography variant="body2">
                                Recording available ({formatFileSize(meeting.recording.recordingSize)})
                              </Typography>
                            </Box>
                          )}
                          {meeting.transcript?.isGenerated && (
                            <Box display="flex" alignItems="center" gap={1}>
                              <TranscriptIcon fontSize="small" color="primary" />
                              <Typography variant="body2">
                                Transcript available
                                {meeting.transcript.duration && ` (${Math.round(meeting.transcript.duration / 60)} min)`}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      )}
                    </CardContent>

                    <CardActions>
                      {meeting.recording?.isRecorded && (
                        <Tooltip title="Download Recording">
                          <IconButton
                            onClick={() => handleDownloadRecording(meeting.meetingId)}
                            color="primary"
                          >
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                      )}

                      {meeting.transcript?.isGenerated && (
                        <>
                          <Tooltip title="View Transcript">
                            <IconButton
                              onClick={() => handleViewTranscript(meeting)}
                              color="primary"
                            >
                              <TranscriptIcon />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Download Transcript (TXT)">
                            <Button
                              size="small"
                              onClick={() => handleDownloadTranscript(meeting.meetingId, 'txt')}
                            >
                              TXT
                            </Button>
                          </Tooltip>

                          {meeting.transcript.vttUrl && (
                            <Tooltip title="Download Subtitles (VTT)">
                              <Button
                                size="small"
                                onClick={() => handleDownloadTranscript(meeting.meetingId, 'vtt')}
                                startIcon={<SubtitlesIcon />}
                              >
                                VTT
                              </Button>
                            </Tooltip>
                          )}
                        </>
                      )}
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <Box display="flex" justifyContent="center" mt={4}>
                <Pagination
                  count={pagination.totalPages}
                  page={pagination.currentPage}
                  onChange={handlePageChange}
                  color="primary"
                />
              </Box>
            )}
          </>
        )}

        {/* Transcript Dialog */}
        <Dialog
          open={transcriptDialog.open}
          onClose={closeTranscriptDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Meeting Transcript
            {transcriptDialog.meeting && (
              <Typography variant="subtitle2" color="text.secondary">
                {transcriptDialog.meeting.title}
              </Typography>
            )}
          </DialogTitle>
          <DialogContent>
            {transcriptDialog.meeting?.transcript?.transcriptText && (
              <Typography
                variant="body2"
                component="pre"
                sx={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  bgcolor: 'grey.50',
                  p: 2,
                  borderRadius: 1,
                  maxHeight: 400,
                  overflow: 'auto'
                }}
              >
                {transcriptDialog.meeting.transcript.transcriptText}
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeTranscriptDialog}>Close</Button>
            {transcriptDialog.meeting && (
              <>
                <Button
                  onClick={() => handleDownloadTranscript(transcriptDialog.meeting!.meetingId, 'txt')}
                  variant="outlined"
                >
                  Download TXT
                </Button>
                {transcriptDialog.meeting.transcript?.vttUrl && (
                  <Button
                    onClick={() => handleDownloadTranscript(transcriptDialog.meeting!.meetingId, 'vtt')}
                    variant="outlined"
                  >
                    Download VTT
                  </Button>
                )}
              </>
            )}
          </DialogActions>
        </Dialog>
      </Container>
    </div>
  );
};

export default HistoryPage;
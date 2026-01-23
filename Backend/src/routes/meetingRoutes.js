import { Router } from 'express';
import meetingControllers from '../controllers/meetingControllers.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();

// Set up multer for file uploads
const __filename = fileURLToPath(
    import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');
const recordingsDir = path.join(uploadsDir, 'recordings');

// Configure storage for recordings
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, recordingsDir);
    },
    filename: function(req, file, cb) {
        const meetingId = req.params.meetingId;
        const timestamp = Date.now();
        const fileExt = path.extname(file.originalname);
        cb(null, `recording_${meetingId}_${timestamp}${fileExt}`);
    }
});

// Create multer upload instance
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB limit
    },
    fileFilter: function(req, file, cb) {
        // Accept only webm and mp4 files
        if (file.mimetype === 'video/webm' || file.mimetype === 'video/mp4') {
            cb(null, true);
        } else {
            cb(new Error('Only .webm and .mp4 formats are allowed'), false);
        }
    }
});

// Ensure all meeting routes require authentication
router.use(authMiddleware.authenticateUser);

// ============================================
// CRITICAL: Static routes MUST come BEFORE parameterized routes
// Otherwise /history would be matched as /:meetingId with meetingId="history"
// ============================================

// User meetings history - MUST be first!
router.get('/history', meetingControllers.getUserMeetings);

// Additional meeting routes (static paths)
router.post('/create', meetingControllers.createMeeting);
router.post('/join', meetingControllers.joinMeeting);
router.post('/leave', meetingControllers.leaveMeeting);
router.post('/end', meetingControllers.endMeeting);

// ============================================
// Parameterized routes AFTER static routes
// ============================================

// Route to update meeting status
router.put("/:meetingId", meetingControllers.updateMeetingStatus);

// Route to get meeting details by ID
router.get("/:meetingId", meetingControllers.getMeetingDetails);
router.get('/:meetingId/details', meetingControllers.getMeetingDetails);

// Recording and transcript routes
router.post('/:meetingId/recording', upload.single('recording'), meetingControllers.uploadRecording);
router.post('/:meetingId/transcript', meetingControllers.generateTranscript);
router.get('/:meetingId/recording', meetingControllers.getRecording);
router.get('/:meetingId/transcript', meetingControllers.getTranscript);

// Download routes
router.get('/:meetingId/recording/download', meetingControllers.downloadRecording);
router.get('/:meetingId/transcript/download', meetingControllers.downloadTranscript);

export default router;
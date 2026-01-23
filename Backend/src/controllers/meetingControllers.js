import meetingModel from '../models/meetingModel.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import transcriptionService from '../services/transcriptionService.js';

// Set up directories for uploads
const __filename = fileURLToPath(
    import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');
const recordingsDir = path.join(uploadsDir, 'recordings');
const transcriptsDir = path.join(uploadsDir, 'transcripts');

// Create directories if they don't exist
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
}
if (!fs.existsSync(transcriptsDir)) {
    fs.mkdirSync(transcriptsDir, { recursive: true });
}

/**
 * Helper function to find a meeting by its public meetingId string.
 * This prevents CastError by never querying _id with non-ObjectId strings.
 * 
 * @param {string} meetingId - The public meeting ID (e.g., "meeting-f52oxj4")
 * @returns {Promise<Document|null>} The meeting document or null
 */
const findMeetingByMeetingId = async (meetingId) => {
    if (!meetingId) return null;
    
    // Query by the meetingId field (string), NOT by _id (ObjectId)
    return meetingModel.findOne({ meetingId });
};

/**
 * Helper function to find or create a meeting by meetingId.
 * Implements "create-on-first-access" pattern to eliminate race conditions.
 * 
 * @param {string} meetingId - The public meeting ID (e.g., "meeting-f52oxj4")
 * @param {string|null} hostId - Optional host user ID
 * @returns {Promise<{meeting: Document, created: boolean}>}
 */
const findOrCreateMeeting = async (meetingId, hostId = null) => {
    if (!meetingId) return { meeting: null, created: false };
    
    // First, try to find existing meeting
    let meeting = await meetingModel.findOne({ meetingId });
    
    if (meeting) {
        return { meeting, created: false };
    }
    
    // Meeting doesn't exist - create it on-demand
    // This eliminates the race condition where frontend navigates before DB write
    try {
        meeting = await meetingModel.create({
            meetingId,
            title: `Meeting ${new Date().toLocaleString()}`,
            startTime: new Date(),
            endTime: new Date(Date.now() + 3600000), // 1 hour default
            hostId: hostId, // May be null initially
            meetingLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/meeting/${meetingId}`,
            status: 'ongoing'
        });
        
        console.log(`Created meeting on-demand: ${meetingId}`);
        return { meeting, created: true };
    } catch (createErr) {
        // Handle race condition where another request created it first
        if (createErr.code === 11000) { // Duplicate key error
            meeting = await meetingModel.findOne({ meetingId });
            return { meeting, created: false };
        }
        throw createErr;
    }
};

const updateMeetingStatus = async(req, res) => {
    try {
        const { meetingId } = req.params;
        const { status, endTime } = req.body;

        if (!meetingId) {
            return res.status(400).json({
                success: false,
                message: 'Meeting ID is required'
            });
        }

        // Find and update the meeting by meetingId string field
        const updatedMeeting = await meetingModel.findOneAndUpdate(
            { meetingId }, // Query by meetingId string, NOT _id
            {
                status,
                endTime,
                updatedAt: new Date()
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!updatedMeeting) {
            console.log(`Meeting not found with meetingId:`, meetingId);
            return res.status(404).json({
                success: false,
                message: 'Meeting not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Meeting status updated successfully',
            data: updatedMeeting
        });
    } catch (err) {
        console.error('Error updating meeting status:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Create a new meeting
const createMeeting = async(req, res) => {
    try {
        const { title, description, startTime, endTime, meetingLink, meetingId, password, isRecurring } = req.body;
        const hostId = req.user._id;

        // Generate meetingId if not provided (extract from meetingLink or generate new)
        let finalMeetingId = meetingId;
        if (!finalMeetingId && meetingLink) {
            // Extract meeting ID from link (e.g., "http://example.com/meeting/meeting-f52oxj4")
            const urlParts = meetingLink.split('/');
            finalMeetingId = urlParts[urlParts.length - 1];
        }
        if (!finalMeetingId) {
            // Generate a new meeting ID if not provided
            finalMeetingId = `meeting-${Math.random().toString(36).substring(2, 9)}`;
        }

        const meeting = await meetingModel.create({
            meetingId: finalMeetingId,
            title,
            description,
            startTime,
            endTime,
            hostId,
            meetingLink,
            password,
            isRecurring,
            status: 'scheduled'
        });

        return res.status(201).json({
            success: true,
            message: 'Meeting created successfully',
            data: meeting
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Join an existing meeting
const joinMeeting = async(req, res) => {
    try {
        const { meetingId } = req.body;
        const userId = req.user._id;

        // Use meetingId field, NOT _id
        const meeting = await findMeetingByMeetingId(meetingId);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: 'Meeting not found'
            });
        }

        // Add user to participants if not already included
        if (!meeting.participants.includes(userId)) {
            meeting.participants.push(userId);
            await meeting.save();
        }

        return res.status(200).json({
            success: true,
            message: 'Joined meeting successfully',
            data: meeting
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Leave a meeting
const leaveMeeting = async(req, res) => {
    try {
        const { meetingId } = req.body;
        const userId = req.user._id;

        // Use meetingId field, NOT _id
        const meeting = await findMeetingByMeetingId(meetingId);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: 'Meeting not found'
            });
        }

        // Remove user from participants
        meeting.participants = meeting.participants.filter(
            participant => participant.toString() !== userId.toString()
        );
        await meeting.save();

        return res.status(200).json({
            success: true,
            message: 'Left meeting successfully'
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// End a meeting (host only)
const endMeeting = async(req, res) => {
    try {
        const { meetingId } = req.body;
        const userId = req.user._id;

        // Use meetingId field, NOT _id
        const meeting = await findMeetingByMeetingId(meetingId);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: 'Meeting not found'
            });
        }

        // Verify that the user is the host
        if (meeting.hostId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Only the meeting host can end the meeting'
            });
        }

        // Update meeting status to completed
        meeting.status = 'completed';
        meeting.endTime = new Date();
        await meeting.save();

        return res.status(200).json({
            success: true,
            message: 'Meeting ended successfully',
            data: meeting
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get meeting details
const getMeetingDetails = async(req, res) => {
    try {
        const { meetingId } = req.params;

        if (!meetingId) {
            return res.status(400).json({
                success: false,
                message: 'Meeting ID is required'
            });
        }

        // Use findOrCreateMeeting to implement "create-on-first-access" pattern
        // This eliminates the race condition where frontend navigates before meeting exists
        const hostId = req.user?._id || null; // Use authenticated user as host if available
        const { meeting, created } = await findOrCreateMeeting(meetingId, hostId);

        if (!meeting) {
            // This should never happen with valid meetingId format
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve or create meeting'
            });
        }

        // Try to populate, but handle errors gracefully
        try {
            // Only try to populate if the references exist
            if (meeting.hostId) {
                await meeting.populate('hostId', 'name email');
            }
            if (meeting.participants && meeting.participants.length > 0) {
                await meeting.populate('participants', 'name email');
            }
        } catch (populateErr) {
            console.warn("Error populating meeting references:", populateErr);
            // Continue with the unpopulated meeting
        }

        return res.status(200).json({
            success: true,
            message: 'Meeting details retrieved successfully',
            data: meeting
        });
    } catch (err) {
        console.error("Error getting meeting details:", err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Upload recording file
const uploadRecording = async(req, res) => {
    try {
        const { meetingId } = req.params;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No recording file provided'
            });
        }

        // Create recording URL
        const recordingUrl = `/uploads/recordings/${req.file.filename}`;
        const recordingFormat = path.extname(req.file.originalname).substring(1); // Remove the dot

        try {
            // Try to find and update the meeting by meetingId string
            const meeting = await findMeetingByMeetingId(meetingId);

            if (meeting) {
                // Check if user is authorized (host or participant)
                if (meeting.hostId.toString() !== req.user._id.toString() &&
                    !meeting.participants.includes(req.user._id)) {
                    return res.status(403).json({
                        success: false,
                        message: 'Not authorized to upload recording for this meeting'
                    });
                }

                // Update meeting with recording info
                meeting.recording = {
                    isRecorded: true,
                    recordingUrl: recordingUrl,
                    recordingStartTime: req.body.recordingStartTime || new Date(),
                    recordingEndTime: req.body.recordingEndTime || new Date(),
                    recordingSize: req.file.size,
                    recordingFormat: recordingFormat
                };

                await meeting.save();
            }
        } catch (dbErr) {
            console.warn('Database operation failed, but recording was saved:', dbErr.message);
            // Continue without database update
        }

        return res.status(200).json({
            success: true,
            message: 'Recording uploaded successfully',
            data: {
                recordingUrl,
                recordingId: meetingId
            }
        });
    } catch (err) {
        console.error('Error uploading recording:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Generate transcript from recording
const generateTranscript = async(req, res) => {
    try {
        const { meetingId } = req.params;

        // Find the meeting by meetingId string, NOT _id
        const meeting = await findMeetingByMeetingId(meetingId);

        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: 'Meeting not found'
            });
        }

        if (!meeting.recording || !meeting.recording.isRecorded) {
            return res.status(400).json({
                success: false,
                message: 'No recording found for this meeting'
            });
        }

        // Get the recording file path
        const recordingPath = path.join(__dirname, '../..', meeting.recording.recordingUrl);

        if (!fs.existsSync(recordingPath)) {
            return res.status(404).json({
                success: false,
                message: 'Recording file not found'
            });
        }

        console.log('Starting transcription for meeting:', meetingId);

        // Generate transcript using the transcription service
        const transcriptionResult = await transcriptionService.transcribeRecording(recordingPath);

        // Create transcript files
        const timestamp = Date.now();
        const transcriptFilename = `transcript_${meetingId}_${timestamp}.txt`;
        const vttFilename = `transcript_${meetingId}_${timestamp}.vtt`;

        const transcriptPath = path.join(transcriptsDir, transcriptFilename);
        const vttPath = path.join(transcriptsDir, vttFilename);

        const transcriptUrl = `/uploads/transcripts/${transcriptFilename}`;
        const vttUrl = `/uploads/transcripts/${vttFilename}`;

        // Write transcript text file
        fs.writeFileSync(transcriptPath, transcriptionResult.text);

        // Generate and write VTT subtitle file
        const vttContent = transcriptionService.generateVTTSubtitles(transcriptionResult);
        fs.writeFileSync(vttPath, vttContent);

        // Update meeting with transcript info
        meeting.transcript = {
            isGenerated: true,
            transcriptUrl: transcriptUrl,
            transcriptText: transcriptionResult.text,
            vttUrl: vttUrl,
            duration: transcriptionResult.duration,
            generatedAt: new Date(),
            segments: transcriptionResult.segments || []
        };

        await meeting.save();

        console.log('Transcript generated successfully for meeting:', meetingId);

        return res.status(200).json({
            success: true,
            message: 'Transcript generated successfully',
            data: {
                transcriptUrl,
                vttUrl,
                transcriptText: transcriptionResult.text,
                duration: transcriptionResult.duration
            }
        });
    } catch (err) {
        console.error('Error generating transcript:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to generate transcript: ' + err.message
        });
    }
};

// Get recording
const getRecording = async(req, res) => {
    try {
        const { meetingId } = req.params;

        // Use findOrCreateMeeting for consistency - never 404 for valid meetingId
        const { meeting } = await findOrCreateMeeting(meetingId);

        if (!meeting) {
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve or create meeting'
            });
        }

        // Return empty recording structure instead of 404
        // This prevents frontend errors when recording hasn't been made yet
        if (!meeting.recording || !meeting.recording.isRecorded) {
            return res.status(200).json({
                success: true,
                data: {
                    isRecorded: false,
                    url: null,
                    recordedAt: null,
                    message: 'No recording available'
                }
            });
        }

        return res.status(200).json({
            success: true,
            data: meeting.recording
        });
    } catch (err) {
        console.error('Error getting recording:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get transcript
const getTranscript = async(req, res) => {
    try {
        const { meetingId } = req.params;

        if (!meetingId) {
            return res.status(400).json({
                success: false,
                message: 'Meeting ID is required'
            });
        }

        // Use findOrCreateMeeting for consistency - never 404 for valid meetingId
        const { meeting } = await findOrCreateMeeting(meetingId);

        if (!meeting) {
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve or create meeting'
            });
        }

        // Return empty transcript structure instead of 404
        // This prevents frontend errors when transcript hasn't been generated yet
        if (!meeting.transcript || !meeting.transcript.isGenerated) {
            return res.status(200).json({
                success: true,
                data: {
                    isGenerated: false,
                    content: null,
                    generatedAt: null,
                    message: 'Transcript not yet generated'
                }
            });
        }

        return res.status(200).json({
            success: true,
            data: meeting.transcript
        });
    } catch (err) {
        console.error('Error getting transcript:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get user's meeting history
const getUserMeetings = async(req, res) => {
    try {
        const userId = req.user._id;
        const { page = 1, limit = 10, status } = req.query;

        // Build query conditions
        const queryConditions = {
            $or: [
                { hostId: userId },
                { participants: userId }
            ]
        };

        // Add status filter if provided
        if (status && ['scheduled', 'ongoing', 'completed', 'cancelled'].includes(status)) {
            queryConditions.status = status;
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get meetings with pagination
        const meetings = await meetingModel
            .find(queryConditions)
            .populate('hostId', 'name email')
            .populate('participants', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count for pagination
        const totalMeetings = await meetingModel.countDocuments(queryConditions);

        return res.status(200).json({
            success: true,
            message: 'Meetings retrieved successfully',
            data: {
                meetings,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalMeetings / parseInt(limit)),
                    totalMeetings,
                    hasNext: skip + meetings.length < totalMeetings,
                    hasPrev: parseInt(page) > 1
                }
            }
        });
    } catch (err) {
        console.error('Error getting user meetings:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Download recording file
const downloadRecording = async(req, res) => {
    try {
        const { meetingId } = req.params;

        // Find the meeting by meetingId string, NOT _id
        const meeting = await findMeetingByMeetingId(meetingId);

        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: 'Meeting not found'
            });
        }

        // Check if user has access to this meeting
        if (meeting.hostId.toString() !== req.user._id.toString() &&
            !meeting.participants.includes(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to download this recording'
            });
        }

        // Check if recording exists
        if (!meeting.recording || !meeting.recording.isRecorded) {
            return res.status(404).json({
                success: false,
                message: 'No recording found for this meeting'
            });
        }

        // Get the recording file path
        const recordingPath = path.join(__dirname, '../..', meeting.recording.recordingUrl);

        if (!fs.existsSync(recordingPath)) {
            return res.status(404).json({
                success: false,
                message: 'Recording file not found'
            });
        }

        // Set appropriate headers for file download
        const filename = `meeting_${meetingId}_recording.${meeting.recording.recordingFormat}`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', `video/${meeting.recording.recordingFormat}`);

        // Stream the file
        const fileStream = fs.createReadStream(recordingPath);
        fileStream.pipe(res);

    } catch (err) {
        console.error('Error downloading recording:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Download transcript file
const downloadTranscript = async(req, res) => {
    try {
        const { meetingId } = req.params;
        const { format = 'txt' } = req.query; // txt or vtt

        // Find the meeting by meetingId string, NOT _id
        const meeting = await findMeetingByMeetingId(meetingId);

        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: 'Meeting not found'
            });
        }

        // Check if user has access to this meeting
        if (meeting.hostId.toString() !== req.user._id.toString() &&
            !meeting.participants.includes(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to download this transcript'
            });
        }

        // Check if transcript exists
        if (!meeting.transcript || !meeting.transcript.isGenerated) {
            return res.status(404).json({
                success: false,
                message: 'No transcript found for this meeting'
            });
        }

        // Determine which file to download
        let filePath, filename, contentType;

        if (format === 'vtt' && meeting.transcript.vttUrl) {
            filePath = path.join(__dirname, '../..', meeting.transcript.vttUrl);
            filename = `meeting_${meetingId}_transcript.vtt`;
            contentType = 'text/vtt';
        } else {
            filePath = path.join(__dirname, '../..', meeting.transcript.transcriptUrl);
            filename = `meeting_${meetingId}_transcript.txt`;
            contentType = 'text/plain';
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'Transcript file not found'
            });
        }

        // Set appropriate headers for file download
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', contentType);

        // Stream the file
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

    } catch (err) {
        console.error('Error downloading transcript:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export default {
    updateMeetingStatus,
    createMeeting,
    joinMeeting,
    leaveMeeting,
    endMeeting,
    getMeetingDetails,
    uploadRecording,
    generateTranscript,
    getRecording,
    getTranscript,
    getUserMeetings,
    downloadRecording,
    downloadTranscript
};
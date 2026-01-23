import mongoose from 'mongoose';

const meetingSchema = new mongoose.Schema({
    // Public-facing meeting ID (e.g., "meeting-f52oxj4")
    // This is NOT the MongoDB _id - it's a human-readable string
    meetingId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    title: {
        type: String,
        trim: true,
        default: 'Untitled Meeting' // Default title for on-demand creation
    },
    description: {
        type: String,
        trim: true
    },
    startTime: {
        type: Date,
        default: Date.now // Default to now for on-demand creation
    },
    endTime: {
        type: Date,
        default: () => new Date(Date.now() + 3600000) // Default to 1 hour from now
    },
    hostId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
        // Not required - may be set later when host joins
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    meetingLink: {
        type: String,
        sparse: true // Allow null but enforce uniqueness when set
    },
    password: {
        type: String
    },
    isRecurring: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
        default: 'scheduled'
    },
    recording: {
        isRecorded: {
            type: Boolean,
            default: false
        },
        recordingUrl: {
            type: String
        },
        recordingStartTime: {
            type: Date
        },
        recordingEndTime: {
            type: Date
        },
        recordingSize: {
            type: Number // Size in bytes
        },
        recordingFormat: {
            type: String,
            enum: ['webm', 'mp4'],
            default: 'webm'
        }
    },
    transcript: {
        isGenerated: {
            type: Boolean,
            default: false
        },
        transcriptUrl: {
            type: String
        },
        transcriptText: {
            type: String
        },
        vttUrl: {
            type: String
        },
        duration: {
            type: Number // Duration in seconds
        },
        segments: [{
            start: Number,
            end: Number,
            text: String,
            word: String
        }],
        generatedAt: {
            type: Date
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

const Meeting = mongoose.model('Meeting', meetingSchema);

export default Meeting;
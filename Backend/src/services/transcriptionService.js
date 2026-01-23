import OpenAI from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Set up __dirname equivalent for ES modules
const __filename = fileURLToPath(
    import.meta.url);
const __dirname = path.dirname(__filename);

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

// Lazy initialize OpenAI client - only when needed and API key is available
let openai = null;

const getOpenAIClient = () => {
    if (!openai && process.env.OPENAI_API_KEY) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }
    return openai;
};

class TranscriptionService {
    constructor() {
        this.tempDir = path.join(__dirname, '../../temp');
        this.ensureTempDir();
    }

    ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    // Extract audio from video file
    async extractAudio(videoPath, outputPath) {
        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .output(outputPath)
                .audioCodec('libmp3lame')
                .audioFrequency(16000)
                .audioChannels(1)
                .format('mp3')
                .on('end', () => {
                    console.log('Audio extraction completed');
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    console.error('Error extracting audio:', err);
                    reject(err);
                })
                .run();
        });
    }

    // Transcribe audio using OpenAI Whisper
    async transcribeWithWhisper(audioPath) {
        try {
            console.log('Starting transcription with OpenAI Whisper...');
            
            const client = getOpenAIClient();
            if (!client) {
                throw new Error('OpenAI client not available');
            }

            const transcription = await client.audio.transcriptions.create({
                file: fs.createReadStream(audioPath),
                model: 'whisper-1',
                language: 'en', // You can make this configurable
                response_format: 'verbose_json',
                timestamp_granularities: ['word']
            });

            return {
                text: transcription.text,
                segments: transcription.words || [],
                duration: transcription.duration || 0
            };
        } catch (error) {
            console.error('Error with OpenAI Whisper transcription:', error);
            throw error;
        }
    }

    // Fallback transcription using a simple placeholder
    async fallbackTranscription(audioPath) {
        console.log('Using fallback transcription method...');

        // Get audio duration for a more realistic placeholder
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(audioPath, (err, metadata) => {
                if (err) {
                    resolve({
                        text: "This is a placeholder transcript. The meeting was recorded successfully, but automatic transcription is not available at the moment. Please configure OpenAI API key for automatic transcription.",
                        segments: [],
                        duration: 0
                    });
                    return;
                }

                const duration = metadata.format.duration || 0;
                const placeholderText = `This is a placeholder transcript for a ${Math.round(duration / 60)} minute meeting. The recording was successful, but automatic transcription requires OpenAI API configuration. Key discussion points and decisions should be manually documented.`;

                resolve({
                    text: placeholderText,
                    segments: [],
                    duration: duration
                });
            });
        });
    }

    // Main transcription method
    async transcribeRecording(videoPath) {
        const audioPath = path.join(this.tempDir, `audio_${Date.now()}.mp3`);

        try {
            // Extract audio from video
            await this.extractAudio(videoPath, audioPath);

            let transcriptionResult;

            // Try OpenAI Whisper first if API key is available
            if (process.env.OPENAI_API_KEY) {
                try {
                    transcriptionResult = await this.transcribeWithWhisper(audioPath);
                } catch (whisperError) {
                    console.warn('OpenAI Whisper failed, using fallback:', whisperError.message);
                    transcriptionResult = await this.fallbackTranscription(audioPath);
                }
            } else {
                console.log('No OpenAI API key found, using fallback transcription');
                transcriptionResult = await this.fallbackTranscription(audioPath);
            }

            // Clean up temporary audio file
            if (fs.existsSync(audioPath)) {
                fs.unlinkSync(audioPath);
            }

            return transcriptionResult;
        } catch (error) {
            // Clean up temporary audio file in case of error
            if (fs.existsSync(audioPath)) {
                fs.unlinkSync(audioPath);
            }
            throw error;
        }
    }

    // Generate VTT subtitle file from transcription
    generateVTTSubtitles(transcriptionResult) {
        let vttContent = 'WEBVTT\n\n';

        if (transcriptionResult.segments && transcriptionResult.segments.length > 0) {
            transcriptionResult.segments.forEach((segment, index) => {
                const startTime = this.formatVTTTime(segment.start || 0);
                const endTime = this.formatVTTTime(segment.end || segment.start + 2);

                vttContent += `${index + 1}\n`;
                vttContent += `${startTime} --> ${endTime}\n`;
                vttContent += `${segment.word || segment.text}\n\n`;
            });
        } else {
            // If no segments, create a single subtitle for the entire transcript
            const duration = transcriptionResult.duration || 60;
            vttContent += '1\n';
            vttContent += `00:00:00.000 --> ${this.formatVTTTime(duration)}\n`;
            vttContent += `${transcriptionResult.text}\n\n`;
        }

        return vttContent;
    }

    // Format time for VTT format (HH:MM:SS.mmm)
    formatVTTTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const milliseconds = Math.floor((seconds % 1) * 1000);

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    }
}

export default new TranscriptionService();
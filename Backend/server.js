import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import {createServer} from 'http';
import connectToSocket from './src/controllers/socketManager.js';
import cors from 'cors';
import connectDb from './src/Db/Db.js';
// Import models to ensure they are registered before routes
import './src/models/index.js';
import userRoutes from './src/routes/userRoutes.js';
import meetingRoutes from './src/routes/meetingRoutes.js';
import cookieParser from 'cookie-parser';
import { networkInterfaces } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

// Set up __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Use PORT from environment or default to 3001 instead of 3000 which is likely in use
const defaultPort = process.env.PORT;
let port = defaultPort;

const server = createServer(app);
const io = connectToSocket(server);


app.use(cors());


// Limit JSON body size to prevent DoS attacks
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create uploads directory and subdirectories if they don't exist
const uploadsDir = path.join(__dirname, 'uploads');
const recordingsDir = path.join(uploadsDir, 'recordings');
const transcriptsDir = path.join(uploadsDir, 'transcripts');

import fs from 'fs';

// Create directories if they don't exist
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory');
}
if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
    console.log('Created recordings directory');
}
if (!fs.existsSync(transcriptsDir)) {
    fs.mkdirSync(transcriptsDir, { recursive: true });
    console.log('Created transcripts directory');
}

// Connect to MongoDB but continue even if it fails
connectDb().then(connected => {
    if (!connected) {
        console.log('Server will run with limited functionality due to database connection issues');
    }
});

app.use('/users', userRoutes);
app.use('/meetings', meetingRoutes);

app.get('/', (req, res) => {
    res.send("Server is running");
});

// Health check endpoint for Docker/Kubernetes
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Function to find an available port
const startServer = (initialPort) => {
    port = initialPort;
    
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} is already in use, trying ${port + 1}...`);
            port += 1;
            setTimeout(() => {
                server.close();
                server.listen(port);
            }, 1000);
        } else {
            console.error('Server error:', err);
        }
    });

    server.listen(port, () => {
        console.log(`Server is running on port ${port}`);
        
        // Display local IP address for easier access from other devices on the network
        try {
            const nets = networkInterfaces();
            const results = {};
            
            for (const name of Object.keys(nets)) {
                for (const net of nets[name]) {
                    // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
                    if (net.family === 'IPv4' && !net.internal) {
                        if (!results[name]) {
                            results[name] = [];
                        }
                        results[name].push(net.address);
                    }
                }
            }
            
            console.log('Available on:');
            console.log(`- Local: http://localhost:${port}`);
            
            // Display network IPs for easy access
            Object.keys(results).forEach((key) => {
                results[key].forEach((ip) => {
                    console.log(`- Network: http://${ip}:${port}`);
                });
            });
        } catch (err) {
            // Ignore if we can't get network interfaces
        }
    });
};

// Start the server with the initial port
startServer(defaultPort);

// Export for testing purposes
export default app;

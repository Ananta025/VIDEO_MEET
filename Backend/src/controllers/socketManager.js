import { Server } from 'socket.io';

const connections = {};
const timeOnline = {};
const messages = {};
const pendingJoins = {}; // Track pending join operations

const connectToSocket = (server) => {
    // Get allowed origins from environment or use defaults
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',') 
        : ['http://localhost:5173', 'http://localhost:3000'];
    
    const io = new Server(server, {
        cors: {
            origin: process.env.NODE_ENV === 'production' ? allowedOrigins : "*",
            methods: ["GET", "POST"],
            allowedHeaders: "*",
            credentials: true
        },
        pingTimeout: 30000,
        pingInterval: 5000,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
    });

    io.on('connection', (socket) => {
        console.log("User connected with ID:", socket.id);

        // Improved join-call handler with confirmation mechanism
        socket.on("join-call", (path) => {
            if (connections[path] === undefined) {
                connections[path] = [];
            }
            
            // Check if this socket is already in this room
            if (!connections[path].includes(socket.id)) {
                // Add to connections immediately
                connections[path].push(socket.id);
                timeOnline[socket.id] = new Date();
                
                // Track this join operation
                pendingJoins[socket.id] = {
                    path,
                    timestamp: Date.now()
                };
                
                // Send the full participant list to the new user immediately
                // This ensures they can see everyone right away
                socket.emit("user-joined", socket.id, connections[path]);
                
                // ============================================
                // TIMING FIX: Reduced delay from 1000ms to 500ms
                // The frontend now properly awaits getUserMedia() before
                // connecting to socket, so we need less buffer time.
                // 500ms should be sufficient for stream setup.
                // ============================================
                setTimeout(() => {
                    // Check if socket is still connected
                    if (io.sockets.sockets.has(socket.id)) {
                        // Notify everyone else about the new user
                        connections[path].forEach(socketId => {
                            if (socketId !== socket.id) {
                                io.to(socketId).emit("user-joined", socket.id, connections[path]);
                            }
                        });
                        
                        // Clear pending join
                        delete pendingJoins[socket.id];
                    }
                }, 500);
            }
        });

        // Add a ready-state mechanism to ensure peers establish connections properly
        socket.on("connection-ready", (path) => {
            if (connections[path] && connections[path].includes(socket.id)) {
                // Notify all peers this user is ready for connections
                connections[path].forEach(socketId => {
                    if (socketId !== socket.id) {
                        io.to(socketId).emit("peer-ready", socket.id);
                    }
                });
            }
        });

        socket.on("signal", (toId, message) => {
            // Check if the recipient socket still exists before sending
            if (io.sockets.sockets.has(toId)) {
                io.to(toId).emit("signal", socket.id, message);
            } else {
                // Recipient not found, send back an error to the sender
                socket.emit("signal-error", toId, "Peer disconnected");
            }
        });

        socket.on("chat-message", (data, sender) => {
            // Find which room this socket is in
            const matchingRoom = Object.entries(connections).find(([roomKey, sockets]) =>
                sockets.includes(socket.id)
            )?.[0];

            if (matchingRoom) {
                if (messages[matchingRoom] === undefined) {
                    messages[matchingRoom] = [];
                }
                
                // Store the message in server's memory
                messages[matchingRoom].push({ "sender": sender, "data": data, "socket-id-sender": socket.id });
                console.log("message", matchingRoom, ":", sender, data);

                // Send to all clients EXCEPT the sender
                connections[matchingRoom].forEach(socketId => {
                    if (socketId !== socket.id) { // Don't send back to sender
                        io.to(socketId).emit("chat-message", data, sender, socket.id);
                    }
                });
            }
        });

        socket.on("disconnect", (reason) => {
            console.log("User disconnected:", socket.id, "Reason:", reason);
            let roomKey = null;

            // Handle any pending joins
            if (pendingJoins[socket.id]) {
                delete pendingJoins[socket.id];
            }

            // Find which room this socket was in
            for (const [k, v] of Object.entries(connections)) {
                const index = v.indexOf(socket.id);
                if (index !== -1) {
                    roomKey = k;
                    break;
                }
            }

            if (roomKey) {
                console.log("User was in room:", roomKey);

                // Notify all other users in the room
                connections[roomKey].forEach(socketId => {
                    if (socketId !== socket.id && io.sockets.sockets.has(socketId)) {
                        io.to(socketId).emit("user-left", socket.id);
                    }
                });

                // Remove user from connections
                connections[roomKey] = connections[roomKey].filter(id => id !== socket.id);

                // Clean up empty rooms
                if (connections[roomKey].length === 0) {
                    console.log("Room is now empty, removing:", roomKey);
                    delete connections[roomKey];
                    delete messages[roomKey];
                }
            }
        });
    });

    // Add cleanup interval for stale pending joins
    setInterval(() => {
        const now = Date.now();
        for (const [socketId, joinData] of Object.entries(pendingJoins)) {
            // If join operation is older than 60 seconds, clean it up
            if (now - joinData.timestamp > 60000) {
                console.log("Cleaning up stale pending join:", socketId);
                delete pendingJoins[socketId];
                
                // Also remove from room if socket is no longer connected
                if (!io.sockets.sockets.has(socketId) && joinData.path && connections[joinData.path]) {
                    connections[joinData.path] = connections[joinData.path].filter(id => id !== socketId);
                    
                    // Clean up empty rooms
                    if (connections[joinData.path].length === 0) {
                        delete connections[joinData.path];
                        delete messages[joinData.path];
                    }
                }
            }
        }
    }, 30000);

    return io;
}

export default connectToSocket;
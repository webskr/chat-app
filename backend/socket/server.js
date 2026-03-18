const { Server } = require("socket.io");
const http = require("http");

const PHP_BACKEND_URL = "http://localhost/chat-app/backend/users/update_online_status.php";

// Mapping of connected sockets to user IDs
const socketToUser = new Map();
const userToSockets = new Map(); // Multiple sockets per user allowed

function notifyBackendStatus(userId, isOnline) {
    const data = JSON.stringify({ user_id: userId, is_online: isOnline ? 1 : 0 });
    const options = {
        hostname: 'localhost',
        port: 80,
        path: '/chat-app/backend/users/update_online_status.php',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    const req = http.request(options, (res) => {
        let response = '';
        res.on('data', (d) => { response += d; });
        res.on('end', () => {
            console.log(`[Backend Status] User ${userId} ${isOnline ? 'Online' : 'Offline'}: ${response}`);
        });
    });

    req.on('error', (error) => {
        console.error(`[Backend Status] Error updating user ${userId}:`, error);
    });

    req.write(data);
    req.end();
}

const httpServer = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/internal-emit') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { event, data } = JSON.parse(body);
                if (event && data && data.room) {
                    io.to(data.room).emit(event, data);
                    console.log(`[Internal Emit] ${event} to ${data.room}`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ok' }));
                } else {
                    res.writeHead(400); res.end('Invalid payload');
                }
            } catch (e) {
                res.writeHead(500); res.end(e.message);
            }
        });
    } else {
        res.writeHead(404); res.end();
    }
});

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const SOCKET_PORT = process.env.PORT || 3000;

httpServer.listen(SOCKET_PORT, '0.0.0.0', () => {
    console.log(`Socket.IO + Internal API running on port ${SOCKET_PORT}`);
    console.log("PHP Backend pointed to:", PHP_BACKEND_URL);
});

io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle user identification
    socket.on("user:identify", (userId) => {
        if (!userId) return;

        userId = String(userId);
        socketToUser.set(socket.id, userId);

        if (!userToSockets.has(userId)) {
            userToSockets.set(userId, new Set());
            // First socket for this user -> notify backend and broadcast online
            notifyBackendStatus(userId, true);
            io.emit("user_online", { user_id: userId, status: 'online' });
        }
        userToSockets.get(userId).add(socket.id);
        socket.join(`user_${userId}`);

        console.log(`User ${userId} identified on socket ${socket.id}`);
    });

    // Join a specific virtual room (e.g. "user_1" or "group_1")
    socket.on("join_room", (room) => {
        socket.join(room);
        console.log(`User ${socket.id} joined room: ${room}`);
    });

    // Handle typing start
    socket.on("typing:start", ({ room, user }) => {
        socket.to(room).emit("typing:start", { user });
    });

    // Handle typing stop
    socket.on("typing:stop", ({ room, user }) => {
        socket.to(room).emit("typing:stop", { user });
    });

    // --- ZERO KNOWLEDGE REALTIME ROUTING ---

    // Forward new encrypted message payload
    socket.on("message:new", (data) => {
        socket.to(data.room).emit("message:new", data);
    });

    // Forward delivery receipts
    socket.on("message:delivered", (data) => {
        socket.to(data.room).emit("message:delivered", data);
    });

    // Forward read/seen receipts
    socket.on("message:read", (data) => {
        socket.to(data.room).emit("message:read", data);
    });

    socket.on("message:seen", (data) => {
        socket.to(data.room).emit("message:seen", data);
    });

    // Forward generic message deletion events
    socket.on("message:delete", (data) => {
        socket.to(data.room).emit("message:delete", data);
    });

    // Legacy Handle message edit
    socket.on("edit_message", (data) => {
        socket.to(data.room).emit("message_edited", data);
    });

    socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.id}`);
        const userId = socketToUser.get(socket.id);
        if (userId) {
            const sockets = userToSockets.get(userId);
            if (sockets) {
                sockets.delete(socket.id);
                if (sockets.size === 0) {
                    // Last socket for this user -> notify backend and broadcast offline
                    userToSockets.delete(userId);
                    notifyBackendStatus(userId, false);
                    io.emit("user_offline", { user_id: userId, status: 'offline', last_active: new Date().toISOString() });
                }
            }
            socketToUser.delete(socket.id);
        }
    });
});

const { Server } = require("socket.io");
const http = require("http");
const express = require("express");
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(express.json());

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Firebase Admin Setup
const FIREBASE_KEY_PATH = path.join(__dirname, "firebase-key.json");
let fcmEnabled = false;

if (fs.existsSync(FIREBASE_KEY_PATH)) {
    try {
        const serviceAccount = require(FIREBASE_KEY_PATH);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        fcmEnabled = true;
        console.log("[FCM] Firebase Admin initialized.");
    } catch (error) {
        console.error("[FCM] Error initializing:", error);
    }
} else {
    console.warn("[FCM] firebase-key.json not found.");
}

const PHP_BACKEND_URL = "http://localhost/chat-app/backend/users/update_online_status.php";

// --- FIXED STATE MODEL ---
// userStates = { userId: { sockets: { socketId: { activeChatId: string | null } }, pendingPushes: Map<msgId, timeout> } }
const userStates = new Map();

function getUserState(userId) {
    userId = String(userId);
    if (!userStates.has(userId)) {
        userStates.set(userId, {
            sockets: {},
            pendingPushes: new Map()
        });
    }
    return userStates.get(userId);
}

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

app.post("/internal-emit", (req, res) => {
    try {
        const { event, data } = req.body;
        if (event && data && data.room) {
            io.to(data.room).emit(event, data);
            console.log(`[Internal Emit] ${event} to ${data.room}`);
            res.json({ status: 'ok' });
        } else {
            res.status(400).send('Invalid payload');
        }
    } catch (e) {
        res.status(500).send(e.message);
    }
});

io.on("connection", (socket) => {
    let currentUserId = null;

    console.log(`Socket connected: ${socket.id}`);

    // --- PRESENCE & SOCKET IDENTIFICATION ---
    socket.on("user:identify", (userId) => {
        if (!userId) return;
        userId = String(userId);
        currentUserId = userId;

        const state = getUserState(userId);
        const wasOffline = Object.keys(state.sockets).length === 0;
        
        state.sockets[socket.id] = { activeChatId: null };
        socket.join(`user_${userId}`);

        if (wasOffline) {
            notifyBackendStatus(userId, true);
            io.emit("user_online", { user_id: userId, status: 'online' });
            console.log(`[Presence] User ${userId} is now ONLINE (First Socket)`);
        }
    });

    // --- PER-SOCKET ACTIVE CHAT TRACKING ---
    socket.on("chat_open", ({ chatId }) => {
        if (!currentUserId) return;
        const state = getUserState(currentUserId);
        if (state.sockets[socket.id]) {
            state.sockets[socket.id].activeChatId = String(chatId);
            console.log(`[Presence] Socket ${socket.id} (User ${currentUserId}) opened chat ${chatId}`);
        }
    });

    socket.on("chat_close", () => {
        if (!currentUserId) return;
        const state = getUserState(currentUserId);
        if (state.sockets[socket.id]) {
            state.sockets[socket.id].activeChatId = null;
            console.log(`[Presence] Socket ${socket.id} (User ${currentUserId}) closed chat`);
        }
    });

    // --- ROOM JOINING ---
    socket.on("join_room", (room) => {
        if (!room) return;
        socket.join(room);
        console.log(`Socket ${socket.id} joined room: ${room}`);
    });

    // --- FIXED MESSAGE HANDLING LOGIC ---
    socket.on("message:new", async (data) => {
        const { room, message, receiverId } = data;
        const msgId = message.id || Date.now();
        if (!room) return;

        // 1. Broadcast to room immediately
        socket.to(room).emit("message:new", data);

        if (!receiverId) return;

        // 2. FIXED: Delay decision by 500ms to handle race condition with chat_open
        console.log(`[Logic] New message for receiver_id: ${data.receiver_id || receiverId}. Waiting 500ms for state stabilization...`);
        
        setTimeout(() => {
            const finalReceiverId = String(data.receiver_id || receiverId);
            if (!finalReceiverId || finalReceiverId === 'undefined') return;

            const receiverState = getUserState(finalReceiverId);
            const isOnline = Object.keys(receiverState.sockets).length > 0;
            
            // FIXED Same-chat detection: Check ALL sockets
            const isInSameChat = Object.values(receiverState.sockets).some(
                s => s.activeChatId === String(data.chatId || data.room?.replace('group_', '')?.replace('chat_', ''))
            );

            // DEBUG LOGS
            console.log(`[Logic Debug] User: ${finalReceiverId}`);
            console.log(`[Logic Debug] Message ChatId: ${data.chatId || data.room}`);
            console.log(`[Logic Debug] Sockets: ${JSON.stringify(receiverState.sockets)}`);
            console.log(`[Logic Debug] isInSameChat: ${isInSameChat}`);

            if (isInSameChat) {
                console.log(`[Logic] User ${receiverId} is active in chat. NO notification.`);
                return;
            }

            if (isOnline) {
                // FIXED: Try socket first, then push if no ack
                console.log(`[Logic] User ${receiverId} is online in other chat. Emitting in-app.`);
                io.to(`user_${receiverId}`).emit("notification:inapp", {
                    title: "New Message",
                    body: message.text || "Message received",
                    chatId: data.chatId
                });

                // Wait for ack before push
                schedulePushIfNoAck(receiverId, data, msgId, 1000);
            } else {
                // Offline: Push immediately
                console.log(`[Logic] User ${receiverId} is offline. Sending push immediately.`);
                sendPushNotification(receiverId, data);
            }
        }, 500);
    });

    // --- DELIVERY CONFIRMATION (ACK) ---
    socket.on("message:received", ({ msgId, userId }) => {
        const state = getUserState(userId);
        if (state.pendingPushes.has(msgId)) {
            console.log(`[Reliability] Ack received for ${msgId}. Cancelling push.`);
            clearTimeout(state.pendingPushes.get(msgId));
            state.pendingPushes.delete(msgId);
        }
    });

    function schedulePushIfNoAck(userId, data, msgId, delay) {
        const state = getUserState(userId);
        console.log(`[Reliability] Waiting ${delay}ms for ack of ${msgId}...`);
        
        const timeout = setTimeout(() => {
            console.log(`[Reliability] No ack for ${msgId}. Sending push.`);
            sendPushNotification(userId, data);
            state.pendingPushes.delete(msgId);
        }, delay);

        state.pendingPushes.set(msgId, timeout);
    }

    async function sendPushNotification(userId, data) {
        if (!fcmEnabled) {
            console.warn(`[FCM] Skip push to ${userId}: Not configured.`);
            return;
        }
        console.log(`[FCM] Sending push to ${userId}...`);
        // Actual FCM implementation would go here (fetch token from DB)
    }

    socket.on("message:read", (data) => {
        socket.to(data.room).emit("message:read", data);
    });

    socket.on("disconnect", () => {
        if (currentUserId) {
            const state = getUserState(currentUserId);
            delete state.sockets[socket.id];

            if (Object.keys(state.sockets).length === 0) {
                notifyBackendStatus(currentUserId, false);
                io.emit("user_offline", { user_id: currentUserId, status: 'offline', last_active: new Date().toISOString() });
                console.log(`[Presence] User ${currentUserId} is now OFFLINE`);
            }
        }
        console.log(`Socket disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Chat Notification Server running on port ${PORT}`);
});

const { Server } = require("socket.io");

const io = new Server(3000, {
    cors: {
        origin: "*", // Allow all origins for development
        methods: ["GET", "POST"]
    }
});

console.log("Socket.IO zero-knowledge server running on port 3000");

io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join a specific virtual room (e.g. "user_1" or "group_1")
    socket.on("join_room", (room) => {
        socket.join(room);
        console.log(`User ${socket.id} joined room: ${room}`);
    });

    // Handle typing start
    socket.on("typing_start", ({ room, user }) => {
        socket.to(room).emit("typing_start", { user });
    });

    // Handle typing stop
    socket.on("typing_stop", ({ room, user }) => {
        socket.to(room).emit("typing_stop", { user });
    });

    // --- ZERO KNOWLEDGE REALTIME ROUTING ---

    // Forward new encrypted message payload
    socket.on("message:new", (data) => {
        // data contains: { room: "user_X", sender_id: 1, temp_id: "...", encrypted_payload: "..." }
        // The server does NOT inspect data.encrypted_payload.
        socket.to(data.room).emit("message:new", data);
    });

    // Forward delivery receipts
    socket.on("message:delivered", (data) => {
        // data contains: { room: "user_X", message_ids: [...] }
        socket.to(data.room).emit("message:delivered", data);
    });

    // Forward read/seen receipts
    socket.on("message:read", (data) => {
        // data contains: { room: "user_X", message_ids: [...] }
        socket.to(data.room).emit("message:read", data);
    });

    // Forward generic message deletion events
    socket.on("message:delete", (data) => {
        socket.to(data.room).emit("message:delete", data);
    });

    // Legacy Handle message edit (Can keep for plaintext, or route similar to above if E2E)
    socket.on("edit_message", (data) => {
        socket.to(data.room).emit("message_edited", data);
    });

    socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

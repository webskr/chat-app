const { Server } = require("socket.io");

const io = new Server(3000, {
    cors: {
        origin: "*", // Allow all origins for development
        methods: ["GET", "POST"]
    }
});

console.log("Socket.IO server running on port 3000");

io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join a specific chat room
    socket.on("join_room", (room) => {
        socket.join(room);
        console.log(`User ${socket.id} joined room: ${room}`);
    });

    // Handle typing start
    socket.on("typing_start", ({ room, user }) => {
        console.log(`User ${user} is typing in room ${room}`);
        // Broadcast to everyone in the room EXCEPT the sender
        socket.to(room).emit("typing_start", { user });
    });

    // Handle typing stop
    socket.on("typing_stop", ({ room, user }) => {
        console.log(`User ${user} stopped typing in room ${room}`);
        socket.to(room).emit("typing_stop", { user });
    });

    // Handle message edit
    socket.on("edit_message", ({ room, message_id, new_text }) => {
        console.log(`Message ${message_id} edited in room ${room}`);
        socket.to(room).emit("message_edited", { message_id, new_text });
    });

    socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

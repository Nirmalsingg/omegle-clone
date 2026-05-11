const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

app.use(cors({
  origin: "*",
}));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let waitingQueue = [];
const socketToRoom = new Map();

const removeFromQueue = (socketId) => {
  waitingQueue = waitingQueue.filter((id) => id !== socketId);
};

const createRoomId = (a, b) => [a, b].sort().join("-");
const clearRoomMappings = (roomId) => {
  const participants = io.sockets.adapter.rooms.get(roomId);
  if (!participants) {
    return;
  }

  participants.forEach((participantId) => {
    socketToRoom.delete(participantId);
  });
};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Find a random partner from queue.
  socket.on("find", () => {
    if (socketToRoom.has(socket.id)) {
      return;
    }

    removeFromQueue(socket.id);

    const partnerId = waitingQueue.shift();
    const partnerSocket = partnerId ? io.sockets.sockets.get(partnerId) : null;

    if (!partnerSocket) {
      waitingQueue.push(socket.id);
      socket.emit("waiting");
      return;
    }

    const roomId = createRoomId(socket.id, partnerSocket.id);
    socket.join(roomId);
    partnerSocket.join(roomId);

    socketToRoom.set(socket.id, roomId);
    socketToRoom.set(partnerSocket.id, roomId);

    io.to(roomId).emit("matched", roomId);
  });

  socket.on("offer", ({ offer, roomId }) => {
    socket.to(roomId).emit("offer", offer);
  });

  socket.on("answer", ({ answer, roomId }) => {
    socket.to(roomId).emit("answer", answer);
  });

  socket.on("ice-candidate", ({ candidate, roomId }) => {
    socket.to(roomId).emit("ice-candidate", candidate);
  });

  socket.on("message", ({ text, roomId }) => {
    socket.to(roomId).emit("message", {
      sender: "stranger",
      text,
    });
  });

  socket.on("next", () => {
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit("partner-disconnected");
      clearRoomMappings(roomId);
      socket.leave(roomId);
    }

    removeFromQueue(socket.id);
    socket.emit("waiting");

    waitingQueue.push(socket.id);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit("partner-disconnected");
      clearRoomMappings(roomId);
    }

    removeFromQueue(socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
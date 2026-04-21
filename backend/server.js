const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

// CORS for frontend
app.use(cors({
  origin: "*",
}));

const server = http.createServer(app);

// Socket setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let waitingQueue = [];

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("find", () => {
    if (waitingQueue.length > 0) {
      const partner = waitingQueue.shift();

      const roomId = socket.id + "-" + partner.id;

      socket.join(roomId);
      partner.join(roomId);

      io.to(roomId).emit("matched", roomId);
    } else {
      waitingQueue.push(socket);
      socket.emit("waiting");
    }
  });

  socket.on("offer", ({ roomId, offer }) => {
    socket.to(roomId).emit("offer", offer);
  });

  socket.on("answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("answer", answer);
  });

  socket.on("ice", ({ roomId, candidate }) => {
    socket.to(roomId).emit("ice", candidate);
  });

  socket.on("next", () => {
    socket.leaveAll();
    socket.emit("waiting");

    if (!waitingQueue.includes(socket)) {
      waitingQueue.push(socket);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    waitingQueue = waitingQueue.filter(u => u.id !== socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
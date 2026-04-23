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

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // 🔍 FIND PARTNER
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

  // 📞 OFFER
  socket.on("offer", ({ offer, room }) => {
    socket.to(room).emit("offer", { offer });
  });

  // 📲 ANSWER
  socket.on("answer", ({ answer, room }) => {
    socket.to(room).emit("answer", { answer });
  });

  // ❄ ICE CANDIDATE (FIXED)
  socket.on("ice-candidate", ({ candidate, room }) => {
    socket.to(room).emit("ice-candidate", { candidate });
  });

  // ⏭ NEXT USER
  socket.on("next", () => {
    socket.leaveAll();
    socket.emit("waiting");

    if (!waitingQueue.includes(socket)) {
      waitingQueue.push(socket);
    }
  });

  // ❌ DISCONNECT
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    waitingQueue = waitingQueue.filter((s) => s.id !== socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
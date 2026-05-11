```javascript id="g2k9vm"
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let waitingUser = null;

io.on("connection", (socket) => {
  console.log("USER CONNECTED:", socket.id);

  socket.on("find", () => {
    if (waitingUser && waitingUser !== socket.id) {

      const roomId = waitingUser + "-" + socket.id;

      socket.join(roomId);

      const waitingSocket = io.sockets.sockets.get(waitingUser);

      if (waitingSocket) {
        waitingSocket.join(roomId);

        io.to(roomId).emit("matched", roomId);

        console.log("MATCHED:", roomId);
      }

      waitingUser = null;

    } else {

      waitingUser = socket.id;

      socket.emit("waiting");
    }
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
    socket.rooms.forEach((room) => {

      if (room !== socket.id) {

        socket.leave(room);

        socket.to(room).emit("partner-disconnected");
      }
    });

    waitingUser = socket.id;

    socket.emit("waiting");
  });

  socket.on("disconnect", () => {
    console.log("DISCONNECTED:", socket.id);

    if (waitingUser === socket.id) {
      waitingUser = null;
    }

    socket.rooms.forEach((room) => {

      if (room !== socket.id) {

        socket.to(room).emit("partner-disconnected");
      }
    });
  });
});

app.get("/", (req, res) => {
  res.send("Server running");
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
```

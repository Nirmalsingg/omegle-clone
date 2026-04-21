import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io("https://omegle-clone-7jpr.onrender.com",{
  transports: ["websocket"],
});

function App() {
  const localVideo = useRef();
  const remoteVideo = useRef();
  const peerConnection = useRef(null);
  const roomId = useRef(null);

  const [status, setStatus] = useState("Click Start");

  useEffect(() => {
    startCamera();

    socket.on("waiting", () => {
      setStatus("Waiting for partner...");
    });

    socket.on("matched", (room) => {
      roomId.current = room;
      setStatus("Connected!");
      createOffer();
    });

    socket.on("offer", async (offer) => {
      await createAnswer(offer);
    });

    socket.on("answer", async (answer) => {
      await peerConnection.current.setRemoteDescription(answer);
    });

    socket.on("ice", async (candidate) => {
      if (candidate) {
        await peerConnection.current.addIceCandidate(candidate);
      }
    });

  }, []);

  // 🎥 CAMERA
  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideo.current.srcObject = stream;
  };

  // 🔗 PEER CONNECTION
  const createPeerConnection = () => {
    peerConnection.current = new RTCPeerConnection({
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    
  ],
});

    const stream = localVideo.current.srcObject;

    stream.getTracks().forEach((track) => {
      peerConnection.current.addTrack(track, stream);
    });

    peerConnection.current.ontrack = (event) => {
      remoteVideo.current.srcObject = event.streams[0];
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice", {
          roomId: roomId.current,
          candidate: event.candidate,
        });
      }
    };
  };

  // 📞 OFFER
  const createOffer = async () => {
    createPeerConnection();

    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);

    socket.emit("offer", {
      roomId: roomId.current,
      offer,
    });
  };

  // 📞 ANSWER
  const createAnswer = async (offer) => {
    createPeerConnection();

    await peerConnection.current.setRemoteDescription(offer);

    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);

    socket.emit("answer", {
      roomId: roomId.current,
      answer,
    });
  };

  return (
    <div style={{ textAlign: "center", background: "#1a002b", minHeight: "100vh", color: "white", paddingTop: "20px" }}>
      
      <h1 style={{ color: "#ff4ecd" }}>Omegle Clone 🔥</h1>
      <h3>{status}</h3>

      <div style={{ margin: "20px" }}>
        <button onClick={() => socket.emit("find")} style={btnStyle}>
          Start
        </button>

        <button onClick={() => socket.emit("next")} style={btnStyle}>
          Next
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
        <video ref={localVideo} autoPlay muted style={videoStyle} />
        <video ref={remoteVideo} autoPlay style={videoStyle} />
      </div>

    </div>
  );
}

const videoStyle = {
  width: "300px",
  borderRadius: "15px",
  border: "2px solid #ff4ecd",
};

const btnStyle = {
  padding: "10px 20px",
  margin: "10px",
  background: "linear-gradient(45deg, #ff4ecd, #8a2be2)",
  border: "none",
  borderRadius: "10px",
  color: "white",
  cursor: "pointer",
  fontSize: "16px",
};

export default App;
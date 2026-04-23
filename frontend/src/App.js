import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io("https://omegle-clone-7jpr.onrender.com", {
  transports: ["websocket"],
});

function App() {
  const localVideo = useRef();
  const remoteVideo = useRef();
  const peerConnection = useRef(null);
  const roomId = useRef(null);

  const [status, setStatus] = useState("Click Start");

  let localStream = useRef(null);

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

    socket.on("offer", async ({ offer }) => {
      await createAnswer(offer);
    });

    socket.on("answer", async ({ answer }) => {
      await peerConnection.current.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    });

    socket.on("ice-candidate", async ({ candidate }) => {
      if (candidate) {
        await peerConnection.current.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      }
    });
  }, []);

  // 🎥 CAMERA
  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStream.current = stream;
    localVideo.current.srcObject = stream;
  };

  // 🔗 PEER CONNECTION
  const createPeerConnection = () => {
    peerConnection.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // send tracks
    localStream.current.getTracks().forEach((track) => {
      peerConnection.current.addTrack(track, localStream.current);
    });

    // receive remote video
    peerConnection.current.ontrack = (event) => {
      remoteVideo.current.srcObject = event.streams[0];
    };

    // send ICE
    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          room: roomId.current,
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
      offer,
      room: roomId.current,
    });
  };

  // 📲 ANSWER
  const createAnswer = async (offer) => {
    createPeerConnection();

    await peerConnection.current.setRemoteDescription(
      new RTCSessionDescription(offer)
    );

    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);

    socket.emit("answer", {
      answer,
      room: roomId.current,
    });
  };

  return (
    <div style={{ textAlign: "center", background: "#1a002b", minHeight: "100vh", color: "white" }}>
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
};

export default App;
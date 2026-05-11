```javascript
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const SIGNALING_URL =
  process.env.REACT_APP_SIGNALING_URL ||
  "https://omegle-clone-1-p24f.onrender.com";

const socket = io(SIGNALING_URL, {
  transports: ["websocket"],
});

function App() {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const peerConnection = useRef(null);
  const localStream = useRef(null);

  const roomId = useRef(null);
  const chatInputRef = useRef(null);

  const [status, setStatus] = useState("Click Start");
  const [messages, setMessages] = useState([]);

  const configuration = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
      {
        urls: "stun:global.stun.twilio.com:3478",
      },
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
    ],
  };

  const addMessage = (text, sender = "system") => {
    setMessages((prev) => [...prev, { text, sender }]);
  };

  const cleanupConnection = () => {
    if (peerConnection.current) {
      peerConnection.current.ontrack = null;
      peerConnection.current.onicecandidate = null;

      peerConnection.current.close();
      peerConnection.current = null;
    }

    if (remoteVideo.current) {
      remoteVideo.current.srcObject = null;
    }
  };

  const createPeerConnection = () => {
    if (peerConnection.current) return;

    peerConnection.current = new RTCPeerConnection(configuration);

    console.log("PEER CONNECTION CREATED");

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        peerConnection.current.addTrack(track, localStream.current);
      });
    }

    peerConnection.current.ontrack = (event) => {
      console.log("REMOTE STREAM RECEIVED");

      if (remoteVideo.current) {
        remoteVideo.current.srcObject = event.streams[0];
      }
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate && roomId.current) {
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          roomId: roomId.current,
        });
      }
    };

    peerConnection.current.onconnectionstatechange = () => {
      console.log(
        "CONNECTION STATE:",
        peerConnection.current.connectionState
      );
    };
  };

  const startCamera = async () => {
    if (localStream.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStream.current = stream;

      if (localVideo.current) {
        localVideo.current.srcObject = stream;
      }
    } catch (err) {
      console.error(err);
      alert("Camera/Microphone permission denied");
    }
  };

  const createOffer = async () => {
    createPeerConnection();

    const offer = await peerConnection.current.createOffer();

    await peerConnection.current.setLocalDescription(offer);

    socket.emit("offer", {
      offer,
      roomId: roomId.current,
    });
  };

  const createAnswer = async (offer) => {
    createPeerConnection();

    await peerConnection.current.setRemoteDescription(
      new RTCSessionDescription(offer)
    );

    const answer = await peerConnection.current.createAnswer();

    await peerConnection.current.setLocalDescription(answer);

    socket.emit("answer", {
      answer,
      roomId: roomId.current,
    });
  };

  useEffect(() => {
    socket.on("waiting", () => {
      setStatus("Waiting for partner...");
    });

    socket.on("matched", async (room) => {
      console.log("MATCHED:", room);

      roomId.current = room;

      setStatus("Connected!");
      setMessages([]);

      const [firstUser] = room.split("-");

      if (socket.id === firstUser) {
        await createOffer();
      }
    });

    socket.on("offer", async (offer) => {
      console.log("OFFER RECEIVED");

      await createAnswer(offer);
    });

    socket.on("answer", async (answer) => {
      console.log("ANSWER RECEIVED");

      if (!peerConnection.current) return;

      await peerConnection.current.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    });

    socket.on("ice-candidate", async (candidate) => {
      console.log("ICE RECEIVED");

      try {
        if (peerConnection.current) {
          await peerConnection.current.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        }
      } catch (err) {
        console.error("ICE ERROR:", err);
      }
    });

    socket.on("message", ({ text, sender }) => {
      addMessage(text, sender);
    });

    socket.on("partner-disconnected", () => {
      cleanupConnection();

      setStatus("Partner disconnected");

      addMessage("Partner disconnected", "system");
    });

    return () => {
      socket.off("waiting");
      socket.off("matched");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("message");
      socket.off("partner-disconnected");
    };
  }, []);

  const handleStart = async () => {
    await startCamera();

    socket.emit("find");
  };

  const handleNext = () => {
    cleanupConnection();

    setMessages([]);

    setStatus("Searching new partner...");

    socket.emit("next");
  };

  const sendMessage = () => {
    const text = chatInputRef.current.value.trim();

    if (!text || !roomId.current) return;

    addMessage(text, "you");

    socket.emit("message", {
      text,
      roomId: roomId.current,
    });

    chatInputRef.current.value = "";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#1a002b",
        color: "white",
        textAlign: "center",
        paddingBottom: "30px",
      }}
    >
      <h1 style={{ color: "#ff4ecd" }}>Omegle Clone 🔥</h1>

      <h2>{status}</h2>

      <div>
        <button style={btnStyle} onClick={handleStart}>
          Start
        </button>

        <button style={btnStyle} onClick={handleNext}>
          Next
        </button>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          marginTop: "30px",
          flexWrap: "wrap",
        }}
      >
        <video
          ref={localVideo}
          autoPlay
          playsInline
          muted
          style={videoStyle}
        />

        <video
          ref={remoteVideo}
          autoPlay
          playsInline
          style={videoStyle}
        />
      </div>

      <div style={chatBoxStyle}>
        <h3>Chat</h3>

        <div style={chatListStyle}>
          {messages.map((msg, index) => (
            <p key={index}>
              <strong>{msg.sender}: </strong>
              {msg.text}
            </p>
          ))}
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <input
            ref={chatInputRef}
            type="text"
            placeholder="Type message..."
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendMessage();
              }
            }}
          />

          <button style={btnStyle} onClick={sendMessage}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

const videoStyle = {
  width: "320px",
  height: "240px",
  borderRadius: "16px",
  border: "2px solid #ff4ecd",
  background: "#11001d",
  objectFit: "cover",
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

const chatBoxStyle = {
  width: "min(700px, 92vw)",
  margin: "30px auto 0",
  background: "#25013d",
  borderRadius: "15px",
  padding: "15px",
  border: "1px solid #7424ac",
};

const chatListStyle = {
  minHeight: "150px",
  maxHeight: "250px",
  overflowY: "auto",
  background: "#170028",
  padding: "10px",
  borderRadius: "10px",
  marginBottom: "10px",
  textAlign: "left",
};

const inputStyle = {
  flex: 1,
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #7424ac",
  background: "#11001d",
  color: "white",
};

export default App;
```

import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const SIGNALING_URL =
  process.env.REACT_APP_SIGNALING_URL || "http://localhost:5000";

const socket = io(SIGNALING_URL, {
  transports: ["websocket"],
});

function App() {
  const localVideo = useRef();
  const remoteVideo = useRef();
  const peerConnection = useRef(null);
  const roomId = useRef(null);
  const localStream = useRef(null);
  const iceQueue = useRef([]);
  const chatInputRef = useRef();

  const [status, setStatus] = useState("Click Start");
  const [messages, setMessages] = useState([]);

  const addMessage = (text, sender = "you") => {
    setMessages((prev) => [...prev, { sender, text }]);
  };

  const destroyPeerConnection = () => {
    if (peerConnection.current) {
      peerConnection.current.onicecandidate = null;
      peerConnection.current.ontrack = null;
      peerConnection.current.close();
      peerConnection.current = null;
    }

    iceQueue.current = [];
    roomId.current = null;
    if (remoteVideo.current) {
      remoteVideo.current.srcObject = null;
    }
  };

  useEffect(() => {
    const onWaiting = () => {
      destroyPeerConnection();
      setMessages([]);
      setStatus("Waiting for partner...");
    };

    const onMatched = (room) => {
      roomId.current = room;
      setMessages([{ sender: "system", text: "You are now connected." }]);
      setStatus("Connected!");

      const [first] = room.split("-");
      if (socket.id === first) {
        createOffer();
      }
    };

    const onOffer = async (offer) => {
      await createAnswer(offer);
    };

    const onAnswer = async (answer) => {
      if (!peerConnection.current) return;

      await peerConnection.current.setRemoteDescription(
        new RTCSessionDescription(answer)
      );

      for (const candidate of iceQueue.current) {
        await peerConnection.current.addIceCandidate(candidate);
      }
      iceQueue.current = [];
    };

    const onIceCandidate = async (candidate) => {
      if (!peerConnection.current) return;

      const rtcCandidate = new RTCIceCandidate(candidate);
      if (peerConnection.current.remoteDescription) {
        await peerConnection.current.addIceCandidate(rtcCandidate);
      } else {
        iceQueue.current.push(rtcCandidate);
      }
    };

    const onMessage = ({ sender, text }) => {
      addMessage(text, sender);
    };

    const onPartnerDisconnected = () => {
      destroyPeerConnection();
      addMessage("Partner disconnected. Click Next to find someone new.", "system");
      setStatus("Partner disconnected");
    };

    socket.on("waiting", onWaiting);
    socket.on("matched", onMatched);
    socket.on("offer", onOffer);
    socket.on("answer", onAnswer);
    socket.on("ice-candidate", onIceCandidate);
    socket.on("message", onMessage);
    socket.on("partner-disconnected", onPartnerDisconnected);

    return () => {
      socket.off("waiting", onWaiting);
      socket.off("matched", onMatched);
      socket.off("offer", onOffer);
      socket.off("answer", onAnswer);
      socket.off("ice-candidate", onIceCandidate);
      socket.off("message", onMessage);
      socket.off("partner-disconnected", onPartnerDisconnected);
      destroyPeerConnection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = async () => {
    if (localStream.current) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStream.current = stream;
    localVideo.current.srcObject = stream;
  };

  const createPeerConnection = () => {
    if (peerConnection.current) return;

    peerConnection.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        peerConnection.current.addTrack(track, localStream.current);
      });
    }

    peerConnection.current.ontrack = (event) => {
      remoteVideo.current.srcObject = event.streams[0];
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate && roomId.current) {
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          roomId: roomId.current,
        });
      }
    };
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

  const handleStart = async () => {
    await startCamera();
    socket.emit("find");
  };

  const handleNext = () => {
    destroyPeerConnection();
    setMessages([]);
    setStatus("Waiting for partner...");
    socket.emit("next");
  };

  const handleSendMessage = () => {
    const text = chatInputRef.current?.value?.trim();
    if (!text || !roomId.current) return;

    addMessage(text, "you");
    socket.emit("message", { text, roomId: roomId.current });
    chatInputRef.current.value = "";
  };

  return (
    <div
      style={{
        textAlign: "center",
        background: "#1a002b",
        minHeight: "100vh",
        color: "white",
        paddingBottom: "24px",
      }}
    >
      <h1 style={{ color: "#ff4ecd" }}>Omegle Clone</h1>
      <h3>{status}</h3>

      <div style={{ margin: "20px" }}>
        <button onClick={handleStart} style={btnStyle}>
          Start
        </button>

        <button onClick={handleNext} style={btnStyle}>
          Next
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
        <video ref={localVideo} autoPlay muted style={videoStyle} />
        <video ref={remoteVideo} autoPlay style={videoStyle} />
      </div>

      <div style={chatBoxStyle}>
        <h4>Chat</h4>
        <div style={chatListStyle}>
          {messages.map((msg, idx) => (
            <p key={`${msg.sender}-${idx}`} style={{ margin: "6px 0" }}>
              <strong>{msg.sender}:</strong> {msg.text}
            </p>
          ))}
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <input
            ref={chatInputRef}
            type="text"
            placeholder="Type message..."
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSendMessage();
            }}
          />
          <button style={btnStyle} onClick={handleSendMessage}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

const videoStyle = {
  width: "300px",
  borderRadius: "15px",
  border: "2px solid #ff4ecd",
  background: "#11001d",
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
  width: "min(640px, 92vw)",
  margin: "24px auto 0",
  textAlign: "left",
  background: "#25013d",
  border: "1px solid #7424ac",
  borderRadius: "12px",
  padding: "12px",
};

const chatListStyle = {
  minHeight: "120px",
  maxHeight: "220px",
  overflowY: "auto",
  background: "#170028",
  borderRadius: "8px",
  padding: "8px 12px",
  marginBottom: "10px",
};

const inputStyle = {
  flex: 1,
  borderRadius: "8px",
  border: "1px solid #6a2f95",
  background: "#130021",
  color: "white",
  padding: "10px",
};

export default App;
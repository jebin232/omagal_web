import React, { useEffect, useRef, useState } from "react";

const SIGNALING_SERVER_URL = "ws://omagal-web.onrender.com"; // ✅ For local testing
// Use wss://yourdomain.com:PORT in production with secure cert

const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
  ],
};

export default function RandomVideoChat() {
  const localVideo = useRef();
  const remoteVideo = useRef();
  const [status, setStatus] = useState("Connecting to signaling server...");
  const [ws, setWs] = useState(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = new WebSocket(SIGNALING_SERVER_URL);
    setWs(socket);

    socket.onopen = () => setStatus("Connected. Waiting for partner...");

    socket.onmessage = async (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === "status") setStatus(data.message);
      if (data.type === "partner-found") await startWebRTC(true);
      if (data.type === "partner-left") {
        setStatus("Partner disconnected. Looking for another...");
        cleanup();
        socket.send(JSON.stringify({ type: "next" }));
      }
      if (data.type === "signal") handleSignal(data.data);
    };

    return () => {
      socket.close();
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (remoteVideo.current) {
      remoteVideo.current.srcObject = null;
    }
    setConnected(false);
  };

  const startWebRTC = async (isInitiator) => {
    setStatus("Partner found! Setting up connection...");
    pcRef.current = new RTCPeerConnection(configuration);

    localStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.current.srcObject = localStreamRef.current;

    localStreamRef.current.getTracks().forEach((track) =>
      pcRef.current.addTrack(track, localStreamRef.current)
    );

    pcRef.current.ontrack = (event) => {
      remoteVideo.current.srcObject = event.streams[0];
    };

    pcRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(JSON.stringify({ type: "signal", data: { candidate: event.candidate } }));
      }
    };

    if (isInitiator) {
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: "signal", data: { sdp: offer } }));
    }

    setConnected(true);
  };

  const handleSignal = async (data) => {
    if (data.sdp) {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
      if (data.sdp.type === "offer") {
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: "signal", data: { sdp: answer } }));
      }
    } else if (data.candidate) {
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (e) {
        console.error("Error adding ice candidate", e);
      }
    }
  };

  const handleNext = () => {
    cleanup();
    ws.send(JSON.stringify({ type: "next" }));
    setStatus("Looking for new partner...");
  };

  const handleEnd = () => {
    cleanup();
    ws.send(JSON.stringify({ type: "end" }));
    setStatus("Call ended.");
  };

  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <h1>🎥 Random Video Chat</h1>
      <p>{status}</p>

      <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: 20 }}>
        <video ref={localVideo} autoPlay muted playsInline width={300} height={200} style={{ background: "#000" }} />
        <video ref={remoteVideo} autoPlay playsInline width={300} height={200} style={{ background: "#000" }} />
      </div>

      <div style={{ marginTop: 20 }}>
        {connected && (
          <>
            <button onClick={handleNext} style={{ marginRight: 10 }}>🔁 Next</button>
            <button onClick={handleEnd}>❌ End</button>
          </>
        )}
      </div>
    </div>
  );
}

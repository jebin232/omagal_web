// RandomVideoChat.jsx
import React, { useEffect, useRef, useState } from "react";

const SIGNALING_SERVER =
  window.location.protocol === "https:"
    ? "wss://bd8d51e8e7f5.ngrok-free.app"
    : "ws://localhost:3001";

let pcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function RandomVideoChat() {
  const [status, setStatus] = useState("Click Start to begin");
  const [socket, setSocket] = useState(null);
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const pcRef = useRef();
  const localStreamRef = useRef();

  useEffect(() => {
    const ws = new WebSocket(SIGNALING_SERVER);
    setSocket(ws);

    ws.onmessage = async (message) => {
      const data = JSON.parse(message.data);
      switch (data.type) {
        case "status":
          setStatus(data.message);
          break;
        case "partner-found":
          setStatus("Partner found, connecting...");
          await makeCall();
          break;
        case "signal":
          await handleSignal(data.data);
          break;
        case "partner-left":
          setStatus("Partner left. Click 'Next' to connect to someone new.");
          remoteVideoRef.current.srcObject = null;
          pcRef.current?.close();
          break;
        default:
          break;
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleStart = async () => {
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localVideoRef.current.srcObject = localStream;
      localStreamRef.current = localStream;
    } catch (err) {
      alert("Failed to get user media: " + err);
      return;
    }
    setStatus("Connecting to signaling server...");
  };

  const makeCall = async () => {
    pcRef.current = new RTCPeerConnection(pcConfig);

    localStreamRef.current.getTracks().forEach((track) => {
      pcRef.current.addTrack(track, localStreamRef.current);
    });

    pcRef.current.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    pcRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.send(
          JSON.stringify({
            type: "signal",
            data: { candidate: event.candidate },
          })
        );
      }
    };

    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);

    socket.send(
      JSON.stringify({
        type: "signal",
        data: { sdp: offer },
      })
    );
  };

  const handleSignal = async (data) => {
    if (data.sdp) {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
      if (data.sdp.type === "offer") {
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.send(
          JSON.stringify({
            type: "signal",
            data: { sdp: answer },
          })
        );
      }
    } else if (data.candidate) {
      await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  };

  const handleNext = () => {
    if (pcRef.current) {
      pcRef.current.close();
    }
    remoteVideoRef.current.srcObject = null;
    socket.send(JSON.stringify({ type: "next" }));
    setStatus("Searching for a new partner...");
  };

  const handleEnd = () => {
    if (pcRef.current) {
      pcRef.current.close();
    }
    remoteVideoRef.current.srcObject = null;
    socket.send(JSON.stringify({ type: "end" }));
    setStatus("Call ended.");
  };

  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <h2>Random Video Chat</h2>
      <p>{status}</p>
      <div>
        <video ref={localVideoRef} autoPlay muted playsInline width={300} />
        <video ref={remoteVideoRef} autoPlay playsInline width={300} />
      </div>
      <br />
      <button onClick={handleStart}>Start</button>
      <button onClick={handleNext}>Next</button>
      <button onClick={handleEnd}>End</button>
    </div>
  );
}

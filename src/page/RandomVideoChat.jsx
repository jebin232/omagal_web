// import React, { useRef, useState } from "react";
// import "./RandomVideoChat.css";

// export default function RandomVideoChat() {
//   const localVideoRef = useRef(null);
//   const remoteVideoRef = useRef(null);
//   const [status, setStatus] = useState("Click Start to begin...");
//   const [connected, setConnected] = useState(false);

//   const handleStart = () => {
//     setStatus("Searching for a stranger...");
//     setConnected(true);
//     // Call backend & WebRTC connection here
//   };

//   const handleNext = () => {
//     setStatus("Connecting to a new person...");
//     // Trigger disconnect + reconnect logic
//   };

//   const handleEnd = () => {
//     setStatus("Call ended.");
//     setConnected(false);
//     // Trigger disconnect logic
//   };

//   return (
//     <div className="chat-container">
//       <h1>Random Video Chat</h1>

//       <div className="video-grid">
//         <div className="video-block">
//           <h3>You</h3>
//           <video ref={localVideoRef} autoPlay muted playsInline />
//         </div>
//         <div className="video-block">
//           <h3>Stranger</h3>
//           <video ref={remoteVideoRef} autoPlay playsInline />
//         </div>
//       </div>

//       <p className="status">{status}</p>

//       <div className="control-buttons">
//         {!connected && <button onClick={handleStart}>Start</button>}
//         {connected && (
//           <>
//             <button onClick={handleNext}>Next</button>
//             <button onClick={handleEnd}>End</button>
//           </>
//         )}
//       </div>
//     </div>
//   );
// }



import React, { useEffect, useRef, useState } from "react";
import "./RandomVideoChat.css";

export default function RandomVideoChat() {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [status, setStatus] = useState("Click Start to begin...");
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);

  const STUN_SERVERS = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
    ],
  };

  // === Start Call ===
  const handleStart = async () => {
    setStatus("Connecting...");
    const ws = new WebSocket("https://bd8d51e8e7f5.ngrok-free.app");
    setSocket(ws);

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localStreamRef.current = stream;
    localVideoRef.current.srcObject = stream;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join" }));
      setStatus("Waiting for partner...");
      setConnected(true);
    };

    ws.onmessage = async (msg) => {
      const data = JSON.parse(msg.data);

      if (data.type === "partner-found") {
        setStatus("Partner found! Connecting...");

        peerRef.current = createPeer(ws, true);
        localStreamRef.current.getTracks().forEach((track) => {
          peerRef.current.addTrack(track, localStreamRef.current);
        });
      }

      if (data.type === "signal" && peerRef.current) {
        if (data.data.sdp) {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.data.sdp));
          if (data.data.sdp.type === "offer") {
            const answer = await peerRef.current.createAnswer();
            await peerRef.current.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: "signal", data: { sdp: peerRef.current.localDescription } }));
          }
        } else if (data.data.candidate) {
          try {
            await peerRef.current.addIceCandidate(new RTCIceCandidate(data.data.candidate));
          } catch (e) {
            console.error("Error adding ICE candidate", e);
          }
        }
      }

      if (data.type === "partner-left") {
        setStatus("Partner disconnected.");
        closePeer();
      }

      if (data.type === "status") {
        setStatus(data.message);
      }
    };

    ws.onclose = () => {
      setStatus("Disconnected from server.");
      setConnected(false);
      closePeer();
    };
  };

  // === Next Button ===
  const handleNext = () => {
    if (socket) socket.send(JSON.stringify({ type: "next" }));
    setStatus("Searching for a new partner...");
    closePeer();
  };

  // === End Button ===
  const handleEnd = () => {
    if (socket) socket.send(JSON.stringify({ type: "end" }));
    closePeer();
    setStatus("Call ended.");
    setConnected(false);
  };

  // === Cleanup ===
  const closePeer = () => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  // === Create Peer ===
  const createPeer = (ws, initiator) => {
    const peer = new RTCPeerConnection(STUN_SERVERS);

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(JSON.stringify({ type: "signal", data: { candidate: event.candidate } }));
      }
    };

    peer.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    if (initiator) {
      peer.onnegotiationneeded = async () => {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: "signal", data: { sdp: offer } }));
      };
    }

    return peer;
  };

  useEffect(() => {
    return () => {
      if (socket) socket.close();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      closePeer();
    };
  }, []);

  return (
    <div className="chat-container">
      <h1>Random Video Chat</h1>

      <div className="video-grid">
        <div className="video-block">
          <h3>You</h3>
          <video ref={localVideoRef} autoPlay muted playsInline />
        </div>
        <div className="video-block">
          <h3>Stranger</h3>
          <video ref={remoteVideoRef} autoPlay playsInline />
        </div>
      </div>

      <p className="status">{status}</p>

      <div className="control-buttons">
        {!connected && <button onClick={handleStart}>Start</button>}
        {connected && (
          <>
            <button onClick={handleNext}>Next</button>
            <button onClick={handleEnd}>End</button>
          </>
        )}
      </div>
    </div>
  );
}

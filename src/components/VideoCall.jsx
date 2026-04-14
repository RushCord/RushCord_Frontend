import React, { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";

const servers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export default function VideoCall({
  myId,
  remoteId,
  incomingOffer: propIncomingOffer,
  onEnd,
}) {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const pc = useRef(null);
  const [stream, setStream] = useState(null);
  const [callStatus, setCallStatus] = useState("idle"); // idle, calling, connected, ended
  const [error, setError] = useState(null);
  const socket = useAuthStore((s) => s.socket);
  const [incomingCaller, setIncomingCaller] = useState(null);
  const [incomingOffer, setIncomingOffer] = useState(null);
  // const incomingCall = useAuthStore((s) => s.incomingCall);
  // const clearIncomingCall = useAuthStore((s) => s.clearIncomingCall);

  // =========================
  // INIT PEER
  // =========================
  useEffect(() => {
    // Only create peer connection if we don't have incoming offer
    // For incoming calls, we'll create it in acceptCall
    if (!propIncomingOffer && !pc.current) {
      pc.current = new RTCPeerConnection(servers);

      // nhận video remote
      pc.current.ontrack = (event) => {
        console.log("📺 Received remote stream");
        let remoteStream = event.streams?.[0];
        if (!remoteStream && event.track) {
          remoteStream = new MediaStream();
          remoteStream.addTrack(event.track);
        }
        if (remoteVideo.current && remoteStream) {
          remoteVideo.current.srcObject = remoteStream;
        }
      };

      // gửi ICE
      pc.current.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit("iceCandidate", {
            to: remoteId,
            from: myId,
            candidate: event.candidate,
          });
        }
      };

      // theo dõi trạng thái connection
      pc.current.oniceconnectionstatechange = () => {
        console.log("🌐 ICE Connection State:", pc.current.iceConnectionState);
        if (
          pc.current.iceConnectionState === "connected" ||
          pc.current.iceConnectionState === "completed"
        ) {
          setCallStatus("connected");
        }
        if (
          pc.current.iceConnectionState === "disconnected" ||
          pc.current.iceConnectionState === "failed" ||
          pc.current.iceConnectionState === "closed"
        ) {
          setCallStatus("ended");
          endCall();
        }
      };

      pc.current.onconnectionstatechange = () => {
        console.log("📡 Connection State:", pc.current.connectionState);
      };
    }

    return () => {
      try {
        pc.current?.close();
      } catch (e) {}
      pc.current = null;
    };
  }, [propIncomingOffer]); // Only run when propIncomingOffer changes

  // =========================
  // LISTEN ICE CANDIDATES
  // =========================
  useEffect(() => {
    const handleIceCandidate = async ({ from, candidate }) => {
      if (from !== remoteId) return;

      try {
        if (candidate && pc.current) {
          await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error("❌ addIceCandidate error:", err);
      }
    };

    if (socket) {
      socket.on("iceCandidate", handleIceCandidate);

      return () => {
        socket.off("iceCandidate", handleIceCandidate);
      };
    }

    return () => {};
  }, [remoteId, socket]);

  // =========================
  // START MEDIA
  // =========================
  const startMedia = async () => {
    try {
      if (stream) return; // Media đã được khởi động

      const localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });

      console.log("🎥 Got local stream");

      if (localVideo.current) {
        localVideo.current.srcObject = localStream;
      }

      setStream(localStream);

      // Thêm tracks vào peer connection nếu đã tồn tại
      if (pc.current) {
        localStream.getTracks().forEach((track) => {
          pc.current.addTrack(track, localStream);
        });
      }

      return localStream;
    } catch (err) {
      const errorMsg = `❌ getUserMedia error: ${err.message}`;
      console.error(errorMsg);
      setError(errorMsg);
      throw err;
    }
  };

  // =========================
  // CALL USER (INITIATE)
  // =========================
  const callUser = async () => {
    console.log("📞 callUser called for remoteId:", remoteId);
    try {
      setCallStatus("calling");

      // Bắt đầu media trước khi tạo offer
      console.log("📹 Starting media...");
      await startMedia();

      // Chờ RTCPeerConnection sẵn sàng
      if (!pc.current || pc.current.signalingState === "closed") {
        throw new Error("RTCPeerConnection not ready");
      }

      console.log("📤 Creating offer...");
      const offer = await pc.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      console.log("📤 Setting local description...");
      await pc.current.setLocalDescription(offer);
      console.log(
        "📡 Signaling state after setLocalDescription:",
        pc.current.signalingState,
      );

      console.log("📤 Sending offer to", remoteId);

      if (!socket) {
        const msg = "No signaling socket connected";
        console.error(msg);
        setError(msg);
        setCallStatus("idle");
        return;
      }

      socket.emit("callUser", {
        to: remoteId,
        from: myId,
        offer: offer,
      });
      console.log("✅ Offer sent, waiting for answer...");
    } catch (err) {
      const errorMsg = `❌ callUser error: ${err.message}`;
      console.error(errorMsg);
      setError(errorMsg);
      setCallStatus("idle");
    }
  };

  // If there is a prop incomingOffer, auto-accept when component mounts
  useEffect(() => {
    console.log("🔄 useEffect auto-accept check:", {
      propIncomingOffer: !!propIncomingOffer,
      remoteId,
    });
    if (propIncomingOffer && remoteId) {
      console.log("🔄 Auto-accepting incoming call from prop");
      // auto-accept when VideoCall mounted with offer
      (async () => {
        try {
          await acceptCall();
        } catch (e) {
          console.error("Auto-accept failed:", e);
        }
      })();
    }
  }, [propIncomingOffer, remoteId]);

  // Accept incoming call: create answer and send
  const acceptCall = async () => {
    console.log(
      "🎯 acceptCall called with propIncomingOffer:",
      !!propIncomingOffer,
    );
    if (!propIncomingOffer) {
      console.error("❌ No propIncomingOffer to accept");
      return;
    }

    try {
      console.log("📹 Starting media for accept...");
      const localStream = await startMedia();

      // Reset peer connection if it's in wrong state
      if (pc.current && pc.current.signalingState !== "stable") {
        console.log(
          "🔄 Resetting peer connection, current state:",
          pc.current.signalingState,
        );
        pc.current.close();
        pc.current = null;
      }

      if (!pc.current) {
        pc.current = new RTCPeerConnection(servers);

        // nhận video remote
        pc.current.ontrack = (event) => {
          console.log("📺 Received remote stream");
          let remoteStream = event.streams?.[0];
          if (!remoteStream && event.track) {
            remoteStream = new MediaStream();
            remoteStream.addTrack(event.track);
          }
          if (remoteVideo.current && remoteStream) {
            remoteVideo.current.srcObject = remoteStream;
          }
        };

        // gửi ICE
        pc.current.onicecandidate = (event) => {
          if (event.candidate && socket) {
            socket.emit("iceCandidate", {
              to: remoteId,
              from: myId,
              candidate: event.candidate,
            });
          }
        };

        // theo dõi trạng thái connection
        pc.current.oniceconnectionstatechange = () => {
          console.log(
            "🌐 ICE Connection State:",
            pc.current.iceConnectionState,
          );
          if (
            pc.current.iceConnectionState === "connected" ||
            pc.current.iceConnectionState === "completed"
          ) {
            setCallStatus("connected");
          }
          if (
            pc.current.iceConnectionState === "disconnected" ||
            pc.current.iceConnectionState === "failed" ||
            pc.current.iceConnectionState === "closed"
          ) {
            setCallStatus("ended");
            endCall();
          }
        };

        pc.current.onconnectionstatechange = () => {
          console.log("📡 Connection State:", pc.current.connectionState);
        };

        // Add local stream tracks to peer connection
        if (localStream) {
          localStream.getTracks().forEach((track) => {
            pc.current.addTrack(track, localStream);
          });
        }
      }

      if (pc.current.signalingState === "closed") {
        throw new Error("RTCPeerConnection is closed");
      }

      console.log("📥 Setting remote description...");
      await pc.current.setRemoteDescription(
        new RTCSessionDescription(propIncomingOffer),
      );
      console.log(
        "📥 Remote description set, signaling state:",
        pc.current.signalingState,
      );

      console.log("📤 Creating answer...");
      if (pc.current.signalingState !== "have-remote-offer") {
        console.error(
          "❌ Invalid signaling state for createAnswer:",
          pc.current.signalingState,
        );
        throw new Error(
          `Cannot create answer in state: ${pc.current.signalingState}`,
        );
      }
      const answer = await pc.current.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      console.log("📤 Setting local description...");
      await pc.current.setLocalDescription(answer);

      if (!socket) throw new Error("No signaling socket");

      console.log("📤 Sending answer to", remoteId); // use remoteId as caller
      socket.emit("answerCall", {
        to: remoteId,
        from: myId,
        answer,
      });

      setCallStatus("calling"); // Đợi ICE state chuyển sang connected mới set connected
      console.log("✅ Accept call completed, waiting for ICE connection...");
    } catch (err) {
      const errorMsg = `❌ acceptCall error: ${err.message}`;
      console.error(errorMsg);
      setError(errorMsg);
      setCallStatus("idle");
    }
  };

  const declineCall = () => {
    if (socket && incomingCaller) {
      socket.emit("hangup", { to: incomingCaller, from: myId });
    }
    setIncomingCaller(null);
    setIncomingOffer(null);
    setCallStatus("idle");
  };

  // =========================
  // LISTEN CALL ANSWERED
  // =========================
  useEffect(() => {
    const handleCallAnswered = async ({ from, answer }) => {
      console.log("✅ Call answered from", from, "with answer:", !!answer);
      console.log("📡 Current signaling state:", pc.current?.signalingState);

      if (from !== remoteId) {
        console.log("❌ Answer from wrong user:", from, "expected:", remoteId);
        return;
      }

      try {
        if (!pc.current || pc.current.signalingState === "closed") {
          throw new Error("RTCPeerConnection not ready");
        }

        if (pc.current.signalingState !== "have-local-offer") {
          console.error(
            "❌ Invalid signaling state for setRemoteDescription:",
            pc.current.signalingState,
          );
          throw new Error(
            `Cannot set remote answer in state: ${pc.current.signalingState}`,
          );
        }

        console.log("📥 Setting remote description from answer...");
        await pc.current.setRemoteDescription(
          new RTCSessionDescription(answer),
        );
        setCallStatus("connected");
        console.log("✅ Remote description set, call should be connected now");
      } catch (err) {
        const errorMsg = `❌ setRemoteDescription error: ${err.message}`;
        console.error(errorMsg);
        setError(errorMsg);
      }
    };

    if (socket) {
      console.log("👂 Listening for callAnswered events");
      socket.on("callAnswered", handleCallAnswered);

      return () => {
        socket.off("callAnswered", handleCallAnswered);
      };
    }

    return () => {};
  }, [remoteId, myId]);

  // =========================
  // LISTEN HANGUP FROM REMOTE
  // =========================
  useEffect(() => {
    const handleHangup = ({ from }) => {
      if (from !== remoteId) return;
      // remote ended the call
      endCall();
    };

    if (socket) {
      socket.on("hangup", handleHangup);
      return () => socket.off("hangup", handleHangup);
    }

    return () => {};
  }, [remoteId, socket]);

  // =========================
  // CALL INITIATED AUTOMATICALLY
  // =========================
  useEffect(() => {
    // Khi component mount và có remoteId, tự động gọi (chỉ khi không có incomingOffer)
    if (remoteId && callStatus === "idle" && !propIncomingOffer) {
      const timer = setTimeout(() => {
        callUser();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [remoteId, callStatus, propIncomingOffer]);

  // =========================
  // END CALL
  // =========================
  const endCall = () => {
    console.log("❌ Ending call");

    if (socket && remoteId) {
      console.log("🔚 Emitting hangup to remote", remoteId);
      socket.emit("hangup", { to: remoteId, from: myId });
    }

    // Đóng peer connection
    if (pc.current && pc.current.signalingState !== "closed") {
      pc.current.close();
    }

    // Dừng tất cả tracks
    stream?.getTracks().forEach((track) => {
      track.stop();
    });

    // Xóa video elements
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;

    setStream(null);
    setError(null);

    // reset peer
    pc.current = null;

    if (callStatus !== "ended") setCallStatus("ended");
    onEnd && onEnd();
  };

  return (
    <div className="w-full max-w-2xl bg-gray-900 rounded-lg p-4">
      <h2 className="text-white text-lg font-bold mb-3 flex items-center gap-2">
        <span>📹</span>
        <span>Video Call</span>
        <span
          className={`ml-auto text-sm px-2 py-1 rounded ${
            callStatus === "idle"
              ? "bg-gray-700"
              : callStatus === "calling"
                ? "bg-yellow-600"
                : callStatus === "connected"
                  ? "bg-green-600"
                  : "bg-red-600"
          }`}
        >
          {callStatus === "idle"
            ? "Idle"
            : callStatus === "calling"
              ? "Calling..."
              : callStatus === "connected"
                ? "Connected"
                : "Ended"}
        </span>
      </h2>

      {error && (
        <div className="mb-3 bg-red-900/50 text-red-200 p-2 rounded text-sm">
          ⚠️ {error}
        </div>
      )}

      <div className="mb-3 flex gap-2">
        <button
          onClick={callUser}
          disabled={
            callStatus === "calling" || callStatus === "connected" || !stream
          }
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <span>📞</span>
          {callStatus === "connected" ? "Connected" : "Call"}
        </button>

        <button
          onClick={endCall}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <span>❌</span>
          End
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-black rounded-lg overflow-hidden">
          <p className="text-white text-xs p-2 bg-gray-800">You</p>
          <video
            ref={localVideo}
            autoPlay
            playsInline
            muted
            className="w-full h-64 object-cover bg-black"
          />
        </div>

        <div className="bg-black rounded-lg overflow-hidden">
          <p className="text-white text-xs p-2 bg-gray-800">Remote</p>
          <video
            ref={remoteVideo}
            autoPlay
            playsInline
            className="w-full h-64 object-cover bg-black"
          />
        </div>
      </div>
    </div>
  );
}

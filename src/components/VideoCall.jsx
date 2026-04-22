import React, { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";

const servers = {
  iceServers: [
    // STUN helps for NAT discovery (can still fall back to TURN).
    { urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] },
    // TURN for cross-network / symmetric NAT.
    // Order matters: prefer UDP (best media), then TCP fallback, then TLS fallback for strict networks.
    {
      urls: [
        "turn:turn.oeb20412.com:3478?transport=tcp",
        "turns:turn.oeb20412.com:5349?transport=tcp",
        "turn:turn.oeb20412.com:3478?transport=udp",
      ],
      username: "rushcord",
      credential: "67696162616f",
    },
  ],
  // Prefer direct P2P when possible; TURN will be used as needed.
  // (Use "relay" only for debugging / forcing TURN.)
  iceTransportPolicy: "all",
};

export default function VideoCall({
  myId,
  remoteId,
  incomingOffer: propIncomingOffer,
  autoStart = false,
  forceEndSignal = 0,
  onEnd,
}) {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const pc = useRef(null);
  const [stream, setStream] = useState(null);
  const [callStatus, setCallStatus] = useState("idle"); // idle, calling, connected, ended
  const [error, setError] = useState(null);
  const socket = useAuthStore((s) => s.socket);
  const clearIncomingCall = useAuthStore((s) => s.clearIncomingCall);
  const [incomingCaller, setIncomingCaller] = useState(null);
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [cameras, setCameras] = useState([]); // [{ deviceId, label }]
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [microphones, setMicrophones] = useState([]); // [{ deviceId, label }]
  const [selectedMicId, setSelectedMicId] = useState("");
  const [speakers, setSpeakers] = useState([]); // [{ deviceId, label }]
  const [selectedSpeakerId, setSelectedSpeakerId] = useState("");
  const [speakerSupported, setSpeakerSupported] = useState(true);
  const acceptOnceRef = useRef(false);
  const pendingCandidatesRef = useRef([]); // RTCIceCandidateInit[]
  const latestRef = useRef({ myId, remoteId, socket });
  const iceRecoveryTimerRef = useRef(null);
  const iceRestartInFlightRef = useRef(false);
  // const incomingCall = useAuthStore((s) => s.incomingCall);
  // const clearIncomingCall = useAuthStore((s) => s.clearIncomingCall);

  const flushPendingIceCandidates = async () => {
    const pcRef = pc.current;
    if (!pcRef) return;
    if (!pcRef.remoteDescription) return;

    const pending = pendingCandidatesRef.current;
    if (!pending.length) return;
    pendingCandidatesRef.current = [];

    for (const c of pending) {
      try {
        // null candidate means end-of-candidates; safe to ignore
        if (c) await pcRef.addIceCandidate(new RTCIceCandidate(c));
      } catch (err) {
        console.error("❌ flush addIceCandidate error:", err);
      }
    }
  };

  const waitForIceGatheringComplete = async (peer, timeoutMs = 2000) => {
    if (!peer) return;
    if (peer.iceGatheringState === "complete") return;

    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        try {
          peer.removeEventListener?.("icegatheringstatechange", onChange);
        } catch {}
        clearTimeout(timer);
        resolve();
      };

      const onChange = () => {
        if (peer.iceGatheringState === "complete") finish();
      };

      const timer = setTimeout(finish, timeoutMs);

      try {
        peer.addEventListener?.("icegatheringstatechange", onChange);
      } catch {
        // Fallback: wait until timeout
      }
    });
  };

  const clearIceRecoveryTimer = () => {
    if (iceRecoveryTimerRef.current) {
      clearTimeout(iceRecoveryTimerRef.current);
      iceRecoveryTimerRef.current = null;
    }
  };

  const maybeRestartIce = async (reason) => {
    const pcRef = pc.current;
    if (!pcRef) return;
    if (pcRef.signalingState === "closed") return;
    if (!pcRef.currentRemoteDescription || !pcRef.currentLocalDescription) return;
    if (iceRestartInFlightRef.current) return;

    iceRestartInFlightRef.current = true;
    try {
      console.log("🔁 ICE restart requested:", reason);
      // Prefer native restartIce when available.
      if (typeof pcRef.restartIce === "function") {
        pcRef.restartIce();
        return;
      }
      const offer = await pcRef.createOffer({ iceRestart: true });
      await pcRef.setLocalDescription(offer);
      const { socket: s, remoteId: rid, myId: mid } = latestRef.current || {};
      if (s && rid && mid) {
        s.emit("callUser", { to: rid, from: mid, offer });
      }
    } catch (e) {
      console.error("❌ ICE restart failed:", e);
    } finally {
      // allow another attempt after a short cool-down
      setTimeout(() => {
        iceRestartInFlightRef.current = false;
      }, 1500);
    }
  };

  const attachPeerHandlers = (peer) => {
    if (!peer) return;

    // nhận video remote
    peer.ontrack = (event) => {
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
    peer.onicecandidate = (event) => {
      const { socket: s, remoteId: rid, myId: mid } = latestRef.current || {};
      if (event.candidate && s && rid && mid) {
        s.emit("iceCandidate", {
          to: rid,
          from: mid,
          candidate: event.candidate,
        });
      }
    };

    peer.oniceconnectionstatechange = () => {
      const state = peer.iceConnectionState;
      console.log("🌐 ICE Connection State:", state);

      if (state === "connected" || state === "completed") {
        clearIceRecoveryTimer();
        setCallStatus("connected");
        return;
      }

      // "disconnected" can be transient (wifi<->4g, NAT rebinding). Don't end immediately.
      if (state === "disconnected") {
        clearIceRecoveryTimer();
        iceRecoveryTimerRef.current = setTimeout(async () => {
          // Re-check state after grace period
          const now = peer.iceConnectionState;
          if (now === "disconnected") {
            await maybeRestartIce("disconnected-timeout");
          }
        }, 8000);
        return;
      }

      if (state === "failed") {
        clearIceRecoveryTimer();
        // Attempt ICE restart once, then let onconnectionstatechange decide if we must end.
        maybeRestartIce("failed");
        return;
      }

      if (state === "closed") {
        clearIceRecoveryTimer();
        setCallStatus("ended");
        endCall({ sendHangup: false });
      }
    };

    peer.onconnectionstatechange = () => {
      const st = peer.connectionState;
      console.log("📡 Connection State:", st);
      // If the transport truly fails, close.
      if (st === "failed") {
        clearIceRecoveryTimer();
        endCall({ sendHangup: true });
      }
    };
  };

  const refreshDevices = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices
        .filter((d) => d.kind === "videoinput")
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${idx + 1}`,
        }));
      setCameras(cams);
      if (!selectedCameraId && cams[0]?.deviceId) {
        setSelectedCameraId(cams[0].deviceId);
      }

      const mics = devices
        .filter((d) => d.kind === "audioinput")
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${idx + 1}`,
        }));
      setMicrophones(mics);
      if (!selectedMicId && mics[0]?.deviceId) {
        setSelectedMicId(mics[0].deviceId);
      }

      const outs = devices
        .filter((d) => d.kind === "audiooutput")
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${idx + 1}`,
        }));
      setSpeakers(outs);
      if (!selectedSpeakerId && outs[0]?.deviceId) {
        setSelectedSpeakerId(outs[0].deviceId);
      }
    } catch (e) {
      // ignore device enumeration errors
    }
  };

  const applySpeaker = async (deviceId) => {
    try {
      const el = remoteVideo.current;
      if (!el) return;
      const fn = el.setSinkId;
      if (typeof fn !== "function") {
        setSpeakerSupported(false);
        return;
      }
      setSpeakerSupported(true);
      await fn.call(el, deviceId || "");
      setSelectedSpeakerId(deviceId || "");
    } catch (err) {
      // Some browsers require secure context / user gesture
      const msg = `❌ setSinkId error: ${err.message}`;
      console.error(msg);
      setError(msg);
    }
  };

  // =========================
  // INIT PEER
  // =========================
  useEffect(() => {
    latestRef.current = { myId, remoteId, socket };
  }, [myId, remoteId, socket]);

  useEffect(() => {
    // Only create peer connection if we don't have incoming offer
    // For incoming calls, we'll create it in acceptCall
    if (!propIncomingOffer && !pc.current) {
      pc.current = new RTCPeerConnection(servers);
      attachPeerHandlers(pc.current);
    }

    return () => {
      clearIceRecoveryTimer();
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
      // Some flows can momentarily have mismatched/empty remoteId during mount.
      // Don't drop candidates unless we are sure they belong to another peer.
      if (remoteId && from && from !== remoteId) return;

      try {
        if (!candidate) return;
        if (!pc.current) {
          pendingCandidatesRef.current.push(candidate);
          return;
        }
        if (!pc.current.remoteDescription) {
          pendingCandidatesRef.current.push(candidate);
          return;
        }

        await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
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
  // HANDLE RENEGOTIATION / GLARE
  // If we are already in a call with `remoteId`, treat `incomingCall` offers
  // as renegotiation (incl. ICE restart) and auto-answer (no UI accept needed).
  // =========================
  useEffect(() => {
    const handleIncomingCallOffer = async ({ from, offer }) => {
      try {
        if (!from || from !== remoteId) return;
        if (!offer) return;
        if (!pc.current || pc.current.signalingState === "closed") return;

        // If we aren't in an active call flow, let ChatContainer handle accept UI.
        if (callStatus === "idle" || callStatus === "ended") return;

        console.log("🔁 Renegotiation offer received from", from);

        // Clear the global incoming call toast/prompt (we're handling it in-call).
        try {
          clearIncomingCall?.();
        } catch {}

        const peer = pc.current;

        // Perfect-negotiation style: if we have a local offer in flight, rollback.
        if (peer.signalingState !== "stable") {
          try {
            await peer.setLocalDescription({ type: "rollback" });
          } catch (e) {
            // Some browsers may not support rollback; continue best-effort.
          }
        }

        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        await flushPendingIceCandidates();

        const answer = await peer.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await peer.setLocalDescription(answer);
        await waitForIceGatheringComplete(peer, 2000);

        if (socket) {
          socket.emit("answerCall", {
            to: from,
            from: myId,
            answer: peer.localDescription || answer,
          });
        }
      } catch (e) {
        console.error("❌ renegotiation handling failed:", e);
      }
    };

    if (!socket) return () => {};
    socket.on("incomingCall", handleIncomingCallOffer);
    return () => socket.off("incomingCall", handleIncomingCallOffer);
  }, [socket, remoteId, myId, callStatus, clearIncomingCall]);

  // =========================
  // START MEDIA
  // =========================
  const startMedia = async (opts = {}) => {
    try {
      const { videoDeviceId, audioDeviceId } = opts;
      if (stream) return stream; // Media đã được khởi động

      const videoConstraints =
        typeof videoDeviceId === "string" && videoDeviceId
          ? {
              deviceId: { exact: videoDeviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : { width: { ideal: 1280 }, height: { ideal: 720 } };

      const audioConstraints =
        typeof audioDeviceId === "string" && audioDeviceId
          ? { deviceId: { exact: audioDeviceId } }
          : true;

      const localStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: audioConstraints,
      });

      console.log("🎥 Got local stream");

      if (localVideo.current) {
        localVideo.current.srcObject = localStream;
      }

      setStream(localStream);

      // Thêm tracks vào peer connection nếu đã tồn tại (chỉ add nếu chưa có sender cho kind đó)
      if (pc.current) {
        const senders = pc.current.getSenders?.() || [];
        localStream.getTracks().forEach((track) => {
          const hasSenderForKind = senders.some((s) => s.track?.kind === track.kind);
          if (!hasSenderForKind) {
            pc.current.addTrack(track, localStream);
          }
        });
      }

      // refresh device list (labels become available after permission)
      refreshDevices();

      return localStream;
    } catch (err) {
      const errorMsg = `❌ getUserMedia error: ${err.message}`;
      console.error(errorMsg);
      setError(errorMsg);
      throw err;
    }
  };

  const switchCamera = async (nextDeviceId) => {
    try {
      if (!nextDeviceId) return;
      if (!pc.current) {
        setSelectedCameraId(nextDeviceId);
        await startMedia({ videoDeviceId: nextDeviceId });
        return;
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: nextDeviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false, // keep existing mic track if any
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) throw new Error("No video track from selected camera");

      // update local preview but keep audio from existing stream
      const prevStream = stream;
      const combined = new MediaStream();
      const prevAudio = prevStream?.getAudioTracks?.() || [];
      prevAudio.forEach((t) => combined.addTrack(t));
      combined.addTrack(newVideoTrack);
      if (localVideo.current) localVideo.current.srcObject = combined;

      // replace outgoing track (no renegotiation needed)
      const sender =
        pc.current
          .getSenders?.()
          ?.find((s) => s.track && s.track.kind === "video") || null;

      if (sender?.replaceTrack) {
        await sender.replaceTrack(newVideoTrack);
      } else {
        // fallback: add track if no sender yet
        pc.current.addTrack(newVideoTrack, combined);
      }

      // stop old camera track
      try {
        prevStream?.getVideoTracks?.().forEach((t) => t.stop());
      } catch (e) {}
      // stop temp stream tracks except the one we now own (video track is in use, but temp stream can be stopped safely)
      try {
        newStream.getTracks().forEach((t) => {
          if (t !== newVideoTrack) t.stop();
        });
      } catch (e) {}

      setStream(combined);
      setSelectedCameraId(nextDeviceId);
      refreshDevices();
    } catch (err) {
      const errorMsg = `❌ switchCamera error: ${err.message}`;
      console.error(errorMsg);
      setError(errorMsg);
    }
  };

  const switchMicrophone = async (nextDeviceId) => {
    try {
      if (!nextDeviceId) return;
      if (!pc.current) {
        setSelectedMicId(nextDeviceId);
        await startMedia({ videoDeviceId: selectedCameraId, audioDeviceId: nextDeviceId });
        return;
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: { deviceId: { exact: nextDeviceId } },
      });
      const newAudioTrack = newStream.getAudioTracks()[0];
      if (!newAudioTrack) throw new Error("No audio track from selected microphone");

      const prevStream = stream;
      const combined = new MediaStream();
      const prevVideo = prevStream?.getVideoTracks?.() || [];
      prevVideo.forEach((t) => combined.addTrack(t));
      combined.addTrack(newAudioTrack);
      if (localVideo.current) localVideo.current.srcObject = combined;

      const sender =
        pc.current
          .getSenders?.()
          ?.find((s) => s.track && s.track.kind === "audio") || null;

      if (sender?.replaceTrack) {
        await sender.replaceTrack(newAudioTrack);
      } else {
        pc.current.addTrack(newAudioTrack, combined);
      }

      try {
        prevStream?.getAudioTracks?.().forEach((t) => t.stop());
      } catch (e) {}
      try {
        newStream.getTracks().forEach((t) => {
          if (t !== newAudioTrack) t.stop();
        });
      } catch (e) {}

      setStream(combined);
      setSelectedMicId(nextDeviceId);
      refreshDevices();
    } catch (err) {
      const errorMsg = `❌ switchMicrophone error: ${err.message}`;
      console.error(errorMsg);
      setError(errorMsg);
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
      await startMedia({ videoDeviceId: selectedCameraId, audioDeviceId: selectedMicId });

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
      // Reduce reliance on trickle ICE (prevents missing early candidates when callee just mounted).
      await waitForIceGatheringComplete(pc.current, 2000);
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
        offer: pc.current.localDescription || offer,
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
      if (acceptOnceRef.current) {
        console.log("ℹ️ acceptCall already handled; skipping");
        return;
      }
      acceptOnceRef.current = true;

      console.log("📹 Starting media for accept...");
      const localStream = await startMedia({ videoDeviceId: selectedCameraId, audioDeviceId: selectedMicId });

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
        attachPeerHandlers(pc.current);

        // Add local stream tracks to peer connection
        if (localStream) {
          const senders = pc.current.getSenders?.() || [];
          localStream.getTracks().forEach((track) => {
            const hasSenderForKind = senders.some((s) => s.track?.kind === track.kind);
            if (!hasSenderForKind) pc.current.addTrack(track, localStream);
          });
        }
      }

      if (pc.current.signalingState === "closed") {
        throw new Error("RTCPeerConnection is closed");
      }

      // If remote offer already applied, don't apply again.
      const existingRemote = pc.current.currentRemoteDescription;
      if (existingRemote?.type !== "offer") {
        console.log("📥 Setting remote description...");
        await pc.current.setRemoteDescription(
          new RTCSessionDescription(propIncomingOffer),
        );
        await flushPendingIceCandidates();
      } else {
        console.log("ℹ️ Remote offer already set; skipping setRemoteDescription");
      }
      console.log(
        "📥 Remote description set, signaling state:",
        pc.current.signalingState,
      );

      console.log("📤 Creating answer...");
      // If we already answered, don't answer again.
      const existingLocal = pc.current.currentLocalDescription;
      if (existingLocal?.type === "answer") {
        console.log("ℹ️ Local answer already set; skipping answer creation");
        setCallStatus("calling");
        return;
      }

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
      await waitForIceGatheringComplete(pc.current, 2000);

      if (!socket) throw new Error("No signaling socket");

      console.log("📤 Sending answer to", remoteId); // use remoteId as caller
      socket.emit("answerCall", {
        to: remoteId,
        from: myId,
        answer: pc.current.localDescription || answer,
      });

      setCallStatus("calling"); // Đợi ICE state chuyển sang connected mới set connected
      console.log("✅ Accept call completed, waiting for ICE connection...");
    } catch (err) {
      acceptOnceRef.current = false;
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

        // If we already have an answer applied, ignore duplicates / late packets.
        const existingRemote = pc.current.currentRemoteDescription;
        if (existingRemote?.type === "answer") {
          console.log("ℹ️ Remote answer already set; ignoring duplicate");
          setCallStatus("connected");
          return;
        }

        // Common valid state is "have-local-offer".
        // Some browsers/flows can already be "stable" when the answer arrives (race / already applied).
        const state = pc.current.signalingState;
        const canApplyAnswer =
          state === "have-local-offer" ||
          (state === "stable" && !pc.current.currentRemoteDescription);

        if (!canApplyAnswer) {
          console.error("❌ Invalid state for remote answer:", state);
          throw new Error(`Cannot set remote answer in state: ${state}`);
        }

        console.log("📥 Setting remote description from answer...");
        await pc.current.setRemoteDescription(
          new RTCSessionDescription(answer),
        );
        await flushPendingIceCandidates();
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
  }, [remoteId, myId, socket]);

  // =========================
  // LISTEN HANGUP FROM REMOTE
  // =========================
  useEffect(() => {
    const handleHangup = ({ from }) => {
      if (from !== remoteId) return;
      // remote ended the call
      endCall({ sendHangup: false });
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
    // Only auto-start for the caller flow. For callee flow (incomingOffer),
    // the call should start from Accept (answer), not by creating a new offer.
    if (autoStart && remoteId && callStatus === "idle" && !propIncomingOffer) {
      const timer = setTimeout(() => {
        callUser();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [autoStart, remoteId, callStatus, propIncomingOffer]);

  // =========================
  // INIT CAMERA LIST + DEVICECHANGE
  // =========================
  useEffect(() => {
    refreshDevices();
    const handler = () => refreshDevices();
    try {
      navigator.mediaDevices?.addEventListener?.("devicechange", handler);
    } catch (e) {}
    return () => {
      try {
        navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
      } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // apply speaker selection when available/changed
  useEffect(() => {
    if (!selectedSpeakerId) return;
    applySpeaker(selectedSpeakerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSpeakerId]);

  // =========================
  // END CALL
  // =========================
  const endCall = ({ sendHangup = true } = {}) => {
    console.log("❌ Ending call");

    clearIceRecoveryTimer();

    if (sendHangup && socket && remoteId) {
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
    acceptOnceRef.current = false;

    // reset peer
    pc.current = null;

    if (callStatus !== "ended") setCallStatus("ended");
    onEnd && onEnd();
  };

  // Allow parent (modal close) to end the call gracefully
  useEffect(() => {
    if (!forceEndSignal) return;
    endCall({ sendHangup: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceEndSignal]);

  return (
    <div className="w-full h-full bg-gray-900 rounded-xl p-6 lg:p-8">
      <h2 className="text-white text-xl lg:text-2xl font-bold mb-4 flex items-center gap-3">
        <span>Video Call</span>
        <span className="ml-auto flex items-center gap-2">
          <span
            className={`text-base px-3 py-1.5 rounded-lg ${
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

          <button
            type="button"
            onClick={endCall}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-base"
          >
            End
          </button>
        </span>
      </h2>

      {error && (
        <div className="mb-4 bg-red-900/50 text-red-200 p-3 rounded-lg text-base">
          {error}
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-3">
        <div className="flex items-center gap-3">
          <label className="text-white text-base w-28">Camera</label>
          <select
            value={selectedCameraId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedCameraId(id);
              if (stream) switchCamera(id);
            }}
            className="bg-gray-800 text-white text-base rounded-lg px-3 py-2 border border-gray-700 flex-1"
          >
            {cameras.length === 0 ? (
              <option value="">No camera</option>
            ) : (
              cameras.map((c) => (
                <option key={c.deviceId} value={c.deviceId}>
                  {c.label}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-white text-base w-28">Mic</label>
          <select
            value={selectedMicId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedMicId(id);
              if (stream) switchMicrophone(id);
            }}
            className="bg-gray-800 text-white text-base rounded-lg px-3 py-2 border border-gray-700 flex-1"
          >
            {microphones.length === 0 ? (
              <option value="">No microphone</option>
            ) : (
              microphones.map((m) => (
                <option key={m.deviceId} value={m.deviceId}>
                  {m.label}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-white text-base w-28">Speaker</label>
          <select
            value={selectedSpeakerId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedSpeakerId(id);
              applySpeaker(id);
            }}
            className="bg-gray-800 text-white text-base rounded-lg px-3 py-2 border border-gray-700 flex-1"
          >
            {speakers.length === 0 ? (
              <option value="">Default</option>
            ) : (
              <>
                <option value="">Default</option>
                {speakers.map((s) => (
                  <option key={s.deviceId} value={s.deviceId}>
                    {s.label}
                  </option>
                ))}
              </>
            )}
          </select>
          {!speakerSupported && (
            <span className="text-sm text-gray-400">Not supported</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-black rounded-lg overflow-hidden">
          <p className="text-white text-sm p-3 bg-gray-800">You</p>
          <video
            ref={localVideo}
            autoPlay
            playsInline
            muted
            className="w-full h-72 md:h-96 lg:h-[28rem] object-cover bg-black"
          />
        </div>

        <div className="bg-black rounded-lg overflow-hidden">
          <p className="text-white text-sm p-3 bg-gray-800">Remote</p>
          <video
            ref={remoteVideo}
            autoPlay
            playsInline
            className="w-full h-72 md:h-96 lg:h-[28rem] object-cover bg-black"
          />
        </div>
      </div>
    </div>
  );
}

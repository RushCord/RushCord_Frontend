import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createLocalAudioTrack,
  createLocalVideoTrack,
  Room,
  RoomEvent,
  Track,
} from "livekit-client";
import { axiosInstance } from "../lib/axios";
import { pickDeviceId } from "../lib/mediaDevices";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useMediaDeviceStore } from "../store/useMediaDeviceStore";
import { useLiveKitMediaDeviceSync } from "../hooks/useLiveKitMediaDeviceSync";

// Shared Room cache to avoid React StrictMode mount/unmount thrashing disconnecting calls in dev.
const _sharedRooms = globalThis.__RUSHCORD_LIVEKIT_ROOMS__ || new Map();
globalThis.__RUSHCORD_LIVEKIT_ROOMS__ = _sharedRooms;

function getSharedRoom(roomName) {
  const key = String(roomName || "");
  if (!key) return new Room();
  const existing = _sharedRooms.get(key);
  if (existing?.room) return existing.room;
  const room = new Room();
  _sharedRooms.set(key, { room, mounts: 0, disconnectTimer: null });
  return room;
}

function retainSharedRoom(roomName) {
  const key = String(roomName || "");
  if (!key) return () => {};
  const entry = _sharedRooms.get(key) || { room: new Room(), mounts: 0, disconnectTimer: null };
  if (!_sharedRooms.get(key)) _sharedRooms.set(key, entry);
  entry.mounts = (entry.mounts || 0) + 1;
  if (entry.disconnectTimer) {
    clearTimeout(entry.disconnectTimer);
    entry.disconnectTimer = null;
  }
  return () => {
    entry.mounts = Math.max(0, (entry.mounts || 0) - 1);
    if (entry.mounts === 0) {
      entry.disconnectTimer = setTimeout(() => {
        try {
          entry.room?.disconnect();
        } catch {
          // ignore
        }
      }, 800);
    }
  };
}

function getRemoteParticipantsMap(room) {
  // livekit-client v2 exposes remoteParticipants; keep backward-compatible fallback.
  const m = room?.remoteParticipants || room?.participants;
  return m && typeof m.forEach === "function" ? m : null;
}

function uniqIdentities(room) {
  const out = [];
  try {
    const m = getRemoteParticipantsMap(room);
    if (!m) return out;
    m.forEach((p) => {
      if (p?.identity) out.push(String(p.identity));
    });
  } catch {
    // ignore
  }
  return out.sort();
}

function getTrackSource(track, publication) {
  return publication?.source ?? track?.source;
}

function findCameraVideoPublication(participant) {
  if (!participant?.getTrackPublications) return null;
  const pubs = Array.from(participant.getTrackPublications() || []);
  return (
    pubs.find(
      (p) =>
        p?.source === Track.Source.Camera &&
        p?.kind === Track.Kind.Video &&
        p.track,
    ) || null
  );
}

function getScreenSharePublication(participant) {
  if (!participant?.getTrackPublications) return null;
  const pubs = Array.from(participant.getTrackPublications() || []);
  return (
    pubs.find(
      (p) =>
        p?.source === Track.Source.ScreenShare &&
        p?.kind === Track.Kind.Video &&
        p.track,
    ) || null
  );
}

function participantHasCameraVideo(participant) {
  if (!participant) return false;
  try {
    if (typeof participant.isCameraEnabled === "function" && !participant.isCameraEnabled()) {
      return false;
    }
    const pub = findCameraVideoPublication(participant);
    return Boolean(pub?.track && !pub.isMuted);
  } catch {
    // ignore
  }
  return false;
}

function participantHasScreenShare(participant) {
  if (!participant) return false;
  try {
    if (
      typeof participant.isScreenShareEnabled === "function" &&
      participant.isScreenShareEnabled()
    ) {
      const pub = getScreenSharePublication(participant);
      if (pub?.track && !pub.isMuted) return true;
    }
    const pub = getScreenSharePublication(participant);
    return Boolean(pub?.track && !pub.isMuted);
  } catch {
    // ignore
  }
  return false;
}

function RemoteTile({
  room,
  identity,
  tracksVersion,
  onRegister,
  onUnregister,
  getDisplayName,
  getUserProfile,
  hasVideo = false,
  compact = false,
}) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  void room;
  void tracksVersion;

  const profile =
    typeof getUserProfile === "function" ? getUserProfile(identity) : null;
  const displayName =
    profile?.fullName ||
    (typeof getDisplayName === "function" ? getDisplayName(identity) : identity);
  const mediaClass = compact ? "aspect-video w-full" : "h-44 w-full md:h-56";

  useEffect(() => {
    if (!identity) return () => {};
    try {
      onRegister?.(identity, {
        cameraVideoEl: videoRef.current,
        audioEl: audioRef.current,
      });
    } catch {
      // ignore
    }
    return () => {
      try {
        onUnregister?.(identity);
      } catch {
        // ignore
      }
    };
  }, [identity, onRegister, onUnregister]);

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[var(--discord-panel)] shadow-lg">
      <div className="truncate border-b border-white/10 bg-black/10 px-3 py-2 text-xs text-(--discord-text-muted)">
        {displayName || identity}
      </div>
      <div className={`relative ${mediaClass} bg-[var(--discord-sidebar)]`}>
        {!hasVideo ? (
          <div className="flex h-full w-full items-center justify-center">
            <img
              src={profile?.profilePic || "/avatar.png"}
              alt={displayName || "Participant"}
              className={
                compact
                  ? "size-14 rounded-full border-2 border-white/10 object-cover sm:size-16"
                  : "size-20 rounded-full border-2 border-white/10 object-cover sm:size-24"
              }
              onError={(e) => {
                e.currentTarget.src = "/avatar.png";
              }}
            />
          </div>
        ) : null}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`${mediaClass} bg-black object-cover ${hasVideo ? "" : "pointer-events-none absolute inset-0 opacity-0"}`}
        />
        <audio ref={audioRef} autoPlay className="hidden" />
      </div>
    </div>
  );
}

export default function GroupVideoCall({
  roomName,
  autoStart = false,
  forceEndSignal = 0,
  onEnd,
  getDisplayName,
  getUserProfile,
  notifyHangupGroup = false,
  variant = "full",
}) {
  const embedded = variant === "embedded";
  const authUser = useAuthStore((s) => s.authUser);
  const socket = useAuthStore((s) => s.socket);
  const voiceMicMuted = useChatStore((s) => s.voiceMicMuted);
  const voiceOutputMuted = useChatStore((s) => s.voiceOutputMuted);
  const voiceVideoEnabled = useChatStore((s) => s.voiceVideoEnabled);
  const voiceScreenShareEnabled = useChatStore((s) => s.voiceScreenShareEnabled);
  const setVoiceScreenShareEnabled = useChatStore((s) => s.setVoiceScreenShareEnabled);
  const outputVolume = useMediaDeviceStore((s) => s.outputVolume);

  const localVideo = useRef(null);
  const stageVideoRef = useRef(null);

  const room = useMemo(() => getSharedRoom(roomName), [roomName]);
  const _connectOnceRef = useRef(false);
  const _connectingRef = useRef(false);
  const [callStatus, setCallStatus] = useState("idle"); // idle, connecting, connected, ended
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const [cameras, setCameras] = useState([]);
  const [microphones, setMicrophones] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(
    () => useMediaDeviceStore.getState().cameraId,
  );
  const [selectedMicId, setSelectedMicId] = useState(
    () => useMediaDeviceStore.getState().microphoneId,
  );
  const [selectedSpeakerId, setSelectedSpeakerId] = useState(
    () => useMediaDeviceStore.getState().speakerId,
  );
  const [speakerSupported, setSpeakerSupported] = useState(true);

  const [remoteIdentities, setRemoteIdentities] = useState([]);
  const [videoByIdentity, setVideoByIdentity] = useState({});
  const [screenShareByIdentity, setScreenShareByIdentity] = useState({});
  const [tracksVersion, setTracksVersion] = useState(0);
  const [, setDebugInfo] = useState({ room: "", state: "", remotes: 0 });
  const _remoteSetRef = useRef(new Set());
  const _remoteElsRef = useRef(new Map()); // identity -> { cameraVideoEl, audioEl }
  const _activeStageIdentityRef = useRef(null);

  const setRemoteEls = (identity, { cameraVideoEl, audioEl }) => {
    if (!identity) return;
    const map = _remoteElsRef.current;
    map.set(String(identity), { cameraVideoEl, audioEl });

    // Catch-up attach for late joiners: attach any already-subscribed tracks immediately.
    try {
      const id = String(identity);
      const m = getRemoteParticipantsMap(room);
      const p = m?.get?.(id);
      if (p?.getTrackPublications) {
        const pubs = Array.from(p.getTrackPublications() || []);
        for (const pub of pubs) {
          const tr = pub?.track;
          if (!tr) continue;
          attachRemoteTrack(id, tr, pub);
        }
      }
    } catch {
      // ignore
    }
  };

  const clearRemoteEls = (identity) => {
    if (!identity) return;
    _remoteElsRef.current.delete(String(identity));
  };

  const syncVideoFlags = () => {
    const next = {};
    try {
      const local = room.localParticipant;
      const localId = String(local?.identity || authUser?._id || "");
      if (localId) {
        next[localId] = embedded
          ? Boolean(voiceVideoEnabled)
          : participantHasCameraVideo(local);
      }
      const m = getRemoteParticipantsMap(room);
      m?.forEach((p) => {
        if (p?.identity) next[String(p.identity)] = participantHasCameraVideo(p);
      });
    } catch {
      // ignore
    }
    setVideoByIdentity(next);
  };

  const syncScreenShareFlags = () => {
    const next = {};
    try {
      const local = room.localParticipant;
      const localId = String(local?.identity || authUser?._id || "");
      if (localId) {
        next[localId] = embedded
          ? Boolean(voiceScreenShareEnabled)
          : participantHasScreenShare(local);
      }
      const m = getRemoteParticipantsMap(room);
      m?.forEach((p) => {
        if (p?.identity) next[String(p.identity)] = participantHasScreenShare(p);
      });
    } catch {
      // ignore
    }
    setScreenShareByIdentity(next);
  };

  const syncMediaFlags = () => {
    syncVideoFlags();
    syncScreenShareFlags();
  };

  const attachRemoteTrack = (participantIdentity, track, publication) => {
    const id = String(participantIdentity || "");
    if (!id || !track) return;
    const source = getTrackSource(track, publication);

    if (source === Track.Source.ScreenShare && track.kind === Track.Kind.Video) {
      const stageId = _activeStageIdentityRef.current;
      const stageEl = stageVideoRef.current;
      if (stageId === id && stageEl) {
        try {
          track.attach(stageEl);
          if (typeof stageEl.play === "function") stageEl.play().catch(() => {});
        } catch {
          // ignore
        }
      }
      return;
    }

    const els = _remoteElsRef.current.get(id);
    if (!els) return;

    try {
      if (
        source === Track.Source.Camera &&
        track.kind === Track.Kind.Video &&
        els.cameraVideoEl
      ) {
        track.attach(els.cameraVideoEl);
        if (typeof els.cameraVideoEl.play === "function") {
          els.cameraVideoEl.play().catch(() => {});
        }
      }
    } catch {
      // ignore
    }

    try {
      if (
        track.kind === Track.Kind.Audio &&
        source !== Track.Source.ScreenShareAudio &&
        els.audioEl
      ) {
        els.audioEl.muted = voiceOutputMuted;
        els.audioEl.volume = Math.max(
          0,
          Math.min(1, useMediaDeviceStore.getState().outputVolume / 100),
        );
        track.attach(els.audioEl);
        if (typeof els.audioEl.play === "function") els.audioEl.play().catch(() => {});
      }
    } catch {
      // ignore
    }
  };

  const detachRemoteTrack = (participantIdentity, track, publication) => {
    const id = String(participantIdentity || "");
    if (!id || !track) return;
    const source = getTrackSource(track, publication);

    if (source === Track.Source.ScreenShare && track.kind === Track.Kind.Video) {
      const stageEl = stageVideoRef.current;
      if (stageEl && _activeStageIdentityRef.current === id) {
        try {
          track.detach(stageEl);
        } catch {
          // ignore
        }
      }
      return;
    }

    const els = _remoteElsRef.current.get(id);
    if (!els) return;
    try {
      if (
        source === Track.Source.Camera &&
        track.kind === Track.Kind.Video &&
        els.cameraVideoEl
      ) {
        track.detach(els.cameraVideoEl);
      }
    } catch {
      // ignore
    }
    try {
      if (track.kind === Track.Kind.Audio && els.audioEl) track.detach(els.audioEl);
    } catch {
      // ignore
    }
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
      const prefs = useMediaDeviceStore.getState();
      setSelectedCameraId((prev) => pickDeviceId(cams, prev || prefs.cameraId));

      const mics = devices
        .filter((d) => d.kind === "audioinput")
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${idx + 1}`,
        }));
      setMicrophones(mics);
      setSelectedMicId((prev) => pickDeviceId(mics, prev || prefs.microphoneId));

      const outs = devices
        .filter((d) => d.kind === "audiooutput")
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${idx + 1}`,
        }));
      setSpeakers(outs);
      setSelectedSpeakerId((prev) => {
        if (prev) return prev;
        const preferred = prefs.speakerId;
        if (preferred && outs.some((o) => o.deviceId === preferred)) return preferred;
        return outs[0]?.deviceId || "";
      });
    } catch {
      // ignore
    }
  };

  const applySpeaker = async (deviceId) => {
    try {
      const audioEls = [];
      _remoteElsRef.current.forEach(({ audioEl }) => {
        if (audioEl) audioEls.push(audioEl);
      });
      const fallback = document.querySelector("audio[autoplay], video[autoplay]");
      const targets = audioEls.length > 0 ? audioEls : fallback ? [fallback] : [];
      if (targets.length === 0) return;

      const fn = targets[0].setSinkId;
      if (typeof fn !== "function") {
        setSpeakerSupported(false);
        return;
      }
      setSpeakerSupported(true);

      const vol = Math.max(
        0,
        Math.min(1, useMediaDeviceStore.getState().outputVolume / 100),
      );
      for (const el of targets) {
        if (typeof el.setSinkId === "function") {
          await el.setSinkId.call(el, deviceId || "");
        }
        if ("volume" in el) el.volume = vol;
      }

      setSelectedSpeakerId(deviceId || "");
      useMediaDeviceStore.getState().setSpeakerId(deviceId || "");
    } catch {
      setSpeakerSupported(false);
    }
  };

  const switchCamera = async (deviceId) => {
    if (!deviceId) return;
    setSelectedCameraId(deviceId);
    useMediaDeviceStore.getState().setCameraId(deviceId);
    if (room.state !== "connected") return;
    try {
      const pub = findCameraVideoPublication(room.localParticipant);

      const nextTrack = await createLocalVideoTrack({
        deviceId: { exact: deviceId },
        resolution: { width: 1280, height: 720 },
      });

      await room.localParticipant.publishTrack(nextTrack, {
        source: Track.Source.Camera,
      });
      if (localVideo.current) nextTrack.attach(localVideo.current);

      if (pub?.track) {
        try {
          await room.localParticipant.unpublishTrack(pub.track, true);
        } catch {
          // ignore
        }
      }
    } catch (e) {
      setError(`❌ switchCamera error: ${e?.message || String(e)}`);
    }
  };

  const switchMicrophone = async (deviceId) => {
    if (!deviceId) return;
    setSelectedMicId(deviceId);
    useMediaDeviceStore.getState().setMicrophoneId(deviceId);
    if (room.state !== "connected") return;
    try {
      const pub = room.localParticipant
        .getTrackPublications()
        .find((p) => p.track?.kind === Track.Kind.Audio);

      const nextTrack = await createLocalAudioTrack({
        deviceId: { exact: deviceId },
      });

      await room.localParticipant.publishTrack(nextTrack);
      await room.localParticipant.setMicrophoneEnabled(!voiceMicMuted);

      if (pub?.track) {
        try {
          await room.localParticipant.unpublishTrack(pub.track, true);
        } catch {
          // ignore
        }
      }
    } catch (e) {
      setError(`❌ switchMicrophone error: ${e?.message || String(e)}`);
    }
  };

  const connectToRoom = async () => {
    if (!roomName) {
      setError("Missing roomName");
      return;
    }
    try {
      if (_connectingRef.current) return;
      if (callStatus === "connected") return;

      _connectingRef.current = true;
      setError(null);
      setCallStatus("connecting");

      const { data } = await axiosInstance.post("/livekit/token", { roomName });
      const { url, token } = data || {};
      if (!url || !token) throw new Error("Invalid token response");

      await room.connect(url, token);
      const startVideo = embedded ? voiceVideoEnabled : true;
      await room.localParticipant.setMicrophoneEnabled(!voiceMicMuted);
      await room.localParticipant.setCameraEnabled(startVideo);
      try {
        console.log("[GroupVideoCall] connected", {
          room: room.name,
          local: room.localParticipant?.identity,
        });
      } catch {
        // ignore
      }

      const camPub = findCameraVideoPublication(room.localParticipant);
      if (camPub?.track && localVideo.current) {
        camPub.track.attach(localVideo.current);
      }

      await refreshDevices();
      const prefs = useMediaDeviceStore.getState();
      if (prefs.cameraId && (!embedded || voiceVideoEnabled)) {
        await switchCamera(prefs.cameraId);
      }
      if (prefs.microphoneId) await switchMicrophone(prefs.microphoneId);
      const initial = uniqIdentities(room);
      _remoteSetRef.current = new Set(initial);
      setRemoteIdentities(initial);
      setDebugInfo({
        room: String(room.name || roomName || ""),
        state: String(room.state || ""),
        remotes: Number(getRemoteParticipantsMap(room)?.size || initial.length || 0),
      });
      setCallStatus("connected");
      syncMediaFlags();
    } catch (e) {
      setError(`❌ LiveKit connect error: ${e?.message || String(e)}`);
      setCallStatus("idle");
    } finally {
      _connectingRef.current = false;
    }
  };

  const endCall = ({ sendHangup = true } = {}) => {
    try {
      if (sendHangup && notifyHangupGroup && socket && roomName) {
        const rm = String(roomName);
        const conversationId = rm.includes("#VOICE#")
          ? rm.split("#VOICE#")[0]
          : rm;
        socket.emit("hangupGroup", { conversationId, roomName: rm });
      }
    } catch {
      // ignore
    }

    try {
      if (
        room.state === "connected" &&
        typeof room.localParticipant?.setScreenShareEnabled === "function"
      ) {
        room.localParticipant.setScreenShareEnabled(false).catch(() => {});
      }
    } catch {
      // ignore
    }

    try {
      room.disconnect();
    } catch {
      // ignore
    }

    setCallStatus("ended");
    onEnd && onEnd();
  };

  useEffect(() => {
    const syncFromRoom = () => {
      const ids = uniqIdentities(room);
      _remoteSetRef.current = new Set(ids);
      setRemoteIdentities(ids);
    };
    const bumpTracks = () => {
      setTracksVersion((v) => (v + 1) % 1_000_000);
      syncMediaFlags();
    };
    const updateDebug = () =>
      setDebugInfo({
        room: String(room.name || roomName || ""),
        state: String(room.state || ""),
        remotes: Number(getRemoteParticipantsMap(room)?.size || _remoteSetRef.current.size || 0),
      });

    const onParticipantConnected = (p) => {
      try {
        console.log("[GroupVideoCall] ParticipantConnected", p?.identity);
      } catch {
        // ignore
      }
      if (p?.identity) {
        const next = new Set(_remoteSetRef.current);
        next.add(String(p.identity));
        _remoteSetRef.current = next;
        setRemoteIdentities(Array.from(next).sort());
      } else {
        syncFromRoom();
      }
      updateDebug();
    };

    const onParticipantDisconnected = (p) => {
      try {
        console.log("[GroupVideoCall] ParticipantDisconnected", p?.identity);
      } catch {
        // ignore
      }
      if (p?.identity) {
        const next = new Set(_remoteSetRef.current);
        next.delete(String(p.identity));
        _remoteSetRef.current = next;
        setRemoteIdentities(Array.from(next).sort());
      } else {
        syncFromRoom();
      }
      updateDebug();
    };

    const onConnectionStateChanged = (s) => {
      try {
        console.log("[GroupVideoCall] ConnectionStateChanged", s);
      } catch {
        // ignore
      }
      updateDebug();
    };

    const onTrackSubscribed = (track, pub, participant) => {
      try {
        console.log("[GroupVideoCall] TrackSubscribed", {
          kind: track?.kind,
          from: participant?.identity,
          source: pub?.source,
        });
      } catch {
        // ignore
      }
      attachRemoteTrack(participant?.identity, track, pub);
      bumpTracks();
      if (participant?.identity) {
        const next = new Set(_remoteSetRef.current);
        next.add(String(participant.identity));
        _remoteSetRef.current = next;
        setRemoteIdentities(Array.from(next).sort());
      } else {
        syncFromRoom();
      }
      updateDebug();
    };

    const onTrackUnsubscribed = (track, pub, participant) => {
      detachRemoteTrack(participant?.identity, track, pub);
      bumpTracks();
      syncFromRoom();
      updateDebug();
      void pub;
    };

    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.ConnectionStateChanged, onConnectionStateChanged);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);

    return () => {
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      room.off(RoomEvent.ConnectionStateChanged, onConnectionStateChanged);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    };
  }, [room]);

  // Poll participants periodically while connected (helps diagnose cases where events don't fire)
  useEffect(() => {
    if (callStatus !== "connected") return () => {};
    const t = setInterval(() => {
      const ids = uniqIdentities(room);
      _remoteSetRef.current = new Set(ids);
      setRemoteIdentities(ids);
      syncMediaFlags();
      setDebugInfo({
        room: String(room.name || roomName || ""),
        state: String(room.state || ""),
        remotes: Number(getRemoteParticipantsMap(room)?.size || ids.length || 0),
      });
    }, 1000);
    return () => clearInterval(t);
  }, [callStatus, room, roomName]);

  // Keep shared room alive across StrictMode remounts.
  useEffect(() => retainSharedRoom(roomName), [roomName]);

  useEffect(() => {
    const handleHangup = ({ roomName: rn, conversationId, kind }) => {
      const expected = String(roomName || "");
      const incomingRoom = String(rn || conversationId || "");
      if (kind && String(kind).toUpperCase() !== "GROUP") return;
      if (expected && incomingRoom && incomingRoom !== expected) {
        const baseExpected = expected.includes("#VOICE#")
          ? expected.split("#VOICE#")[0]
          : expected;
        if (incomingRoom !== baseExpected) return;
      }
      endCall({ sendHangup: false });
    };

    if (!notifyHangupGroup || !socket) return () => {};
    socket.on("hangup", handleHangup);
    return () => socket.off("hangup", handleHangup);
  }, [socket, roomName, notifyHangupGroup]);

  useEffect(() => {
    if (!autoStart) return;
    if (callStatus !== "idle") return;
    if (!roomName) return;
    if (_connectOnceRef.current) return;
    _connectOnceRef.current = true;
    connectToRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, roomName]);

  useEffect(() => {
    refreshDevices();
    const handler = () => refreshDevices();
    try {
      navigator.mediaDevices?.addEventListener?.("devicechange", handler);
    } catch {
      // ignore
    }
    return () => {
      try {
        navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedSpeakerId) return;
    applySpeaker(selectedSpeakerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSpeakerId]);

  useLiveKitMediaDeviceSync({
    callStatus,
    selectedCameraId,
    selectedMicId,
    selectedSpeakerId,
    switchCamera,
    switchMicrophone,
    applySpeaker,
    cameraLiveSwitch: !embedded || voiceVideoEnabled,
    setSelectedCameraId,
  });

  useEffect(() => {
    const vol = Math.max(0, Math.min(1, outputVolume / 100));
    _remoteElsRef.current.forEach(({ audioEl }) => {
      if (audioEl) audioEl.volume = vol;
    });
  }, [outputVolume]);

  useEffect(() => {
    if (!forceEndSignal) return;
    endCall({ sendHangup: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceEndSignal]);

  useEffect(() => {
    if (callStatus !== "connected") return;
    try {
      room.localParticipant.setMicrophoneEnabled(!voiceMicMuted);
    } catch {
      // ignore
    }
  }, [callStatus, voiceMicMuted, room]);

  useEffect(() => {
    if (!embedded || callStatus !== "connected") return;
    const applyVideo = async () => {
      try {
        await room.localParticipant.setCameraEnabled(voiceVideoEnabled);
        if (voiceVideoEnabled) {
          const camPub = findCameraVideoPublication(room.localParticipant);
          if (camPub?.track && localVideo.current) {
            camPub.track.attach(localVideo.current);
          } else if (!camPub?.track) {
            const prefs = useMediaDeviceStore.getState();
            const deviceId = prefs.cameraId || selectedCameraId;
            const nextTrack = await createLocalVideoTrack({
              ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
              resolution: { width: 1280, height: 720 },
            });
            await room.localParticipant.publishTrack(nextTrack, {
              source: Track.Source.Camera,
            });
            if (localVideo.current) nextTrack.attach(localVideo.current);
          }
        } else if (localVideo.current) {
          localVideo.current.srcObject = null;
        }
      } catch {
        // ignore
      }
    };
    applyVideo();
    syncMediaFlags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus, voiceVideoEnabled, embedded, room]);

  useEffect(() => {
    if (!embedded || callStatus !== "connected") return;
    let cancelled = false;
    const applyScreenShare = async () => {
      try {
        await room.localParticipant.setScreenShareEnabled(voiceScreenShareEnabled, {
          audio: false,
        });
        if (!cancelled) syncMediaFlags();
      } catch (e) {
        if (!cancelled) {
          setError(`❌ Chia sẻ màn hình: ${e?.message || String(e)}`);
          setVoiceScreenShareEnabled(false);
        }
      }
    };
    applyScreenShare();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus, voiceScreenShareEnabled, embedded, room]);

  useEffect(() => {
    if (callStatus !== "connected") return;
    syncMediaFlags();
  }, [callStatus, voiceVideoEnabled, voiceScreenShareEnabled, embedded, remoteIdentities]);

  useEffect(() => {
    if (callStatus !== "connected") return;
    try {
      _remoteElsRef.current.forEach(({ audioEl }) => {
        if (audioEl) audioEl.muted = voiceOutputMuted;
      });
    } catch {
      // ignore
    }
  }, [callStatus, voiceOutputMuted, tracksVersion]);

  const remotes = remoteIdentities;
  const tileVideoClass = embedded
    ? "aspect-video w-full bg-black object-cover"
    : "h-44 w-full bg-black object-cover md:h-56";
  const localIdentity = String(room.localParticipant?.identity || authUser?._id || "");

  const activeStageIdentity = useMemo(() => {
    if (localIdentity && screenShareByIdentity[localIdentity]) return localIdentity;
    for (const id of remoteIdentities) {
      if (screenShareByIdentity[id]) return id;
    }
    return null;
  }, [localIdentity, remoteIdentities, screenShareByIdentity]);

  useEffect(() => {
    _activeStageIdentityRef.current = activeStageIdentity;
  }, [activeStageIdentity]);

  useEffect(() => {
    if (callStatus !== "connected") return;
    const stageEl = stageVideoRef.current;
    if (!stageEl) return;

    if (!activeStageIdentity) {
      try {
        stageEl.srcObject = null;
      } catch {
        // ignore
      }
      return;
    }

    let participant = room.localParticipant;
    if (activeStageIdentity !== localIdentity) {
      participant = getRemoteParticipantsMap(room)?.get?.(activeStageIdentity);
    }

    const pub = getScreenSharePublication(participant);
    if (pub?.track) {
      try {
        pub.track.attach(stageEl);
        if (typeof stageEl.play === "function") stageEl.play().catch(() => {});
      } catch {
        // ignore
      }
    } else {
      try {
        stageEl.srcObject = null;
      } catch {
        // ignore
      }
    }
  }, [activeStageIdentity, tracksVersion, callStatus, localIdentity, room]);

  const stageDisplayName = activeStageIdentity
    ? (typeof getDisplayName === "function"
        ? getDisplayName(activeStageIdentity)
        : activeStageIdentity)
    : "";
  const localProfile =
    (typeof getUserProfile === "function" ? getUserProfile(localIdentity) : null) ||
    {};
  const localHasVideo = localIdentity
    ? Boolean(videoByIdentity[localIdentity])
    : embedded
      ? voiceVideoEnabled
      : true;

  const videoGrid = (
    <div
      className={`grid w-full gap-3 ${
        embedded
          ? "auto-rows-fr place-content-center grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
      }`}
    >
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[var(--discord-panel)] shadow-lg">
        <div className="truncate border-b border-white/10 bg-black/10 px-3 py-2 text-xs text-(--discord-text-muted)">
          Bạn
        </div>
        <div
          className={`relative bg-[var(--discord-sidebar)] ${
            embedded ? "aspect-video w-full" : "h-44 w-full md:h-56"
          }`}
        >
          {!localHasVideo ? (
            <div className="flex h-full w-full items-center justify-center">
              <img
                src={localProfile.profilePic || authUser?.profilePic || "/avatar.png"}
                alt={localProfile.fullName || authUser?.fullName || "Bạn"}
                className={
                  embedded
                    ? "size-14 rounded-full border-2 border-white/10 object-cover sm:size-16"
                    : "size-20 rounded-full border-2 border-white/10 object-cover sm:size-24"
                }
                onError={(e) => {
                  e.currentTarget.src = "/avatar.png";
                }}
              />
            </div>
          ) : null}
          <video
            ref={localVideo}
            autoPlay
            playsInline
            muted
            className={`${tileVideoClass} ${localHasVideo ? "" : "pointer-events-none absolute inset-0 opacity-0"}`}
          />
        </div>
      </div>

      {remotes.map((id) => (
        <RemoteTile
          key={id}
          room={room}
          identity={id}
          tracksVersion={tracksVersion}
          onRegister={setRemoteEls}
          onUnregister={clearRemoteEls}
          getDisplayName={getDisplayName}
          getUserProfile={getUserProfile}
          hasVideo={Boolean(videoByIdentity[id])}
          compact={embedded}
        />
      ))}
    </div>
  );

  const screenShareStage =
    embedded && activeStageIdentity ? (
      <div className="mb-4 w-full shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black shadow-lg">
        <div className="truncate border-b border-white/10 bg-black/40 px-3 py-2 text-xs text-(--discord-text-muted)">
          Đang chia sẻ màn hình · {stageDisplayName || activeStageIdentity}
        </div>
        <div className="relative aspect-video w-full bg-black">
          <video
            ref={stageVideoRef}
            autoPlay
            playsInline
            className="aspect-video h-full w-full object-contain"
          />
        </div>
      </div>
    ) : null;

  if (embedded) {
    return (
      <div className="flex w-full flex-1 flex-col">
        {error ? (
          <div className="mb-3 shrink-0 rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {callStatus === "connecting" ? (
          <p className="mb-3 shrink-0 text-sm text-(--discord-text-muted)">
            Đang kết nối kênh thoại…
          </p>
        ) : null}
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto">
          {screenShareStage}
          <div className="flex min-h-[min(280px,50vh)] w-full flex-1 items-center justify-center">
            {videoGrid}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-[var(--discord-panel)] p-4">
      <h2 className="mb-4 flex items-center gap-3 text-xl font-bold lg:text-2xl">
        <span>Group Video Call</span>
        <span className="ml-auto flex items-center gap-2">
          <span
            className={`rounded-lg px-3 py-1.5 text-base ${
              callStatus === "idle"
                ? "bg-white/10"
                : callStatus === "connecting"
                  ? "bg-yellow-600"
                  : callStatus === "connected"
                    ? "bg-green-600"
                    : "bg-red-600"
            }`}
          >
            {callStatus === "idle"
              ? "Idle"
              : callStatus === "connecting"
                ? "Connecting..."
                : callStatus === "connected"
                  ? "Connected"
                  : "Ended"}
          </span>

          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-base hover:bg-white/10"
          >
            Settings
          </button>

          <button
            type="button"
            onClick={() => endCall({ sendHangup: true })}
            className="rounded-lg bg-red-600 px-4 py-2 text-base text-white hover:bg-red-700"
          >
            End
          </button>
        </span>
      </h2>

      {error && (
        <div className="mb-4 rounded-lg bg-red-900/50 p-3 text-base text-red-200">
          {error}
        </div>
      )}

      {showSettings && (
        <div className="mb-4 space-y-3 rounded-xl border border-white/10 bg-black/10 p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs text-base-content/60">Camera</label>
              <select
                value={selectedCameraId}
                onChange={(e) => switchCamera(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[var(--discord-panel)] px-3 py-2 text-sm"
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

            <div>
              <label className="mb-1 block text-xs text-base-content/60">Mic</label>
              <select
                value={selectedMicId}
                onChange={(e) => switchMicrophone(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[var(--discord-panel)] px-3 py-2 text-sm"
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

            <div>
              <label className="mb-1 block text-xs text-base-content/60">Speaker</label>
              <select
                value={selectedSpeakerId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedSpeakerId(id);
                  useMediaDeviceStore.getState().setSpeakerId(id);
                  applySpeaker(id);
                }}
                className="w-full rounded-lg border border-white/10 bg-[var(--discord-panel)] px-3 py-2 text-sm"
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
                <div className="mt-1 text-xs text-base-content/50">
                  Speaker select not supported in this browser.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {callStatus === "idle" && autoStart && (
        <div className="mb-4">
          <button
            type="button"
            onClick={connectToRoom}
            className="rounded-lg bg-primary px-4 py-2 text-primary-content hover:bg-primary/90"
          >
            Join
          </button>
        </div>
      )}

      {videoGrid}
    </div>
  );
}


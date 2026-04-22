import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createLocalAudioTrack,
  createLocalVideoTrack,
  Room,
  RoomEvent,
  Track,
} from "livekit-client";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";

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

function RemoteTile({
  room,
  identity,
  tracksVersion,
  onRegister,
  onUnregister,
  getDisplayName,
}) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  void room;
  void tracksVersion;

  useEffect(() => {
    if (!identity) return () => {};
    try {
      onRegister?.(identity, {
        videoEl: videoRef.current,
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
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[var(--discord-panel)] shadow-lg">
      <div className="truncate border-b border-white/10 bg-black/10 px-3 py-2 text-xs text-base-content/70">
        {typeof getDisplayName === "function" ? getDisplayName(identity) : identity}
      </div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        // Keep audio in separate <audio> element to avoid autoplay blocks on video-with-audio.
        className="h-44 w-full bg-black object-cover md:h-56"
      />
      <audio ref={audioRef} autoPlay />
    </div>
  );
}

export default function GroupVideoCall({
  roomName,
  autoStart = false,
  forceEndSignal = 0,
  onEnd,
  getDisplayName,
}) {
  const socket = useAuthStore((s) => s.socket);

  const localVideo = useRef(null);

  const room = useMemo(() => getSharedRoom(roomName), [roomName]);
  const _connectOnceRef = useRef(false);
  const _connectingRef = useRef(false);
  const [callStatus, setCallStatus] = useState("idle"); // idle, connecting, connected, ended
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const [cameras, setCameras] = useState([]);
  const [microphones, setMicrophones] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [selectedMicId, setSelectedMicId] = useState("");
  const [selectedSpeakerId, setSelectedSpeakerId] = useState("");
  const [speakerSupported, setSpeakerSupported] = useState(true);

  const [remoteIdentities, setRemoteIdentities] = useState([]);
  const [tracksVersion, setTracksVersion] = useState(0);
  const [, setDebugInfo] = useState({ room: "", state: "", remotes: 0 });
  const _remoteSetRef = useRef(new Set());
  const _remoteElsRef = useRef(new Map()); // identity -> { videoEl, audioEl }

  const setRemoteEls = (identity, { videoEl, audioEl }) => {
    if (!identity) return;
    const map = _remoteElsRef.current;
    map.set(String(identity), { videoEl, audioEl });

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

  const attachRemoteTrack = (participantIdentity, track, publication) => {
    const id = String(participantIdentity || "");
    if (!id || !track) return;
    const els = _remoteElsRef.current.get(id);
    if (!els) return;

    try {
      if (track.kind === Track.Kind.Video && els.videoEl) {
        track.attach(els.videoEl);
        if (typeof els.videoEl.play === "function") els.videoEl.play().catch(() => {});
      }
    } catch {
      // ignore
    }

    try {
      if (track.kind === Track.Kind.Audio && els.audioEl) {
        track.attach(els.audioEl);
        if (typeof els.audioEl.play === "function") els.audioEl.play().catch(() => {});
      }
    } catch {
      // ignore
    }

    // best-effort: if browser blocks audio, user gesture exists (Accept/Call) so retrying is ok.
    void publication;
  };

  const detachRemoteTrack = (participantIdentity, track) => {
    const id = String(participantIdentity || "");
    if (!id || !track) return;
    const els = _remoteElsRef.current.get(id);
    if (!els) return;
    try {
      if (track.kind === Track.Kind.Video && els.videoEl) track.detach(els.videoEl);
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
      if (!selectedCameraId && cams[0]?.deviceId) setSelectedCameraId(cams[0].deviceId);

      const mics = devices
        .filter((d) => d.kind === "audioinput")
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${idx + 1}`,
        }));
      setMicrophones(mics);
      if (!selectedMicId && mics[0]?.deviceId) setSelectedMicId(mics[0].deviceId);

      const outs = devices
        .filter((d) => d.kind === "audiooutput")
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${idx + 1}`,
        }));
      setSpeakers(outs);
      if (!selectedSpeakerId && outs[0]?.deviceId) setSelectedSpeakerId(outs[0].deviceId);
    } catch {
      // ignore
    }
  };

  const applySpeaker = async (deviceId) => {
    try {
      const anyRemote = document.querySelector("audio[autoplay], video[autoplay]");
      if (!anyRemote) return;
      const fn = anyRemote.setSinkId;
      if (typeof fn !== "function") {
        setSpeakerSupported(false);
        return;
      }
      setSpeakerSupported(true);
      await fn.call(anyRemote, deviceId || "");
      setSelectedSpeakerId(deviceId || "");
    } catch {
      setSpeakerSupported(false);
    }
  };

  const switchCamera = async (deviceId) => {
    if (!deviceId) return;
    setSelectedCameraId(deviceId);
    if (callStatus !== "connected") return;
    try {
      const pub = room.localParticipant
        .getTrackPublications()
        .find((p) => p.track?.kind === Track.Kind.Video);

      const nextTrack = await createLocalVideoTrack({
        deviceId: { exact: deviceId },
        resolution: { width: 1280, height: 720 },
      });

      await room.localParticipant.publishTrack(nextTrack);
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
    if (callStatus !== "connected") return;
    try {
      const pub = room.localParticipant
        .getTrackPublications()
        .find((p) => p.track?.kind === Track.Kind.Audio);

      const nextTrack = await createLocalAudioTrack({
        deviceId: { exact: deviceId },
      });

      await room.localParticipant.publishTrack(nextTrack);

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
      await room.localParticipant.enableCameraAndMicrophone();
      try {
        console.log("[GroupVideoCall] connected", {
          room: room.name,
          local: room.localParticipant?.identity,
        });
      } catch {
        // ignore
      }

      const camPub = room.localParticipant
        .getTrackPublications()
        .find((p) => p.track?.kind === Track.Kind.Video);
      if (camPub?.track && localVideo.current) {
        camPub.track.attach(localVideo.current);
      }

      await refreshDevices();
      const initial = uniqIdentities(room);
      _remoteSetRef.current = new Set(initial);
      setRemoteIdentities(initial);
      setDebugInfo({
        room: String(room.name || roomName || ""),
        state: String(room.state || ""),
        remotes: Number(getRemoteParticipantsMap(room)?.size || initial.length || 0),
      });
      setCallStatus("connected");
    } catch (e) {
      setError(`❌ LiveKit connect error: ${e?.message || String(e)}`);
      setCallStatus("idle");
    } finally {
      _connectingRef.current = false;
    }
  };

  const endCall = ({ sendHangup = true } = {}) => {
    try {
      if (sendHangup && socket && roomName) {
        socket.emit("hangupGroup", { conversationId: roomName });
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
    const bumpTracks = () => setTracksVersion((v) => (v + 1) % 1_000_000);
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
      detachRemoteTrack(participant?.identity, track);
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
      const incomingRoom = String(conversationId || rn || "");
      if (kind && String(kind).toUpperCase() !== "GROUP") return;
      if (expected && incomingRoom && incomingRoom !== expected) return;
      endCall({ sendHangup: false });
    };

    if (!socket) return () => {};
    socket.on("hangup", handleHangup);
    return () => socket.off("hangup", handleHangup);
  }, [socket, roomName]);

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

  useEffect(() => {
    if (!forceEndSignal) return;
    endCall({ sendHangup: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceEndSignal]);

  const remotes = remoteIdentities;

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
                onChange={(e) => setSelectedSpeakerId(e.target.value)}
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[var(--discord-panel)] shadow-lg">
          <div className="border-b border-white/10 bg-black/10 px-3 py-2 text-xs text-base-content/70">You</div>
          <video
            ref={localVideo}
            autoPlay
            playsInline
            muted
            className="h-44 w-full bg-black object-cover md:h-56"
          />
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
          />
        ))}
      </div>
    </div>
  );
}


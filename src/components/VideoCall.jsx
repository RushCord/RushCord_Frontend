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

// Shared Room cache — avoids React StrictMode mount/unmount disconnecting mid-connect.
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
      // Longer delay: StrictMode remount + in-flight connect/disconnect can exceed 800ms on slow machines.
      entry.disconnectTimer = setTimeout(() => {
        try {
          entry.room?.disconnect();
        } catch {
          // ignore
        }
      }, 2500);
    }
  };
}

/** Avoid stacking room.connect() on the same Room (StrictMode / effect re-run) — causes leave + PC failures. */
async function ensureRoomDisconnected(room) {
  if (room.state === "disconnected") return;
  try {
    await room.disconnect();
  } catch {
    // ignore
  }
}

const isBenignDisconnectError = (e) => {
  const msg = String(e?.message || e || "").toLowerCase();
  return (
    msg.includes("client initiated disconnect") ||
    msg.includes("cancelled") ||
    msg.includes("aborterror") ||
    msg.includes("leave request while trying to (re)connect")
  );
};

export default function VideoCall({
  myId: _myId,
  remoteId,
  roomName,
  autoStart = false,
  forceEndSignal = 0,
  onEnd,
}) {
  void _myId;
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const remoteAudio = useRef(null);

  const socket = useAuthStore((s) => s.socket);
  const authUser = useAuthStore((s) => s.authUser);
  const users = useChatStore((s) => s.users);
  const voiceMicMuted = useChatStore((s) => s.voiceMicMuted);
  const voiceOutputMuted = useChatStore((s) => s.voiceOutputMuted);
  const outputVolume = useMediaDeviceStore((s) => s.outputVolume);

  const room = useMemo(() => getSharedRoom(roomName), [roomName]);
  const connectAttemptRef = useRef(0);
  const callStatusRef = useRef("idle");
  const [callStatus, setCallStatus] = useState("idle"); // idle, connecting, connected, ended
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const [cameras, setCameras] = useState([]); // [{ deviceId, label }]
  const [microphones, setMicrophones] = useState([]); // [{ deviceId, label }]
  const [speakers, setSpeakers] = useState([]); // [{ deviceId, label }]
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
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [localHasVideo, setLocalHasVideo] = useState(true);

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
      const el = remoteAudio.current || remoteVideo.current;
      if (!el) return;
      const fn = el.setSinkId;
      if (typeof fn !== "function") {
        setSpeakerSupported(false);
        return;
      }
      setSpeakerSupported(true);
      await fn.call(el, deviceId || "");
      setSelectedSpeakerId(deviceId || "");
      useMediaDeviceStore.getState().setSpeakerId(deviceId || "");
      el.volume = Math.max(0, Math.min(1, useMediaDeviceStore.getState().outputVolume / 100));
    } catch (e) {
      setSpeakerSupported(false);
      console.error("setSinkId failed:", e);
    }
  };

  const switchCamera = async (deviceId) => {
    if (!deviceId) return;
    setSelectedCameraId(deviceId);
    useMediaDeviceStore.getState().setCameraId(deviceId);
    if (room.state !== "connected") return;
    try {
      const pub = room.localParticipant
        .getTrackPublications()
        .find((p) => p.track?.kind === Track.Kind.Video);
      const prevTrack = pub?.track || null;

      const nextTrack = await createLocalVideoTrack({
        deviceId: { exact: deviceId },
        resolution: { width: 1280, height: 720 },
      });

      await room.localParticipant.publishTrack(nextTrack);
      if (localVideo.current) nextTrack.attach(localVideo.current);

      if (pub) {
        try {
          await room.localParticipant.unpublishTrack(pub.track, true);
        } catch {
          // ignore
        }
      } else if (prevTrack) {
        try {
          await room.localParticipant.unpublishTrack(prevTrack, true);
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.error("switchCamera failed:", e);
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
      const prevTrack = pub?.track || null;

      const nextTrack = await createLocalAudioTrack({
        deviceId: { exact: deviceId },
      });

      await room.localParticipant.publishTrack(nextTrack);
      await room.localParticipant.setMicrophoneEnabled(!voiceMicMuted);

      if (pub) {
        try {
          await room.localParticipant.unpublishTrack(pub.track, true);
        } catch {
          // ignore
        }
      } else if (prevTrack) {
        try {
          await room.localParticipant.unpublishTrack(prevTrack, true);
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.error("switchMicrophone failed:", e);
      setError(`❌ switchMicrophone error: ${e?.message || String(e)}`);
    }
  };

  const endCall = ({ sendHangup = true } = {}) => {
    connectAttemptRef.current += 1;
    try {
      if (sendHangup && socket && remoteId && roomName) {
        socket.emit("hangup", { to: remoteId, roomName });
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
    callStatusRef.current = "ended";
    onEnd && onEnd();
  };

  useEffect(() => {
    const onSubscribed = (track) => {
      if (track.kind === Track.Kind.Video && remoteVideo.current) {
        setRemoteHasVideo(true);
        track.attach(remoteVideo.current);
      }
      if (track.kind === Track.Kind.Audio && remoteAudio.current) {
        remoteAudio.current.muted = voiceOutputMuted;
        remoteAudio.current.volume = Math.max(
          0,
          Math.min(1, useMediaDeviceStore.getState().outputVolume / 100),
        );
        track.attach(remoteAudio.current);
        if (selectedSpeakerId) applySpeaker(selectedSpeakerId);
      }
    };

    const onUnsubscribed = (track) => {
      try {
        if (track.kind === Track.Kind.Video) setRemoteHasVideo(false);
        track.detach();
      } catch {
        // ignore
      }
    };

    room.on(RoomEvent.TrackSubscribed, onSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onUnsubscribed);

    return () => {
      room.off(RoomEvent.TrackSubscribed, onSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onUnsubscribed);
    };
  }, [room]);

  useEffect(() => {
    const handleHangup = ({ from, roomName: rn }) => {
      if (from !== remoteId) return;
      if (roomName && rn && rn !== roomName) return;
      endCall({ sendHangup: false });
    };

    if (!socket) return () => {};
    socket.on("hangup", handleHangup);
    return () => socket.off("hangup", handleHangup);
  }, [socket, remoteId, roomName]);

  useEffect(() => retainSharedRoom(roomName), [roomName]);

  useEffect(() => {
    if (!autoStart) return;

    if (!roomName) return;

    let active = true;
    const attempt = ++connectAttemptRef.current;

    const finishConnectedUi = async () => {
      await room.localParticipant.enableCameraAndMicrophone();
      await room.localParticipant.setMicrophoneEnabled(!voiceMicMuted);
      if (!active || attempt !== connectAttemptRef.current) return;

      const camPub = room.localParticipant
        .getTrackPublications()
        .find((p) => p.track?.kind === Track.Kind.Video);
      if (camPub?.track && localVideo.current) {
        setLocalHasVideo(true);
        camPub.track.attach(localVideo.current);
      } else {
        setLocalHasVideo(false);
      }

      await refreshDevices();
      if (!active || attempt !== connectAttemptRef.current) return;

      const prefs = useMediaDeviceStore.getState();
      if (prefs.cameraId) await switchCamera(prefs.cameraId);
      if (prefs.microphoneId) await switchMicrophone(prefs.microphoneId);
      if (!active || attempt !== connectAttemptRef.current) return;

      setCallStatus("connected");
      callStatusRef.current = "connected";
    };

    (async () => {
      try {
        if (room.state === "connected") {
          setError(null);
          await finishConnectedUi();
          return;
        }

        setError(null);
        setCallStatus("connecting");
        callStatusRef.current = "connecting";

        const { data } = await axiosInstance.post("/livekit/token", { roomName });
        if (!active || attempt !== connectAttemptRef.current) return;

        const { url, token } = data || {};
        if (!url || !token) throw new Error("Invalid token response");

        await ensureRoomDisconnected(room);
        if (!active || attempt !== connectAttemptRef.current) return;

        await room.connect(url, token);
        if (!active || attempt !== connectAttemptRef.current) return;

        await finishConnectedUi();
      } catch (e) {
        if (!active || attempt !== connectAttemptRef.current) return;
        if (isBenignDisconnectError(e)) {
          setCallStatus("idle");
          callStatusRef.current = "idle";
          return;
        }
        console.error("LiveKit connect error:", e);
        setError(`❌ LiveKit connect error: ${e?.message || String(e)}`);
        setCallStatus("idle");
        callStatusRef.current = "idle";
      }
    })();

    return () => {
      active = false;
      connectAttemptRef.current += 1;
      if (room.state !== "connected") {
        void ensureRoomDisconnected(room);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, roomName, room]);

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
    cameraLiveSwitch: true,
  });

  useEffect(() => {
    const el = remoteAudio.current;
    if (!el) return;
    el.volume = Math.max(0, Math.min(1, outputVolume / 100));
  }, [outputVolume, callStatus]);

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
    if (remoteAudio.current) remoteAudio.current.muted = voiceOutputMuted;
  }, [voiceOutputMuted, callStatus]);

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-[var(--discord-panel)] p-4">
      <h2 className="mb-4 flex items-center gap-3 text-xl font-bold lg:text-2xl">
        <span>Video Call</span>
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
            onClick={endCall}
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
                className="discord-select w-full rounded-lg px-3 py-2 text-sm"
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
                className="discord-select w-full rounded-lg px-3 py-2 text-sm"
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
                className="discord-select w-full rounded-lg px-3 py-2 text-sm"
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[var(--discord-panel)] shadow-lg">
          <p className="border-b border-white/10 bg-black/10 p-3 text-sm text-base-content/70">You</p>
          <div className="relative h-56 w-full bg-[var(--discord-sidebar)] md:h-72">
            {!localHasVideo ? (
              <div className="flex h-full items-center justify-center">
                <img
                  src={authUser?.profilePic || "/avatar.png"}
                  alt={authUser?.fullName || "You"}
                  className="size-24 rounded-full border-2 border-white/10 object-cover"
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
              className={`h-56 w-full bg-black object-cover md:h-72 ${localHasVideo ? "" : "pointer-events-none absolute inset-0 opacity-0"}`}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[var(--discord-panel)] shadow-lg">
          <p className="border-b border-white/10 bg-black/10 p-3 text-sm text-base-content/70">Remote</p>
          <div className="relative h-56 w-full bg-[var(--discord-sidebar)] md:h-72">
            {!remoteHasVideo ? (
              <div className="flex h-full items-center justify-center">
                <img
                  src={
                    users.find((u) => String(u._id) === String(remoteId))?.profilePic ||
                    "/avatar.png"
                  }
                  alt="Remote"
                  className="size-24 rounded-full border-2 border-white/10 object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "/avatar.png";
                  }}
                />
              </div>
            ) : null}
            <video
              ref={remoteVideo}
              autoPlay
              playsInline
              className={`h-56 w-full bg-black object-cover md:h-72 ${remoteHasVideo ? "" : "pointer-events-none absolute inset-0 opacity-0"}`}
            />
          </div>
          <audio ref={remoteAudio} autoPlay className="hidden" />
        </div>
      </div>
    </div>
  );
}

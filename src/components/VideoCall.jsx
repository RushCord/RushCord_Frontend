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

  const room = useMemo(() => new Room(), []);
  const [callStatus, setCallStatus] = useState("idle"); // idle, connecting, connected, ended
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const [cameras, setCameras] = useState([]); // [{ deviceId, label }]
  const [microphones, setMicrophones] = useState([]); // [{ deviceId, label }]
  const [speakers, setSpeakers] = useState([]); // [{ deviceId, label }]
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [selectedMicId, setSelectedMicId] = useState("");
  const [selectedSpeakerId, setSelectedSpeakerId] = useState("");
  const [speakerSupported, setSpeakerSupported] = useState(true);

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
    } catch (e) {
      setSpeakerSupported(false);
      console.error("setSinkId failed:", e);
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
    if (callStatus !== "connected") return;
    try {
      const pub = room.localParticipant
        .getTrackPublications()
        .find((p) => p.track?.kind === Track.Kind.Audio);
      const prevTrack = pub?.track || null;

      const nextTrack = await createLocalAudioTrack({
        deviceId: { exact: deviceId },
      });

      await room.localParticipant.publishTrack(nextTrack);

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

  const connectToRoom = async () => {
    if (!roomName) {
      setError("Missing roomName");
      return;
    }
    try {
      setError(null);
      setCallStatus("connecting");

      const { data } = await axiosInstance.post("/livekit/token", { roomName });
      const { url, token } = data || {};
      if (!url || !token) throw new Error("Invalid token response");

      await room.connect(url, token);
      await room.localParticipant.enableCameraAndMicrophone();

      // attach local preview
      const camPub = room.localParticipant.getTrackPublications().find((p) => p.track?.kind === Track.Kind.Video);
      if (camPub?.track && localVideo.current) {
        camPub.track.attach(localVideo.current);
      }

      await refreshDevices();
      setCallStatus("connected");
    } catch (e) {
      console.error("LiveKit connect error:", e);
      setError(`❌ LiveKit connect error: ${e?.message || String(e)}`);
      setCallStatus("idle");
    }
  };

  const endCall = ({ sendHangup = true } = {}) => {
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
    onEnd && onEnd();
  };

  useEffect(() => {
    const onSubscribed = (track) => {
      if (track.kind === Track.Kind.Video && remoteVideo.current) {
        track.attach(remoteVideo.current);
      }
      if (track.kind === Track.Kind.Audio && remoteAudio.current) {
        track.attach(remoteAudio.current);
        if (selectedSpeakerId) applySpeaker(selectedSpeakerId);
      }
    };

    const onUnsubscribed = (track) => {
      try {
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
      try {
        room.disconnect();
      } catch {
        // ignore
      }
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

  useEffect(() => {
    if (!autoStart) return;
    if (callStatus !== "idle") return;
    if (!roomName) return;
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

  return (
    <div className="w-full bg-gray-900 rounded-xl p-4">
      <h2 className="text-white text-xl lg:text-2xl font-bold mb-4 flex items-center gap-3">
        <span>Video Call</span>
        <span className="ml-auto flex items-center gap-2">
          <span
            className={`text-base px-3 py-1.5 rounded-lg ${
              callStatus === "idle"
                ? "bg-gray-700"
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
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-base border border-gray-700"
          >
            Settings
          </button>

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

      {showSettings && (
        <div className="mb-4 rounded-xl border border-gray-700 bg-gray-950/40 p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-300 mb-1">Camera</label>
              <select
                value={selectedCameraId}
                onChange={(e) => switchCamera(e.target.value)}
                className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700"
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
              <label className="block text-xs text-gray-300 mb-1">Mic</label>
              <select
                value={selectedMicId}
                onChange={(e) => switchMicrophone(e.target.value)}
                className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700"
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
              <label className="block text-xs text-gray-300 mb-1">Speaker</label>
              <select
                value={selectedSpeakerId}
                onChange={(e) => setSelectedSpeakerId(e.target.value)}
                className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700"
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
                <div className="mt-1 text-xs text-gray-400">
                  Speaker select not supported in this browser.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-black rounded-lg overflow-hidden">
          <p className="text-white text-sm p-3 bg-gray-800">You</p>
          <video
            ref={localVideo}
            autoPlay
            playsInline
            muted
            className="w-full h-56 md:h-72 object-cover bg-black"
          />
        </div>

        <div className="bg-black rounded-lg overflow-hidden">
          <p className="text-white text-sm p-3 bg-gray-800">Remote</p>
          <video
            ref={remoteVideo}
            autoPlay
            playsInline
            className="w-full h-56 md:h-72 object-cover bg-black"
          />
          <audio ref={remoteAudio} autoPlay />
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef } from "react";
import { useMediaDeviceStore } from "../store/useMediaDeviceStore";

/**
 * Applies camera / mic / speaker changes from User Settings (useMediaDeviceStore)
 * to an active LiveKit session.
 */
export function useLiveKitMediaDeviceSync({
  callStatus,
  selectedCameraId,
  selectedMicId,
  selectedSpeakerId,
  switchCamera,
  switchMicrophone,
  applySpeaker,
  /** When false, only sync selected camera id (e.g. voice channel with video off). */
  cameraLiveSwitch = true,
  setSelectedCameraId,
}) {
  const storeCameraId = useMediaDeviceStore((s) => s.cameraId);
  const storeMicrophoneId = useMediaDeviceStore((s) => s.microphoneId);
  const storeSpeakerId = useMediaDeviceStore((s) => s.speakerId);

  const switchCameraRef = useRef(switchCamera);
  const switchMicRef = useRef(switchMicrophone);
  const applySpeakerRef = useRef(applySpeaker);
  switchCameraRef.current = switchCamera;
  switchMicRef.current = switchMicrophone;
  applySpeakerRef.current = applySpeaker;

  useEffect(() => {
    if (callStatus !== "connected") return;
    if (!storeMicrophoneId || storeMicrophoneId === selectedMicId) return;
    switchMicRef.current(storeMicrophoneId);
  }, [callStatus, storeMicrophoneId, selectedMicId]);

  useEffect(() => {
    if (callStatus !== "connected") return;
    if (!storeCameraId || storeCameraId === selectedCameraId) return;
    if (cameraLiveSwitch) {
      switchCameraRef.current(storeCameraId);
    } else if (setSelectedCameraId) {
      setSelectedCameraId(storeCameraId);
    }
  }, [
    callStatus,
    storeCameraId,
    selectedCameraId,
    cameraLiveSwitch,
    setSelectedCameraId,
  ]);

  useEffect(() => {
    if (callStatus !== "connected") return;
    if (storeSpeakerId === selectedSpeakerId) return;
    applySpeakerRef.current(storeSpeakerId || "");
  }, [callStatus, storeSpeakerId, selectedSpeakerId]);
}

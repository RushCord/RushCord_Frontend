import { create } from "zustand";

const STORAGE_KEY = "rushcord-media-devices";

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function persist(patch) {
  const next = { ...readStored(), ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

const stored = readStored();

export const useMediaDeviceStore = create((set) => ({
  cameraId: stored.cameraId || "",
  microphoneId: stored.microphoneId || "",
  speakerId: stored.speakerId || "",
  outputVolume: typeof stored.outputVolume === "number" ? stored.outputVolume : 100,
  inputVolume: typeof stored.inputVolume === "number" ? stored.inputVolume : 100,

  setCameraId: (cameraId) => {
    persist({ cameraId });
    set({ cameraId });
  },
  setMicrophoneId: (microphoneId) => {
    persist({ microphoneId });
    set({ microphoneId });
  },
  setSpeakerId: (speakerId) => {
    persist({ speakerId });
    set({ speakerId });
  },
  setOutputVolume: (outputVolume) => {
    persist({ outputVolume });
    set({ outputVolume });
  },
  setInputVolume: (inputVolume) => {
    persist({ inputVolume });
    set({ inputVolume });
  },
}));

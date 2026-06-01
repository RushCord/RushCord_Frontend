export function pickDeviceId(devices, preferredId) {
  if (preferredId && devices.some((d) => d.deviceId === preferredId)) return preferredId;
  return devices[0]?.deviceId || "";
}

export async function requestMediaPermission() {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    return true;
  } catch {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch {
      return false;
    }
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}

export async function enumerateMediaDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return { cameras: [], microphones: [], speakers: [] };
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  const toList = (kind, prefix) =>
    devices
      .filter((d) => d.kind === kind)
      .map((d, idx) => ({
        deviceId: d.deviceId,
        label: d.label || `${prefix} ${idx + 1}`,
      }));

  return {
    cameras: toList("videoinput", "Camera"),
    microphones: toList("audioinput", "Microphone"),
    speakers: toList("audiooutput", "Loa"),
  };
}

export function isSinkIdSupported() {
  if (typeof document === "undefined") return false;
  const probe = document.createElement("audio");
  return typeof probe.setSinkId === "function";
}

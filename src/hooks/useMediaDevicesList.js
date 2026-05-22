import { useCallback, useEffect, useState } from "react";
import { enumerateMediaDevices, requestMediaPermission } from "../lib/mediaDevices";

export function useMediaDevicesList(enabled) {
  const [cameras, setCameras] = useState([]);
  const [microphones, setMicrophones] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const ok = await requestMediaPermission();
    setPermissionGranted(ok);
    const lists = await enumerateMediaDevices();
    setCameras(lists.cameras);
    setMicrophones(lists.microphones);
    setSpeakers(lists.speakers);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const handler = () => refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", handler);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
  }, [enabled, refresh]);

  return { cameras, microphones, speakers, loading, permissionGranted, refresh };
}

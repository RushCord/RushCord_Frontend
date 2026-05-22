import { useEffect, useRef, useState } from "react";
import { isSinkIdSupported } from "../../lib/mediaDevices";
import { useMediaDevicesList } from "../../hooks/useMediaDevicesList";
import { useMediaDeviceStore } from "../../store/useMediaDeviceStore";

const selectClass =
  "w-full rounded-md border border-(--discord-border) bg-(--discord-sidebar) px-3 py-2 text-sm text-(--discord-text) outline-none focus:border-(--discord-accent)";

function DeviceSelect({ label, hint, value, onChange, devices, emptyLabel }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-(--discord-text-muted)">
        {label}
      </div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        {devices.length === 0 ? (
          <option value="">{emptyLabel}</option>
        ) : (
          devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label}
            </option>
          ))
        )}
      </select>
      {hint ? <p className="mt-1 text-xs text-(--discord-text-muted)">{hint}</p> : null}
    </label>
  );
}

function VolumeSlider({ label, hint, value, onChange }) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-(--discord-text-muted)">
          {label}
        </span>
        <span className="text-sm text-(--discord-text)">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range range-primary range-sm w-full"
      />
      {hint ? <p className="mt-1 text-xs text-(--discord-text-muted)">{hint}</p> : null}
    </label>
  );
}

export function VideoSettingsPanel({ enabled }) {
  const { cameras, loading, permissionGranted } = useMediaDevicesList(enabled);
  const cameraId = useMediaDeviceStore((s) => s.cameraId);
  const setCameraId = useMediaDeviceStore((s) => s.setCameraId);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!enabled || !cameraId) return;
    let stream;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: cameraId } },
          audio: false,
        });
        if (cancelled) return;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        if (videoRef.current) videoRef.current.srcObject = null;
      }
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [enabled, cameraId]);

  useEffect(() => {
    if (!enabled || cameraId || cameras.length === 0) return;
    setCameraId(cameras[0].deviceId);
  }, [enabled, cameraId, cameras, setCameraId]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h3 className="mb-1 text-2xl font-semibold text-(--discord-text)">Camera</h3>
        <p className="text-sm text-(--discord-text-muted)">
          Chọn camera mặc định cho cuộc gọi video và kênh thoại.
        </p>
      </div>

      {!permissionGranted ? (
        <p className="text-sm text-amber-400">
          Trình duyệt chưa cấp quyền camera. Hãy cho phép truy cập để xem danh sách thiết bị.
        </p>
      ) : null}

      <DeviceSelect
        label="Thiết bị video"
        value={cameraId}
        onChange={setCameraId}
        devices={cameras}
        emptyLabel={loading ? "Đang tải..." : "Không có camera"}
      />

      <div className="overflow-hidden rounded-xl border border-(--discord-border) bg-black/40">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="aspect-video w-full object-cover"
        />
        {!cameraId ? (
          <p className="px-4 py-6 text-center text-sm text-(--discord-text-muted)">
            Chọn camera để xem trước.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function MicSettingsPanel({ enabled }) {
  const { microphones, loading, permissionGranted } = useMediaDevicesList(enabled);
  const microphoneId = useMediaDeviceStore((s) => s.microphoneId);
  const setMicrophoneId = useMediaDeviceStore((s) => s.setMicrophoneId);
  const inputVolume = useMediaDeviceStore((s) => s.inputVolume);
  const setInputVolume = useMediaDeviceStore((s) => s.setInputVolume);
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!enabled || !microphoneId) {
      setLevel(0);
      return;
    }

    let stream;
    let raf;
    let ctx;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: microphoneId },
            volume: Math.max(0.01, inputVolume / 100),
          },
          video: false,
        });
        if (cancelled) return;

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          setLevel(Math.min(100, Math.round((avg / 255) * 140)));
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setLevel(0);
      }
    })();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      ctx?.close?.().catch(() => {});
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [enabled, microphoneId, inputVolume]);

  useEffect(() => {
    if (!enabled || microphoneId || microphones.length === 0) return;
    setMicrophoneId(microphones[0].deviceId);
  }, [enabled, microphoneId, microphones, setMicrophoneId]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h3 className="mb-1 text-2xl font-semibold text-(--discord-text)">Microphone</h3>
        <p className="text-sm text-(--discord-text-muted)">
          Chọn mic mặc định và điều chỉnh mức âm lượng đầu vào.
        </p>
      </div>

      {!permissionGranted ? (
        <p className="text-sm text-amber-400">
          Trình duyệt chưa cấp quyền micro. Hãy cho phép truy cập để kiểm tra thiết bị.
        </p>
      ) : null}

      <DeviceSelect
        label="Thiết bị đầu vào"
        value={microphoneId}
        onChange={setMicrophoneId}
        devices={microphones}
        emptyLabel={loading ? "Đang tải..." : "Không có micro"}
        hint="Nói thử để xem thanh mức âm thanh bên dưới."
      />

      <VolumeSlider
        label="Âm lượng mic"
        hint="Áp dụng khi bật mic trong cuộc gọi hoặc kênh thoại."
        value={inputVolume}
        onChange={setInputVolume}
      />

      <div className="rounded-xl border border-(--discord-border) bg-(--discord-rail) p-4">
        <div className="mb-2 text-sm font-semibold text-(--discord-text)">Kiểm tra mic</div>
        <div className="h-3 overflow-hidden rounded-full bg-(--discord-sidebar)">
          <div
            className="h-full rounded-full bg-(--discord-accent) transition-[width] duration-75"
            style={{ width: `${level}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function AudioSettingsPanel({ enabled }) {
  const { speakers, loading } = useMediaDevicesList(enabled);
  const speakerId = useMediaDeviceStore((s) => s.speakerId);
  const setSpeakerId = useMediaDeviceStore((s) => s.setSpeakerId);
  const outputVolume = useMediaDeviceStore((s) => s.outputVolume);
  const setOutputVolume = useMediaDeviceStore((s) => s.setOutputVolume);
  const sinkSupported = isSinkIdSupported();

  const playTestSound = async () => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = Math.max(0.01, (outputVolume / 100) * 0.2);
    osc.frequency.value = 520;
    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => ctx.close().catch(() => {});
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h3 className="mb-1 text-2xl font-semibold text-(--discord-text)">Âm thanh đầu ra</h3>
        <p className="text-sm text-(--discord-text-muted)">
          Chọn loa/tai nghe và mức âm lượng khi nghe cuộc gọi hoặc kênh thoại.
        </p>
      </div>

      <DeviceSelect
        label="Thiết bị đầu ra"
        value={speakerId}
        onChange={setSpeakerId}
        devices={[{ deviceId: "", label: "Mặc định hệ thống" }, ...speakers]}
        emptyLabel={loading ? "Đang tải..." : "Mặc định hệ thống"}
        hint={
          sinkSupported
            ? "Một số trình duyệt chỉ hỗ trợ chọn loa trên Chrome/Edge."
            : "Trình duyệt này không hỗ trợ chọn loa riêng; dùng loa mặc định hệ thống."
        }
      />

      <VolumeSlider
        label="Âm lượng đầu ra"
        hint="Điều chỉnh âm lượng khi nghe người khác trong cuộc gọi."
        value={outputVolume}
        onChange={setOutputVolume}
      />

      <button
        type="button"
        onClick={playTestSound}
        className="rounded-md bg-(--discord-accent) px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Phát âm thanh thử
      </button>
    </div>
  );
}

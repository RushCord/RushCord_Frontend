import { useEffect } from "react";
import { Download, X } from "lucide-react";
import { downloadAttachment } from "../lib/downloadAttachment";

export default function MediaLightboxModal({
  open,
  type = "image",
  url,
  fileName,
  onClose,
}) {
  const handleDownload = async () => {
    if (!url) return;
    await downloadAttachment(url, fileName);
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || !url) return null;

  const label =
    fileName ||
    (type === "video" ? "Video" : "Hình ảnh");

  return (
    <div
      className={`discord-modal-scrim fixed inset-0 z-[80] flex items-center justify-center bg-black/80 ${
        type === "video" ? "p-2" : "p-4"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="presentation"
    >
      <div
        className={`relative flex w-full flex-col ${
          type === "video"
            ? "max-h-[96vh] max-w-[min(98vw,1600px)]"
            : "max-h-[92vh] max-w-5xl"
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <p className="min-w-0 truncate text-sm text-white/80">{label}</p>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={handleDownload}
              className="discord-icon-button flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="Tải xuống"
              title="Tải xuống"
            >
              <Download className="size-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="discord-icon-button flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="Đóng"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div
          className={`flex w-full min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-black/40 ${
            type === "video" ? "min-h-[min(70vh,720px)]" : ""
          }`}
        >
          {type === "video" ? (
            <video
              key={url}
              src={url}
              controls
              autoPlay
              playsInline
              className="h-auto max-h-[min(88vh,900px)] w-full min-w-[min(92vw,1200px)] rounded-lg object-contain"
            />
          ) : (
            <img
              src={url}
              alt={label}
              className="max-h-[calc(92vh-3rem)] max-w-full rounded-lg object-contain"
            />
          )}
        </div>
      </div>
    </div>
  );
}

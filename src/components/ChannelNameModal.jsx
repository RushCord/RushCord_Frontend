import { useEffect, useState } from "react";
import { X } from "lucide-react";

const CREATE_TITLES = {
  INFO: "Tạo kênh thông tin",
  CHAT: "Tạo kênh chat",
  VOICE: "Tạo kênh thoại",
};

export default function ChannelNameModal({
  open,
  onClose,
  mode = "create",
  channelType = "CHAT",
  initialName = "",
  onSubmit,
  isSubmitting = false,
}) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(String(initialName || ""));
  }, [open, initialName]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => {
      if (e.key === "Escape" && !isSubmitting) onClose?.();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose, isSubmitting]);

  if (!open) return null;

  const title =
    mode === "edit"
      ? "Đổi tên kênh"
      : CREATE_TITLES[channelType] || "Tạo kênh";

  const trimmed = String(name || "").trim();
  const canSubmit = trimmed.length > 0 && !isSubmitting;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit?.(trimmed);
  };

  return (
    <div
      className="discord-modal-scrim fixed inset-0 z-[2200] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose?.();
      }}
      role="presentation"
    >
      <div
        className="discord-modal-card w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="channel-name-modal-title"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 id="channel-name-modal-title" className="text-lg font-semibold">
            {title}
          </h3>
          <button
            type="button"
            className="rounded p-1 text-(--discord-text-muted) hover:bg-white/5 disabled:opacity-40"
            disabled={isSubmitting}
            onClick={() => onClose?.()}
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div>
            <label
              htmlFor="channel-name-input"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-(--discord-text-muted)"
            >
              Tên kênh
            </label>
            <input
              id="channel-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="tên-kênh"
              autoFocus
              disabled={isSubmitting}
              className="w-full rounded-md border border-white/10 bg-(--discord-input) px-3 py-2 text-sm outline-none focus:border-(--discord-accent)"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md px-4 py-2 text-sm text-(--discord-text-muted) hover:bg-white/5 disabled:opacity-40"
              disabled={isSubmitting}
              onClick={() => onClose?.()}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded-md bg-(--discord-accent) px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canSubmit}
            >
              {isSubmitting
                ? "Đang lưu..."
                : mode === "edit"
                  ? "Lưu"
                  : "Tạo kênh"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { ChevronRight, Headphones, Mic, Monitor, Video, X } from "lucide-react";
import { THEME_OPTIONS } from "../constants";
import { useThemeStore } from "../store/useThemeStore";
import { useAuthStore } from "../store/useAuthStore";
import {
  AudioSettingsPanel,
  MicSettingsPanel,
  VideoSettingsPanel,
} from "./settings/AppMediaSettingsPanels";

const APP_SETTINGS_ITEMS = [
  { key: "display", label: "Hiển thị", icon: Monitor },
  { key: "video", label: "Video", icon: Video },
  { key: "mic", label: "Micro", icon: Mic },
  { key: "audio", label: "Âm thanh", icon: Headphones },
];

const SECTION_TITLES = {
  display: "Hiển thị",
  video: "Video",
  mic: "Micro",
  audio: "Âm thanh",
};

export default function UserSettingsModal({ open, onClose }) {
  const { theme, setTheme } = useThemeStore();
  const { logout } = useAuthStore();
  const [activeSection, setActiveSection] = useState("display");
  const [previewTheme, setPreviewTheme] = useState(theme);

  useEffect(() => {
    if (!open) return;
    setActiveSection("display");
    setPreviewTheme(theme);
  }, [open, theme]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  const hasPendingThemeChange = previewTheme !== theme;
  const mediaEnabled = activeSection === "video" || activeSection === "mic" || activeSection === "audio";

  return (
    <div
      className="fixed inset-0 z-2500 flex items-stretch justify-center bg-black/70"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-full w-full max-w-[1220px] overflow-hidden border border-(--discord-border) bg-(--discord-panel) shadow-2xl">
        <aside className="w-[320px] min-w-[320px] overflow-y-auto border-r border-(--discord-border) bg-(--discord-sidebar) px-4 py-4">
          <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-(--discord-text-muted)">
            Cài Đặt Ứng Dụng
          </div>
          <div className="space-y-0.5">
            {APP_SETTINGS_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveSection(item.key)}
                  className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[15px] ${
                    active
                      ? "bg-(--discord-active) text-(--discord-active-text)"
                      : "text-(--discord-text) hover:bg-(--discord-hover)"
                  }`}
                >
                  <Icon className="size-4" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 border-t border-(--discord-border) pt-4">
            <button
              type="button"
              onClick={async () => {
                await logout();
                onClose?.();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[15px] text-red-400 hover:bg-red-500/15 hover:text-red-300"
            >
              <ChevronRight className="size-4 rotate-180" />
              <span>Đăng Xuất</span>
            </button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-(--discord-panel)">
          <div className="flex items-center justify-between border-b border-(--discord-border) px-6 py-4">
            <h2 className="text-lg font-semibold text-(--discord-text)">
              {SECTION_TITLES[activeSection] || "Cài đặt"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-md text-(--discord-text-muted) hover:bg-(--discord-hover) hover:text-(--discord-text)"
              aria-label="Đóng"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            {activeSection === "display" ? (
              <div className="max-w-3xl space-y-6">
                <div>
                  <h3 className="mb-2 text-2xl font-semibold text-(--discord-text)">Nền</h3>
                  <div className="text-sm text-(--discord-text-muted)">Nền Chủ Đề Mặc Định</div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {THEME_OPTIONS.map((option) => {
                    const active = previewTheme === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setPreviewTheme(option.id)}
                        className={`relative size-11 rounded-lg border transition ${
                          active
                            ? "border-(--discord-accent) ring-2 ring-(--discord-accent)"
                            : "border-(--discord-border) hover:border-(--discord-border-strong)"
                        }`}
                        title={option.label}
                        aria-label={option.label}
                      >
                        <div
                          data-theme={option.id}
                          className="flex h-full w-full overflow-hidden rounded-md"
                        >
                          <div
                            className="w-2/5"
                            style={{ backgroundColor: "var(--discord-sidebar)" }}
                          />
                          <div
                            className="w-3/5"
                            style={{ backgroundColor: "var(--discord-chat)" }}
                          />
                        </div>
                        {active ? (
                          <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-(--discord-accent) text-[10px] text-white">
                            ✓
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-xl border border-(--discord-border) bg-(--discord-rail) p-4">
                  <div className="mb-2 text-sm font-semibold text-(--discord-text)">Màu sắc chủ đề</div>
                  <p className="text-sm text-(--discord-text-muted)">
                    Chọn một chủ đề để áp dụng cho toàn bộ giao diện ứng dụng.
                  </p>
                </div>

                <div
                  data-theme={previewTheme}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: "var(--discord-border)",
                    backgroundColor: "var(--discord-app)",
                  }}
                >
                  <div
                    className="mb-3 text-sm font-semibold"
                    style={{ color: "var(--discord-text)" }}
                  >
                    Preview trước khi đổi màu
                  </div>
                  <div
                    className="flex items-stretch overflow-hidden rounded-lg border"
                    style={{ borderColor: "var(--discord-border)" }}
                  >
                    <div className="w-16 p-2" style={{ backgroundColor: "var(--discord-rail)" }}>
                      <div
                        className="mb-2 size-8 rounded-xl"
                        style={{ backgroundColor: "var(--discord-accent)" }}
                      />
                      <div
                        className="size-8 rounded-xl"
                        style={{ backgroundColor: "var(--discord-sidebar)" }}
                      />
                    </div>
                    <div className="w-40 p-3" style={{ backgroundColor: "var(--discord-sidebar)" }}>
                      <div className="mb-2 h-3 w-20 rounded" style={{ backgroundColor: "var(--discord-hover)" }} />
                      <div
                        className="mb-1 h-2.5 w-24 rounded"
                        style={{ backgroundColor: "var(--discord-active)" }}
                      />
                      <div className="h-2.5 w-16 rounded" style={{ backgroundColor: "var(--discord-hover)" }} />
                    </div>
                    <div className="flex-1 p-3" style={{ backgroundColor: "var(--discord-chat)" }}>
                      <div className="mb-2 h-3 w-24 rounded" style={{ backgroundColor: "var(--discord-hover)" }} />
                      <div
                        className="h-16 rounded"
                        style={{ backgroundColor: "var(--discord-panel-strong)" }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTheme(previewTheme)}
                    disabled={!hasPendingThemeChange}
                    className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-content disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Áp dụng màu
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTheme(theme)}
                    disabled={!hasPendingThemeChange}
                    className="rounded-md border border-(--discord-border) px-3 py-2 text-sm text-(--discord-text-muted) hover:bg-(--discord-hover) disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Hoàn tác preview
                  </button>
                </div>
              </div>
            ) : null}

            {activeSection === "video" ? (
              <VideoSettingsPanel enabled={open && mediaEnabled} />
            ) : null}
            {activeSection === "mic" ? (
              <MicSettingsPanel enabled={open && mediaEnabled} />
            ) : null}
            {activeSection === "audio" ? (
              <AudioSettingsPanel enabled={open && mediaEnabled} />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

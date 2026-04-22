import { THEMES } from "../constants";
import { useThemeStore } from "../store/useThemeStore";
import { Hash, Palette, Pin, Search, Send, Smile, Users } from "lucide-react";

const PREVIEW_MESSAGES = [
  { id: 1, content: "Hey! How's it going?", isSent: false },
  { id: 2, content: "I'm doing great! Just working on some new features.", isSent: true },
];

export const SettingsPage = () => {
  const { theme, setTheme } = useThemeStore();

  return (
    <div className="min-h-screen bg-[var(--discord-app)] px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="discord-card overflow-hidden">
          <div className="discord-topbar flex items-center gap-3 px-5 py-4">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Palette className="size-5" />
            </div>
            <div>
              <div className="discord-section-title mb-1">Appearance</div>
              <h2 className="text-lg font-semibold">Theme</h2>
              <p className="text-sm text-base-content/70">
                Keep your current theme system and preview it in a Discord-style shell.
              </p>
            </div>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {THEMES.map((t) => (
                <button
                  key={t}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    theme === t
                      ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                      : "border-white/10 bg-black/10 hover:bg-white/5"
                  }`}
                  onClick={() => setTheme(t)}
                >
                  <div className="relative mb-3 h-16 overflow-hidden rounded-lg" data-theme={t}>
                    <div className="absolute inset-0 grid grid-cols-[18px_1fr]">
                      <div className="bg-base-300" />
                      <div className="bg-base-100 p-1.5">
                        <div className="mb-1 h-3 rounded bg-base-200" />
                        <div className="grid grid-cols-4 gap-1">
                          <div className="h-8 rounded bg-primary" />
                          <div className="h-8 rounded bg-secondary" />
                          <div className="h-8 rounded bg-accent" />
                          <div className="h-8 rounded bg-neutral" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="truncate text-xs font-semibold">
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="discord-card overflow-hidden">
          <div className="discord-topbar flex items-center justify-between gap-3 px-5 py-4">
            <div>
              <div className="discord-section-title mb-1">Preview</div>
              <h3 className="text-lg font-semibold">Discord-style live mockup</h3>
            </div>
            <div className="flex items-center gap-2 text-base-content/60">
              <Pin className="size-4" />
              <Search className="size-4" />
              <Users className="size-4" />
            </div>
          </div>

          <div className="p-5">
            <div className="mx-auto grid max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[var(--discord-chat)] shadow-2xl lg:grid-cols-[72px_260px_1fr_220px]">
              <div className="discord-rail flex min-h-[440px] flex-col items-center gap-3 p-3">
                <div className="flex size-11 items-center justify-center rounded-[16px] bg-primary text-primary-content">
                  <Hash className="size-5" />
                </div>
                <div className="flex size-11 items-center justify-center rounded-[16px] bg-white/5 text-base-content/70">
                  <Users className="size-5" />
                </div>
              </div>

              <div className="discord-sidebar flex min-h-[440px] flex-col p-3">
                <div className="discord-section-title mb-3 px-2">Channels</div>
                <div className="space-y-1">
                  <div className="discord-list-item is-active">
                    <Hash className="size-4" />
                    <span className="text-sm">general</span>
                  </div>
                  <div className="discord-list-item">
                    <Hash className="size-4" />
                    <span className="text-sm">product-feedback</span>
                  </div>
                  <div className="discord-list-item">
                    <Hash className="size-4" />
                    <span className="text-sm">rushcord-ai</span>
                  </div>
                </div>
                <div className="discord-user-panel mt-auto flex items-center gap-3 rounded-xl px-3 py-3">
                  <div className="relative">
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-content">
                      J
                    </div>
                    <span className="discord-status-dot" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">John Doe</div>
                    <div className="text-xs text-base-content/60">Online</div>
                  </div>
                </div>
              </div>

              <div className="flex min-h-[440px] flex-col">
                <div className="discord-topbar flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Hash className="size-4 text-base-content/60" />
                    <span className="font-semibold">general</span>
                  </div>
                  <div className="flex items-center gap-2 text-base-content/60">
                    <Pin className="size-4" />
                    <Search className="size-4" />
                  </div>
                </div>
                <div className="flex-1 space-y-4 px-4 py-5">
                  {PREVIEW_MESSAGES.map((message) => (
                    <div
                      key={message.id}
                      className={`flex items-end gap-3 ${message.isSent ? "justify-end" : "justify-start"}`}
                    >
                      {!message.isSent && (
                        <div className="flex size-10 items-center justify-center rounded-full bg-white/5 text-xs font-semibold">
                          A
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-2xl border px-4 py-3 text-sm ${
                          message.isSent
                            ? "border-primary/40 bg-primary text-primary-content"
                            : "border-white/10 bg-[var(--discord-panel)]"
                        }`}
                      >
                        <p>{message.content}</p>
                        <p
                          className={`mt-1.5 text-[10px] ${
                            message.isSent ? "text-primary-content/70" : "text-base-content/60"
                          }`}
                        >
                          12:00 PM
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-4">
                  <div className="discord-composer flex items-center gap-3 px-3 py-3">
                    <Smile className="size-4 text-base-content/60" />
                    <input
                      type="text"
                      className="discord-input-reset flex-1 text-sm"
                      placeholder="Message #general"
                      value="This is a preview"
                      readOnly
                    />
                    <button className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-content">
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="discord-sidebar hidden min-h-[440px] border-l border-white/10 p-3 lg:block">
                <div className="discord-section-title mb-3">Members</div>
                <div className="space-y-2">
                  <div className="discord-list-item">
                    <div className="relative">
                      <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-content text-xs font-semibold">
                        J
                      </div>
                      <span className="discord-status-dot" />
                    </div>
                    <span className="text-sm">John Doe</span>
                  </div>
                  <div className="discord-list-item">
                    <div className="relative">
                      <div className="flex size-8 items-center justify-center rounded-full bg-white/5 text-xs font-semibold">
                        A
                      </div>
                      <span className="discord-status-dot" />
                    </div>
                    <span className="text-sm">Alex Kim</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
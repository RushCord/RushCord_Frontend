import { useEffect, useState } from "react";
import { THEME_OPTIONS } from "../constants";
import { useThemeStore } from "../store/useThemeStore";
import { ArrowLeft, Check, Hash, Palette, Pin, Search, Send, Smile, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PREVIEW_MESSAGES = [
  {
    id: 1,
    sender: "Alex Kim",
    content: "Hey! How's it going?",
    isSent: false,
    time: "11:58 AM",
  },
  {
    id: 2,
    sender: "You",
    content: "I'm doing great! Just working on theme colors.",
    isSent: true,
    time: "12:00 PM",
    reaction: "👍 2",
  },
  {
    id: 3,
    sender: "Alex Kim",
    isSent: false,
    time: "12:01 PM",
    file: { label: "PDF", name: "specs.pdf" },
  },
];

export const SettingsPage = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useThemeStore();
  const [previewTheme, setPreviewTheme] = useState(theme);

  useEffect(() => {
    setPreviewTheme(theme);
  }, [theme]);

  const previewLabel =
    THEME_OPTIONS.find((option) => option.id === previewTheme)?.label ?? previewTheme;
  const hasPendingChange = previewTheme !== theme;

  return (
    <div className="min-h-screen bg-[var(--discord-app)] px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="discord-card overflow-hidden">
          <div className="discord-topbar flex items-center gap-3 px-5 py-4">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="discord-icon-button flex size-10 items-center justify-center rounded-full bg-[var(--discord-hover)] md:hidden"
              aria-label="Quay lại tin nhắn"
              title="Quay lại"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Palette className="size-5" />
            </div>
            <div>
              <div className="discord-section-title mb-1">Giao diện</div>
              <h2 className="text-lg font-semibold">Chủ đề</h2>
              <p className="text-sm text-base-content/70">
                Chọn chủ đề để xem trước, sau đó nhấn Áp dụng để đổi toàn bộ ứng dụng.
              </p>
            </div>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {THEME_OPTIONS.map((option) => {
                const isPreview = previewTheme === option.id;
                const isApplied = theme === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`rounded-xl border p-3 text-left transition-all ${
                      isPreview
                        ? "border-primary bg-[var(--discord-active)] shadow-lg shadow-primary/10"
                        : "border-[var(--discord-border)] bg-[var(--discord-hover)] hover:bg-[var(--discord-active)]"
                    }`}
                    onClick={() => setPreviewTheme(option.id)}
                  >
                    <div
                      className="relative mb-3 h-16 overflow-hidden rounded-lg"
                      data-theme={option.id}
                    >
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
                      {isPreview ? (
                        <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-content">
                          <Check className="size-3" />
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{option.label}</span>
                      {isApplied && !hasPendingChange ? (
                        <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          Đang dùng
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-base-content/60">
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTheme(previewTheme)}
                disabled={!hasPendingChange}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-content disabled:cursor-not-allowed disabled:opacity-50"
              >
                Áp dụng
              </button>
              <button
                type="button"
                onClick={() => setPreviewTheme(theme)}
                disabled={!hasPendingChange}
                className="rounded-md border border-[var(--discord-border)] px-4 py-2 text-sm text-base-content/70 hover:bg-[var(--discord-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Hoàn tác
              </button>
            </div>
          </div>
        </div>

        <div className="discord-card overflow-hidden">
          <div className="discord-topbar flex items-center justify-between gap-3 px-5 py-4">
            <div>
              <div className="discord-section-title mb-1">Xem trước</div>
              <h3 className="text-lg font-semibold">Giao diện RushCord — {previewLabel}</h3>
            </div>
            <div className="flex items-center gap-2 text-base-content/60">
              <Pin className="size-4" />
              <Search className="size-4" />
              <Users className="size-4" />
            </div>
          </div>

          <div className="p-5">
            <div
              data-theme={previewTheme}
              className="mx-auto grid max-w-5xl overflow-hidden rounded-2xl border border-[var(--discord-border)] bg-[var(--discord-chat)] shadow-2xl lg:grid-cols-[72px_260px_1fr_220px]"
            >
              <div className="discord-rail flex min-h-[440px] flex-col items-center gap-3 p-3">
                <div className="flex size-11 items-center justify-center rounded-[16px] bg-primary text-primary-content">
                  <Hash className="size-5" />
                </div>
                <div className="flex size-11 items-center justify-center rounded-[16px] bg-[var(--discord-hover)] text-base-content/70">
                  <Users className="size-5" />
                </div>
              </div>

              <div className="discord-sidebar flex min-h-[440px] flex-col p-3">
                <div className="discord-section-title mb-3 px-2">Kênh</div>
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
                      className={`message-row flex items-end gap-3 rounded-md px-1 py-0.5 ${message.isSent ? "justify-end" : "justify-start"}`}
                    >
                      {!message.isSent && (
                        <div className="flex size-10 items-center justify-center rounded-full bg-[var(--discord-hover)] text-xs font-semibold">
                          A
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                          message.isSent ? "message-bubble-sent" : "message-bubble-received"
                        }`}
                      >
                        <div
                          className={`mb-0.5 flex items-end gap-2 ${
                            message.isSent ? "justify-end" : ""
                          }`}
                        >
                          <span
                            className={`text-xs font-bold ${
                              message.isSent ? "message-name-sent" : "message-name-received"
                            }`}
                          >
                            {message.sender}
                          </span>
                          <time
                            className={`text-[10px] ${
                              message.isSent ? "message-meta-sent" : "message-meta-received"
                            }`}
                          >
                            {message.time}
                          </time>
                        </div>
                        {message.file ? (
                          <div className="message-embed mt-1 flex max-w-[240px] items-center gap-2 rounded px-2 py-2">
                            <div className="message-embed-icon flex size-10 flex-col items-center justify-center rounded-lg text-[10px] font-semibold">
                              {message.file.label}
                            </div>
                            <div className="min-w-0">
                              <div className="message-body-received truncate text-sm">
                                {message.file.name}
                              </div>
                              <div className="message-meta-received text-[10px]">Nhấn để mở</div>
                            </div>
                          </div>
                        ) : (
                          <p
                            className={`text-left text-sm leading-snug whitespace-pre-wrap wrap-break-word ${
                              message.isSent
                                ? "message-body-sent"
                                : "message-body-received"
                            }`}
                          >
                            {message.content}
                          </p>
                        )}
                        {message.reaction ? (
                          <button type="button" className="message-reaction mt-1">
                            <span>{message.reaction}</span>
                          </button>
                        ) : null}
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
                      value="Đây là bản xem trước"
                      readOnly
                    />
                    <button
                      type="button"
                      className="flex size-9 items-center justify-center rounded-full bg-[var(--discord-accent)] text-[var(--discord-accent-contrast)]"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="discord-sidebar hidden min-h-[440px] border-l border-[var(--discord-border)] p-3 lg:block">
                <div className="discord-section-title mb-3">Thành viên</div>
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
                      <div className="flex size-8 items-center justify-center rounded-full bg-[var(--discord-hover)] text-xs font-semibold">
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



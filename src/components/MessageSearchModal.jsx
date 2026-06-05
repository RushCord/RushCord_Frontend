import { useCallback, useEffect, useRef, useState } from "react";
import { Hash, Loader2, Search, X } from "lucide-react";
import { AI_BOT_SENDER_ID, RUSHCORD_AI_DISPLAY_NAME } from "../lib/aiChatUtils";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";

function formatMessageTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function ResultRow({ title, subtitle, snippet, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left transition hover:bg-(--discord-hover)"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-(--discord-text)">
          {title}
        </span>
        {subtitle ? (
          <span className="shrink-0 text-[11px] text-(--discord-text-muted)">
            {subtitle}
          </span>
        ) : null}
      </span>
      <span className="line-clamp-2 text-xs text-(--discord-text-muted)">
        {snippet}
      </span>
    </button>
  );
}

export default function MessageSearchModal({
  open,
  onClose,
  conversationId,
  isGroup,
  onJumpComplete,
}) {
  const inputRef = useRef(null);
  const searchSeqRef = useRef(0);
  const { authUser } = useAuthStore();
  const { users, searchMessages, jumpToMessage } = useChatStore();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setDebouncedQuery("");
    setResults([]);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !conversationId) return;

    const q = debouncedQuery;
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const seq = ++searchSeqRef.current;
    setLoading(true);

    searchMessages(conversationId, q).then((data) => {
      if (searchSeqRef.current !== seq) return;
      setResults(Array.isArray(data) ? data : []);
      setLoading(false);
    });

    return () => {
      searchSeqRef.current += 1;
    };
  }, [open, conversationId, debouncedQuery, searchMessages]);

  const resolveSenderName = useCallback(
    (senderId) => {
      const id = String(senderId || "");
      if (id === String(authUser?._id)) return "Bạn";
      if (id === AI_BOT_SENDER_ID) return RUSHCORD_AI_DISPLAY_NAME;
      const u = users.find((x) => String(x._id) === id);
      return u?.fullName || "Thành viên";
    },
    [users, authUser?._id],
  );

  const handleSelect = async (row) => {
    await jumpToMessage({
      messageId: row.messageId,
      channelId: row.channelId,
    });
    onJumpComplete?.();
    onClose?.();
  };

  if (!open) return null;

  const needle = debouncedQuery;
  const showHint = query.trim().length > 0 && query.trim().length < 2;

  return (
    <div
      className="discord-modal-scrim fixed inset-0 z-[2200] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="presentation"
    >
      <div
        className="discord-modal-card flex w-full max-w-lg flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-search-title"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 id="message-search-title" className="font-semibold">
            Tìm kiếm tin nhắn
          </h3>
          <button
            type="button"
            className="discord-icon-button flex size-8 items-center justify-center rounded-full bg-white/5"
            onClick={() => onClose?.()}
            aria-label="Đóng"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="border-b border-white/10 px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/50" />
            <input
              ref={inputRef}
              type="search"
              className="input discord-input-reset w-full rounded-xl border border-white/10 bg-black/10 py-2.5 pl-9 pr-4 text-sm"
              placeholder={
                isGroup
                  ? "Tìm trong toàn bộ kênh nhóm..."
                  : "Tìm trong cuộc trò chuyện..."
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </div>
          {showHint ? (
            <p className="mt-2 text-xs text-(--discord-text-muted)">
              Nhập ít nhất 2 ký tự để tìm.
            </p>
          ) : null}
          {loading ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-(--discord-text-muted)">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Đang tìm...</span>
            </div>
          ) : null}
        </div>

        <div className="discord-scroll max-h-[min(60vh,420px)] overflow-y-auto p-3">
          {needle.length >= 2 && !loading && results.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-(--discord-text-muted)">
              Không tìm thấy tin nhắn.
            </p>
          ) : null}

          {needle.length < 2 && !loading ? (
            <p className="px-2 py-6 text-center text-sm text-(--discord-text-muted)">
              Gõ từ khóa để tìm tin nhắn.
            </p>
          ) : null}

          <div className="space-y-0.5">
            {results.map((row) => {
              const channelLabel =
                isGroup && row.channelName
                  ? `#${row.channelName}`
                  : isGroup && row.channelId
                    ? "Kênh"
                    : null;
              return (
                <ResultRow
                  key={row.messageId}
                  title={resolveSenderName(row.senderId)}
                  subtitle={formatMessageTime(row.createdAt)}
                  snippet={
                    <>
                      {channelLabel ? (
                        <span className="mr-1 inline-flex items-center gap-0.5 font-medium text-(--discord-text)">
                          <Hash className="size-3" />
                          {channelLabel.replace(/^#/, "")}
                          {" · "}
                        </span>
                      ) : null}
                      {row.snippet || row.text || ""}
                    </>
                  }
                  onClick={() => handleSelect(row)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

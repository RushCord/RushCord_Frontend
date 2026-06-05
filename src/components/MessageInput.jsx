import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import {
  Plus,
  Send,
  X,
  Smile,
  FileText,
  Video,
  Play,
  Mic,
  Square,
  AtSign,
  Bot,
} from "lucide-react";
import {
  BOT_PROMPT_SUGGESTIONS,
  getMentionRange,
  isBotPromptMode,
  isRushCordMention,
  stripRushCordMention,
} from "../lib/aiChatUtils";
import toast from "react-hot-toast";
import EmojiPicker from "emoji-picker-react";
import { useAuthStore } from "../store/useAuthStore";

function formatRecordMs(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function MentionOptionRow({ suggestion, onSelect }) {
  const isBot = suggestion.kind === "bot";
  return (
    <button
      type="button"
      onClick={() => onSelect(suggestion)}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-(--discord-hover)"
    >
      {isBot ? (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-green-600 to-teal-600 text-white shadow-sm">
          <Bot className="size-5" />
        </span>
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-(--discord-active) text-sm font-semibold text-(--discord-accent)">
          {(suggestion.label || "?").charAt(1).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-(--discord-text)">
          {suggestion.label}
        </span>
        <span className="block truncate text-xs text-(--discord-text-muted)">
          {suggestion.subtitle}
        </span>
      </span>
      <span className="rounded-full bg-(--discord-active) px-2 py-1 text-[10px] font-semibold text-(--discord-accent)">
        {isBot ? "@RushCord" : "@member"}
      </span>
    </button>
  );
}

function BotPromptRow({ prompt, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-(--discord-hover)"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-(--discord-active) text-(--discord-accent) shadow-sm">
        <Bot className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-(--discord-text)">
          {prompt.label}
        </span>
        <span className="block truncate text-xs text-(--discord-text-muted)">
          {prompt.subtitle}
        </span>
      </span>
      <span className="rounded-full bg-(--discord-active) px-2 py-1 text-[10px] font-semibold text-(--discord-accent)">
        Prompt
      </span>
    </button>
  );
}

const MessageInput = ({ editingMessage = null, onCancelEdit = null }) => {
  const [text, setText] = useState("");
  const [previews, setPreviews] = useState([]);
  const fileInputRef = useRef(null);
  const {
    sendMessage,
    editMessageText,
    aiMode,
    setAiMode,
    aiChatInConversation,
    isAiBusy,
    users,
  } = useChatStore();
  const [showEmoji, setShowEmoji] = useState(false);
  const [mentionRange, setMentionRange] = useState(null);
  const textInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const socket = useAuthStore((s) => s.socket);
  const selectedConversation = useChatStore((s) => s.selectedConversation);
  const selectedChannel = useChatStore((s) => s.selectedChannel);
  const authUser = useAuthStore((s) => s.authUser);

  const isGroupChat = selectedConversation?.type === "GROUP";

  const mentionSuggestions = useMemo(() => {
    const suggestions = [
      {
        id: "rushcord-ai",
        kind: "bot",
        label: "@RushCord",
        searchLabel: "rushcord",
        subtitle: "Trợ lý AI trong cuộc chat",
      },
    ];
    if (isGroupChat) {
      (users || []).forEach((u) => {
        const memberId = String(u?._id || "");
        if (!memberId || memberId === String(authUser?._id || "")) return;
        const name = String(u.fullName || memberId).trim();
        suggestions.push({
          id: memberId,
          kind: "member",
          label: `@${name}`,
          searchLabel: name.toLowerCase(),
          subtitle: "Thành viên trong nhóm",
        });
      });
    }
    return suggestions;
  }, [authUser?._id, isGroupChat, users]);

  const botPromptMode = useMemo(
    () => isBotPromptMode(text, mentionRange),
    [mentionRange, text],
  );

  const filteredSuggestions = useMemo(() => {
    const q = mentionRange?.query?.trim().toLowerCase() || "";
    return mentionSuggestions.filter((item) => {
      if (!q) return true;
      return (
        item.searchLabel.includes(q) ||
        item.label.toLowerCase().includes(q)
      );
    });
  }, [mentionRange?.query, mentionSuggestions]);

  const syncMentionState = useCallback((value, caret) => {
    setMentionRange(getMentionRange(value, caret));
  }, []);

  const insertMention = useCallback(
    (suggestion) => {
      if (!mentionRange) return;
      const token =
        suggestion.kind === "bot" ? "@RushCord " : `${suggestion.label} `;
      const nextText = `${text.slice(0, mentionRange.start)}${token}${text.slice(mentionRange.end)}`;
      const caret = mentionRange.start + token.length;
      setText(nextText);
      setMentionRange(null);
      setAiMode(suggestion.kind === "bot");
      requestAnimationFrame(() => {
        const el = textInputRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(caret, caret);
      });
    },
    [mentionRange, setAiMode, text],
  );

  const insertBotPrompt = useCallback(
    (promptLabel) => {
      const botTokenMatch = text.match(/(^|[\s(])@RushCord(?:\s*)$/i);
      if (!botTokenMatch) return;
      const prefix = botTokenMatch[1] || "";
      const start = botTokenMatch.index ?? 0;
      const nextText = `${text.slice(0, start)}${prefix}@RushCord ${promptLabel} `;
      const caret = nextText.length;
      setText(nextText);
      setMentionRange(null);
      setAiMode(true);
      requestAnimationFrame(() => {
        const el = textInputRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(caret, caret);
      });
    },
    [setAiMode, text],
  );
  const typingDebounceRef = useRef(null);
  const lastTypingSentAtRef = useRef(0);
  const typingActiveRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const recorderRef = useRef(null);
  const recordStreamRef = useRef(null);
  const recordChunksRef = useRef([]);
  const recordTimerRef = useRef(null);

  const cleanupRecording = () => {
    try {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    } catch {
      // ignore
    }
    recordTimerRef.current = null;
    setRecordMs(0);
    try {
      recordStreamRef.current?.getTracks?.().forEach((t) => t.stop());
    } catch {
      // ignore
    }
    recordStreamRef.current = null;
    recorderRef.current = null;
    recordChunksRef.current = [];
    setIsRecording(false);
  };

  const pickAudioMimeType = () => {
    const mr = window.MediaRecorder;
    if (!mr || typeof mr.isTypeSupported !== "function") return "";
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
    ];
    for (const t of candidates) {
      if (mr.isTypeSupported(t)) return t;
    }
    return "";
  };

  const extFromMime = (mime) => {
    const m = String(mime || "").toLowerCase();
    if (m.includes("ogg")) return "ogg";
    if (m.includes("webm")) return "webm";
    if (m.includes("mpeg") || m === "audio/mp3") return "mp3";
    if (m.includes("mp4")) return "m4a";
    if (m.includes("wav")) return "wav";
    return "audio";
  };

  const emitTyping = (isTyping) => {
    const cid = selectedConversation?.conversationId;
    if (!socket || !cid) return;
    const channelId =
      selectedConversation?.type === "GROUP" &&
      selectedChannel?.channelId &&
      selectedChannel?.channelType !== "VOICE"
        ? selectedChannel.channelId
        : undefined;
    if (isTyping)
      socket.emit("typingInConversation", { conversationId: cid, channelId });
    else socket.emit("stopTypingInConversation", { conversationId: cid, channelId });
  };

  useEffect(() => {
    return () => {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      cleanupRecording();
    };
  }, []);

  useEffect(() => {
    // reset typing state when switching conversations
    typingActiveRef.current = false;
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    cleanupRecording();
  }, [selectedConversation?.conversationId, selectedChannel?.channelId]);

  useEffect(() => {
    if (isRecording) setShowEmoji(false);
  }, [isRecording]);

  useEffect(() => {
    if (!editingMessage) return;
    setText(editingMessage.text || "");
    setFiles([]);
    previews.forEach((p) => {
      if (p?.kind === "image" && p.url) URL.revokeObjectURL(p.url);
    });
    setPreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    cleanupRecording();
  }, [editingMessage?._id]);

  const handleFileChange = async (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    const nextFiles = [];
    const nextPreviews = [];

    const MB = 1024 * 1024;
    // Keep in sync with backend defaults / .env:
    const MAX_IMAGE_MB = 5;
    const MAX_VIDEO_MB = 100;
    const MAX_DOC_MB = 20;

    const allowedMime = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/webm",
      "audio/webm",
      "audio/ogg",
      "audio/mpeg",
      "audio/mp4",
      "audio/wav",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);

    const makeVideoThumb = (file) =>
      new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;
        video.src = url;

        const cleanup = () => {
          URL.revokeObjectURL(url);
          video.removeAttribute("src");
          video.load();
        };

        video.addEventListener(
          "loadeddata",
          () => {
            try {
              const canvas = document.createElement("canvas");
              canvas.width = video.videoWidth || 320;
              canvas.height = video.videoHeight || 180;
              const ctx = canvas.getContext("2d");
              if (!ctx) {
                cleanup();
                resolve(null);
                return;
              }
              // frame đầu tiên
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
              cleanup();
              resolve(dataUrl);
            } catch {
              cleanup();
              resolve(null);
            }
          },
          { once: true },
        );

        video.addEventListener(
          "error",
          () => {
            cleanup();
            resolve(null);
          },
          { once: true },
        );
      });

    for (const f of selected) {
      // Validate file type early (accept= is not a strict guarantee)
      const mime = (f.type || "").toLowerCase();
      const name = (f.name || "").toLowerCase();
      const sizeBytes = f.size || 0;

      const allowedByExt =
        name.endsWith(".jpg") ||
        name.endsWith(".jpeg") ||
        name.endsWith(".png") ||
        name.endsWith(".webp") ||
        name.endsWith(".gif") ||
        name.endsWith(".mp4") ||
        name.endsWith(".webm") ||
        name.endsWith(".mp3") ||
        name.endsWith(".m4a") ||
        name.endsWith(".aac") ||
        name.endsWith(".ogg") ||
        name.endsWith(".wav") ||
        name.endsWith(".pdf") ||
        name.endsWith(".doc") ||
        name.endsWith(".docx");

      const okType = (mime && allowedMime.has(mime)) || (!mime && allowedByExt);
      if (!okType) {
        toast.error(
          "File không đúng định dạng (chỉ hỗ trợ: ảnh, video, audio, pdf, doc/docx)",
        );
        continue;
      }

      const isImage =
        (mime && mime.startsWith("image/")) ||
        name.endsWith(".jpg") ||
        name.endsWith(".jpeg") ||
        name.endsWith(".png") ||
        name.endsWith(".webp") ||
        name.endsWith(".gif");
      const isVideo =
        mime === "video/mp4" ||
        mime === "video/webm" ||
        name.endsWith(".mp4") ||
        name.endsWith(".webm");
      const isAudio =
        (mime && mime.startsWith("audio/")) ||
        name.endsWith(".mp3") ||
        name.endsWith(".m4a") ||
        name.endsWith(".aac") ||
        name.endsWith(".ogg") ||
        name.endsWith(".wav") ||
        name.endsWith(".webm");
      const isDoc =
        mime === "application/pdf" ||
        mime === "application/msword" ||
        mime ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        name.endsWith(".pdf") ||
        name.endsWith(".doc") ||
        name.endsWith(".docx");
      const isPdf = mime === "application/pdf" || name.endsWith(".pdf");
      const isDocLegacy =
        mime === "application/msword" || name.endsWith(".doc");
      const isDocx =
        mime ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        name.endsWith(".docx");

      const maxMb = isImage
        ? MAX_IMAGE_MB
        : isVideo
          ? MAX_VIDEO_MB
          : isAudio
            ? MAX_DOC_MB
            : MAX_DOC_MB;
      const maxBytes = maxMb * MB;
      if (sizeBytes > maxBytes) {
        toast.error(`Dung lượng file vượt giới hạn (tối đa ${maxMb} MB)`);
        continue;
      }

      nextFiles.push(f);
      if (isImage) {
        nextPreviews.push({
          kind: "image",
          url: URL.createObjectURL(f),
          name: f.name,
        });
      } else if (isVideo) {
        const thumb = await makeVideoThumb(f);
        nextPreviews.push({
          kind: "video",
          url: thumb, // dataUrl
          name: f.name,
        });
      } else if (isAudio) {
        nextPreviews.push({ kind: "audio", url: null, name: f.name });
      } else if (isPdf) {
        nextPreviews.push({ kind: "pdf", url: null, name: f.name });
      } else if (isDocLegacy) {
        nextPreviews.push({ kind: "doc", url: null, name: f.name });
      } else if (isDocx) {
        nextPreviews.push({ kind: "docx", url: null, name: f.name });
      } else if (isDoc) {
        nextPreviews.push({ kind: "doc", url: null, name: f.name });
      }
    }

    if (nextFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setFiles(nextFiles);
    setPreviews(nextPreviews);
  };

  const removeFileAt = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => {
      const p = prev[idx];
      if (p?.kind === "image" && p.url) URL.revokeObjectURL(p.url);
      return prev.filter((_, i) => i !== idx);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startRecording = async () => {
    if (editingMessage) return;
    if (isRecording) return;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Trình duyệt không hỗ trợ ghi âm");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      recordChunksRef.current = [];

      const mimeType = pickAudioMimeType();
      const rec = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      recorderRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e?.data && e.data.size > 0) recordChunksRef.current.push(e.data);
      };

      rec.onstop = async () => {
        try {
          const rawType = rec.mimeType || mimeType || "audio/webm";
          const type = String(rawType).split(";")[0].trim() || "audio/webm";
          const blob = new Blob(recordChunksRef.current, { type });
          if (!blob.size) {
            toast.error("Không có dữ liệu ghi âm");
            return;
          }
          const ext = extFromMime(type);
          const file = new File([blob], `voice-${Date.now()}.${ext}`, { type });
          await sendMessage({ text: "", file });
        } catch (err) {
          toast.error(err?.message || "Gửi ghi âm thất bại");
        } finally {
          cleanupRecording();
        }
      };

      rec.start();
      setIsRecording(true);
      setRecordMs(0);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recordTimerRef.current = setInterval(() => {
        setRecordMs((ms) => ms + 250);
      }, 250);
    } catch (err) {
      cleanupRecording();
      toast.error(err?.message || "Không thể bật micro");
    }
  };

  const stopRecording = () => {
    const rec = recorderRef.current;
    if (!rec) return;
    try {
      if (rec.state !== "inactive") rec.stop();
    } catch {
      cleanupRecording();
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (isRecording) return;
    if (!text.trim() && files.length === 0) return;

    try {
      const trimmed = text.trim();
      const isRushCordTrigger = isRushCordMention(trimmed);
      if (typingActiveRef.current) {
        emitTyping(false);
        typingActiveRef.current = false;
      }
      if (editingMessage?._id) {
        await editMessageText(editingMessage._id, trimmed);
        setText("");
        if (typeof onCancelEdit === "function") onCancelEdit();
        return;
      }

      // AI mode: only for plain text (no attachments)
      if (isRushCordTrigger && files.length === 0) {
        const prompt = stripRushCordMention(trimmed);
        await aiChatInConversation(prompt);
        setText("");
        setMentionRange(null);
        setAiMode(false);
        return;
      }

      if (files.length === 0) {
        await sendMessage({ text: trimmed });
      } else {
        const images = files.filter((f) =>
          (f.type || "").toLowerCase().startsWith("image/"),
        );
        const others = files.filter(
          (f) => !(f.type || "").toLowerCase().startsWith("image/"),
        );

        if (images.length === 0) {
          // only non-image files: 1 file = 1 message
          for (let i = 0; i < others.length; i++) {
            await sendMessage({
              text: i === 0 ? trimmed : "",
              file: others[i],
            });
          }
        } else {
          // images: 1 message (1..5 images)
          await sendMessage({
            text: trimmed,
            files: images.length === 1 ? [images[0]] : images,
          });
          // non-image: 1 file = 1 message (text already sent with images)
          for (const f of others) {
            await sendMessage({ text: "", file: f });
          }
        }
      }

      setText("");
      setFiles([]);
      previews.forEach((p) => {
        if (p?.kind === "image" && p.url) URL.revokeObjectURL(p.url);
      });
      setPreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Failed:", error);
    }
  };

  return (
    <div className="mobile-chat-input-wrap sticky bottom-0 w-full bg-(--discord-chat) px-1 py-1">
      {editingMessage && (
        <div className="message-embed mb-3 flex items-center justify-between gap-2 rounded-xl px-3 py-2">
          <div className="truncate text-sm text-(--discord-text)">
            Đang chỉnh sửa:{" "}
            <span className="text-(--discord-text-muted)">
              {editingMessage.text || ""}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-xs rounded-md border-0 bg-(--discord-hover) hover:bg-(--discord-active)"
            onClick={() => {
              setText("");
              if (typeof onCancelEdit === "function") onCancelEdit();
            }}
          >
            Hủy
          </button>
        </div>
      )}
      {previews.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {previews.map((p, idx) => (
            <div key={`${p.kind}-${p.name}-${idx}`} className="relative">
              {p.kind === "image" && (
                <img
                  src={p.url}
                  alt="Preview"
                  className="message-embed h-20 w-20 rounded-xl object-cover"
                />
              )}
              {p.kind === "video" && (
                <div className="message-embed flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl">
                  {p.url ? (
                    <div className="relative w-full h-full">
                      <img
                        src={p.url}
                        alt="Video preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div
                          className="flex h-7 w-7 items-center justify-center rounded-full"
                          style={{ backgroundColor: "var(--message-media-scrim)" }}
                        >
                          <Play className="ml-0.5 w-4 h-4 text-(--discord-accent-contrast)" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Video className="w-6 h-6 text-(--discord-text-muted)" />
                  )}
                </div>
              )}
              {(p.kind === "pdf" || p.kind === "doc" || p.kind === "docx") && (
                <div className="message-embed flex w-20 flex-col items-center justify-center gap-1 rounded-xl p-1">
                  <FileText className="w-6 h-6 text-(--discord-text-muted)" />
                  <span className="text-[10px] text-(--discord-text-muted)">
                    {p.kind.toUpperCase()}
                  </span>
                  <span
                    className="max-w-[72px] truncate text-[10px] text-(--discord-text)"
                    title={p.name}
                  >
                    {p.name}
                  </span>
                </div>
              )}
              {p.kind === "audio" && (
                <div className="message-embed flex w-20 flex-col items-center justify-center gap-1 rounded-xl p-1">
                  <Mic className="w-6 h-6 text-(--discord-text-muted)" />
                  <span className="text-[10px] text-(--discord-text-muted)">
                    AUDIO
                  </span>
                  <span
                    className="max-w-[72px] truncate text-[10px] text-base-content/80"
                    title={p.name}
                  >
                    {p.name}
                  </span>
                </div>
              )}
              <button
                onClick={() => removeFileAt(idx)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-(--discord-danger) text-(--discord-accent-contrast)"
                type="button"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={handleSendMessage}
        className="relative flex items-center gap-2 rounded-lg bg-(--discord-panel-strong) px-1 py-1"
      >
        {(botPromptMode ||
          (mentionRange && filteredSuggestions.length > 0)) && (
          <div className="absolute bottom-full left-1 z-30 mb-2 w-[min(420px,calc(100vw-2rem))] rounded-[1.25rem] border border-(--discord-border) bg-(--discord-panel-strong) p-2 shadow-[0_20px_60px_rgba(15,23,42,0.14)] backdrop-blur-xl">
            <div className="flex items-center justify-between px-2 py-1.5">
              <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-(--discord-accent)">
                <AtSign className="size-3.5" />
                {botPromptMode ? "Gợi ý bot" : "Gợi ý @"}
              </div>
              <span className="text-[11px] text-(--discord-text-faint)">
                {botPromptMode ? "Chọn để điền prompt" : "Click để chèn"}
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {botPromptMode
                ? BOT_PROMPT_SUGGESTIONS.map((prompt) => (
                    <BotPromptRow
                      key={prompt.id}
                      prompt={prompt}
                      onSelect={() => insertBotPrompt(prompt.label)}
                    />
                  ))
                : filteredSuggestions.map((suggestion) => (
                    <MentionOptionRow
                      key={suggestion.id}
                      suggestion={suggestion}
                      onSelect={insertMention}
                    />
                  ))}
            </div>
          </div>
        )}
        <div className="flex flex-1 items-center gap-2">
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md text-(--discord-text-muted) hover:bg-(--discord-hover) hover:text-(--discord-text) disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => fileInputRef.current?.click()}
            disabled={!!editingMessage || isRecording}
            title="Attach files"
          >
            <Plus size={18} />
          </button>
          <input
            ref={textInputRef}
            type="text"
            className="discord-input-reset h-10 w-full text-sm text-(--discord-text) disabled:cursor-not-allowed disabled:opacity-50 sm:text-[15px]"
            placeholder={
              isRecording
                ? "Đang ghi âm..."
                : editingMessage
                  ? "Edit message..."
                  : aiMode
                    ? "Chat với RushCord AI... (@RushCord <câu hỏi>)"
                    : `Nhắn #${selectedConversation?.title || "channel"}`
            }
            disabled={isRecording || isAiBusy}
            value={text}
            onChange={(e) => {
              const next = e.target.value;
              const caret = e.target.selectionStart ?? next.length;
              setText(next);
              syncMentionState(next, caret);

              const trimmed = next.trim();
              const hasText = trimmed.length > 0;
              const isRushCord = isRushCordMention(trimmed);
              setAiMode(isRushCord);

              // Debounce + throttle to avoid spamming socket on each keystroke.
              if (typingDebounceRef.current)
                clearTimeout(typingDebounceRef.current);

              if (editingMessage) return;
              if (isRushCord) return;
              if (!hasText) {
                if (typingActiveRef.current) {
                  emitTyping(false);
                  typingActiveRef.current = false;
                }
                return;
              }

              typingDebounceRef.current = setTimeout(() => {
                const now = Date.now();
                if (now - lastTypingSentAtRef.current < 450) return;
                lastTypingSentAtRef.current = now;
                emitTyping(true);
                typingActiveRef.current = true;
              }, 250);
            }}
            onClick={(e) =>
              syncMentionState(
                e.currentTarget.value,
                e.currentTarget.selectionStart ?? e.currentTarget.value.length,
              )
            }
            onKeyUp={(e) =>
              syncMentionState(
                e.currentTarget.value,
                e.currentTarget.selectionStart ?? e.currentTarget.value.length,
              )
            }
          />
          <input
            type="file"
            accept="image/*,video/mp4,video/webm,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isRecording && (
            <div
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium tabular-nums text-(--discord-danger)"
              aria-live="polite"
            >
              <span className="size-2 shrink-0 animate-pulse rounded-full bg-(--discord-danger)" />
              {formatRecordMs(recordMs)}
            </div>
          )}
          {!isRecording ? (
            <button
              type="button"
              className="flex size-8 touch-none items-center justify-center rounded-md text-(--discord-text-muted) hover:bg-(--discord-hover) hover:text-(--discord-text) disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!!editingMessage || isAiBusy}
              title="Giữ để ghi âm"
              aria-label="Giữ để ghi âm"
              onPointerDown={(e) => {
                e.preventDefault();
                startRecording();
              }}
            >
              <Mic size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-md bg-(--discord-danger)/15 text-(--discord-danger) hover:bg-(--discord-danger)/25"
              title="Dừng ghi âm"
              aria-label="Dừng ghi âm"
              onClick={stopRecording}
            >
              <Square size={14} fill="currentColor" />
            </button>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md text-(--discord-text-muted) hover:bg-(--discord-hover) hover:text-(--discord-text) disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setShowEmoji((prev) => !prev)}
            disabled={isRecording}
            title="Emoji"
          >
            <Smile size={16} />
          </button>

          {showEmoji && !isRecording && (
            <div className="absolute bottom-12 right-0 z-50">
              <EmojiPicker
                onEmojiClick={(emojiData) => {
                  setText((prev) => prev + emojiData.emoji);
                  setShowEmoji(false);
                }}
              />
            </div>
          )}
        </div>
        <button
          type="submit"
          className="flex size-8 items-center justify-center rounded-md bg-(--discord-accent) text-(--discord-accent-contrast) disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isAiBusy || isRecording || (!text.trim() && files.length === 0)}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};
export default MessageInput;

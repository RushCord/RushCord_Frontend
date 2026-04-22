import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Send, X, Smile, FileText, Video, Play, Mic, Square } from "lucide-react";
import toast from "react-hot-toast";
import EmojiPicker from "emoji-picker-react";
import { useAuthStore } from "../store/useAuthStore";

const MessageInput = ({ editingMessage = null, onCancelEdit = null }) => {
  const [text, setText] = useState("");
  const [previews, setPreviews] = useState([]);
  const fileInputRef = useRef(null);
  const { sendMessage, editMessageText } = useChatStore();
  const [showEmoji, setShowEmoji] = useState(false);
  const [files, setFiles] = useState([]);
  const socket = useAuthStore((s) => s.socket);
  const selectedConversation = useChatStore((s) => s.selectedConversation);
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
    if (isTyping) socket.emit("typingInConversation", { conversationId: cid });
    else socket.emit("stopTypingInConversation", { conversationId: cid });
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
  }, [selectedConversation?.conversationId]);

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
          { once: true }
        );

        video.addEventListener(
          "error",
          () => {
            cleanup();
            resolve(null);
          },
          { once: true }
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
          "File không đúng định dạng (chỉ hỗ trợ: ảnh, video, audio, pdf, doc/docx)"
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
      const isDocLegacy = mime === "application/msword" || name.endsWith(".doc");
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
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
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
      if (files.length === 0) {
        await sendMessage({ text: trimmed });
      } else {
      const images = files.filter((f) =>
        (f.type || "").toLowerCase().startsWith("image/")
      );
      const others = files.filter(
        (f) => !(f.type || "").toLowerCase().startsWith("image/")
      );

      if (images.length === 0) {
        // only non-image files: 1 file = 1 message
        for (let i = 0; i < others.length; i++) {
          await sendMessage({ text: i === 0 ? trimmed : "", file: others[i] });
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
    <div className="p-4 w-full">
      {editingMessage && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2">
          <div className="text-sm text-zinc-200 truncate">
            Đang chỉnh sửa:{" "}
            <span className="text-zinc-400">{editingMessage.text || ""}</span>
          </div>
          <button
            type="button"
            className="btn btn-xs"
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
                  className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
                />
              )}
              {p.kind === "video" && (
                <div className="w-20 h-20 rounded-lg border border-zinc-700 bg-zinc-900 flex items-center justify-center overflow-hidden">
                  {p.url ? (
                    <div className="relative w-full h-full">
                      <img
                        src={p.url}
                        alt="Video preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center">
                          <Play className="w-4 h-4 text-white ml-0.5" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Video className="w-6 h-6 text-zinc-400" />
                  )}
                </div>
              )}
              {(p.kind === "pdf" || p.kind === "doc" || p.kind === "docx") && (
                <div className="w-20 rounded-lg border border-zinc-700 bg-zinc-900 flex flex-col items-center justify-center gap-1 p-1">
                  <FileText className="w-6 h-6 text-zinc-400" />
                  <span className="text-[10px] text-zinc-400">
                    {p.kind.toUpperCase()}
                  </span>
                  <span
                    className="text-[10px] text-zinc-300 max-w-[72px] truncate"
                    title={p.name}
                  >
                    {p.name}
                  </span>
                </div>
              )}
              {p.kind === "audio" && (
                <div className="w-20 rounded-lg border border-zinc-700 bg-zinc-900 flex flex-col items-center justify-center gap-1 p-1">
                  <Mic className="w-6 h-6 text-zinc-400" />
                  <span className="text-[10px] text-zinc-400">AUDIO</span>
                  <span
                    className="text-[10px] text-zinc-300 max-w-[72px] truncate"
                    title={p.name}
                  >
                    {p.name}
                  </span>
                </div>
              )}
              <button
                onClick={() => removeFileAt(idx)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300 flex items-center justify-center"
                type="button"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            className="w-full input input-bordered rounded-lg input-sm sm:input-md"
            placeholder={editingMessage ? "Edit message..." : "Type a message..."}
            value={text}
            onChange={(e) => {
              const next = e.target.value;
              setText(next);

              const trimmed = next.trim();
              const hasText = trimmed.length > 0;

              // Debounce + throttle to avoid spamming socket on each keystroke.
              if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);

              if (editingMessage) return;
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
          />
          <input
            type="file"
            accept="image/*,video/mp4,video/webm,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />

          <button
            type="button"
            className={`hidden sm:flex btn btn-circle
                     ${previews.length > 0 ? "text-emerald-500" : "text-zinc-400"}`}
            onClick={() => fileInputRef.current?.click()}
            disabled={!!editingMessage}
          >
            <Image size={20} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`hidden sm:flex btn btn-circle ${
              isRecording ? "text-red-400" : "text-zinc-400"
            }`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={!!editingMessage}
            title={isRecording ? "Dừng ghi âm & gửi" : "Ghi âm"}
          >
            {isRecording ? <Square size={20} /> : <Mic size={20} />}
          </button>
          {isRecording && (
            <span className="hidden sm:inline text-xs text-red-300 tabular-nums">
              REC {Math.floor(recordMs / 1000)}s
            </span>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            className="hidden sm:flex btn btn-circle text-zinc-400"
            onClick={() => setShowEmoji((prev) => !prev)}
          >
            <Smile size={20} />
          </button>

          {showEmoji && (
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
          className="btn btn-sm btn-circle"
          disabled={isRecording || (!text.trim() && files.length === 0)}
        >
          <Send size={22} />
        </button>
      </form>
    </div>
  );
};
export default MessageInput;

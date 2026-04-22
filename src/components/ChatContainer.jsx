import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import VideoCall from "../components/VideoCall";
import GroupVideoCall from "../components/GroupVideoCall";
import { getFileIcon } from "../lib/utils";
import {
  Smile,
  MoreHorizontal,
  Play,
  Pause,
  Mic,
} from "lucide-react";
import EmojiPicker from "emoji-picker-react";

const formatSeconds = (sec) => {
  const s = Number.isFinite(sec) ? Math.max(0, Math.floor(sec)) : 0;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
};

const AudioMessage = ({ url, fileName }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  const safeName = fileName || "Voice message";

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onLoaded = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    const onTime = () => setCurrent(Number.isFinite(el.currentTime) ? el.currentTime : 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);

    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, [url]);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    try {
      if (el.paused) await el.play();
      else el.pause();
    } catch {
      // ignore autoplay/gesture restrictions; controls still work
    }
  };

  const pct = duration > 0 ? Math.min(1, Math.max(0, current / duration)) : 0;

  return (
    <div className="w-[280px] max-w-full rounded-xl border border-zinc-700 bg-zinc-900/60 px-3 py-2">
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 flex items-center justify-center hover:bg-emerald-500/20 transition"
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
          title={isPlaying ? "Tạm dừng" : "Phát"}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-zinc-400 shrink-0" />
            <div className="truncate text-sm text-zinc-100" title={safeName}>
              {safeName}
            </div>
            <div className="ml-auto text-xs text-zinc-400 tabular-nums shrink-0">
              {formatSeconds(current)} / {formatSeconds(duration)}
            </div>
          </div>

          <div className="mt-2 h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500/70"
              style={{ width: `${pct * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatContainer = () => {
  const {
    messages,
    users,
    conversations,
    getMessages,
    isMessagesLoading,
    selectedConversation,
    setSelectedConversation,
    isTyping,
    typingFromUserId,
    subscribeToMessages,
    unsubscribeFromMessages,
    recallMessage,
    recallMessageMe,
    forwardMessage,
    reactToMessage,
  } = useChatStore();

  const { authUser, incomingCall, clearIncomingCall, socket } = useAuthStore();
  const messageEndRef = useRef(null);
  const [isCalling, setIsCalling] = useState(false);
  // The actual peer we are calling / answering. Avoids races with selectedUser updates.
  const [callPeerId, setCallPeerId] = useState(null);
  const [callRoomName, setCallRoomName] = useState(null);
  const [endSignal, setEndSignal] = useState(0);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messageMenuId, setMessageMenuId] = useState(null);
  const [recallPromptMessage, setRecallPromptMessage] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [historyMessage, setHistoryMessage] = useState(null);
  const [reactingForMessageId, setReactingForMessageId] = useState(null);
  const getFileName = (url) => {
    try {
      return url.split("/").pop().split("?")[0];
    } catch {
      return "file";
    }
  };
  const handleForward = (message) => {
    setSelectedMessage(message);
    setShowForwardModal(true);
  };

  const handleSelectUser = (userId) => {
    if (!selectedMessage) return;

    forwardMessage(selectedMessage._id, userId);

    setShowForwardModal(false);
    setSelectedMessage(null);
  };

  useEffect(() => {
    if (!messageMenuId) return;
    const close = (e) => {
      if (e.target?.closest?.("[data-message-menu]")) return;
      setMessageMenuId(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [messageMenuId]);

  useEffect(() => {
    if (!reactingForMessageId) return;
    const close = (e) => {
      if (e.target?.closest?.("[data-react-picker]")) return;
      setReactingForMessageId(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [reactingForMessageId]);

  const renderReactions = (message) => {
    const counts = message?.reactionCounts;
    if (!counts || typeof counts !== "object") return null;
    const entries = Object.entries(counts)
      .filter(([k, v]) => k && Number(v) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 6);
    if (entries.length === 0) return null;
    return (
      <div
        className={[
          // Reactions should NOT control bubble width.
          // Render inside `chat-footer` so daisyUI aligns start/end correctly.
          "mt-1 max-w-[75%] w-fit",
          // one row only; scroll horizontally if too many
          "flex flex-end items-center gap-1",
        ].join(" ")}
      >
        {entries.map(([emoji, count]) => (
          <button
            key={emoji}
            type="button"
            className="shrink-0 inline-flex items-center whitespace-nowrap max-w-full px-2 py-1 rounded-full bg-base-200 border border-base-300 text-xs hover:bg-base-300"
            onClick={() => reactToMessage(message._id, emoji)}
            title="Bấm để thả/bỏ react"
          >
            <span className="mr-1">{emoji}</span>
            <span className="opacity-70">{count}</span>
          </button>
        ))}
      </div>
    );
  };

  // =========================
  // LOAD MESSAGES
  // =========================
  useEffect(() => {
    if (!selectedConversation?.conversationId) return;

    getMessages(selectedConversation.conversationId);
    subscribeToMessages();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditingMessage(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistoryMessage(null);

    return () => {
      unsubscribeFromMessages();
    };
  }, [selectedConversation?.conversationId]);

  // =========================
  // RESET CALL WHEN CHANGE USER
  // =========================
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsCalling(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCallPeerId(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCallRoomName(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEndSignal(0);
  }, [selectedConversation?.conversationId]);

  // =========================
  // AUTO SCROLL
  // =========================
  useEffect(() => {
    const timeout = setTimeout(() => {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    return () => clearTimeout(timeout);
  }, [messages]);

  // =========================
  // LOADING
  // =========================
  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader
          onCall={() => {
            if (!selectedConversation) return;
            if (selectedConversation.type === "GROUP") {
              const roomName = String(selectedConversation.conversationId || "").trim();
              if (!roomName) return;
              setCallPeerId(null);
              setCallRoomName(roomName);
              setIsCalling(true);
              if (socket) socket.emit("callInviteGroup", { conversationId: roomName });
              return;
            }

            if (selectedConversation.type !== "DM") return;
            const otherUserId = selectedConversation.otherUserId;
            if (!otherUserId) return;
            const roomName = (() => {
              const a = String(authUser?._id || "");
              const b = String(otherUserId || "");
              const [x, y] = [a, b].sort();
              return `DM#${x}#${y}`;
            })();
            setCallPeerId(otherUserId);
            setCallRoomName(roomName);
            setIsCalling(true);
            if (socket) socket.emit("callInvite", { to: otherUserId, roomName });
          }}
          callDisabled={!selectedConversation}
        />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto relative">
      <ChatHeader
        onCall={() => {
          if (!selectedConversation) return;
          if (selectedConversation.type === "GROUP") {
            const roomName = String(selectedConversation.conversationId || "").trim();
            if (!roomName) return;
            setCallPeerId(null);
            setCallRoomName(roomName);
            setIsCalling(true);
            if (socket) socket.emit("callInviteGroup", { conversationId: roomName });
            return;
          }

          if (selectedConversation.type !== "DM") return;
          const otherUserId = selectedConversation.otherUserId;
          if (!otherUserId) return;
          const roomName = (() => {
            const a = String(authUser?._id || "");
            const b = String(otherUserId || "");
            const [x, y] = [a, b].sort();
            return `DM#${x}#${y}`;
          })();
          setCallPeerId(otherUserId);
          setCallRoomName(roomName);
          setIsCalling(true);
          if (socket) socket.emit("callInvite", { to: otherUserId, roomName });
        }}
        callDisabled={!selectedConversation}
      />

      {/* VIDEO CALL */}
      {isCalling && selectedConversation && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-gray-900 rounded-xl shadow-2xl border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
              <h1 className="text-white text-base sm:text-lg font-semibold truncate">
                {selectedConversation?.type === "GROUP" ? (
                  <>
                    Group call:{" "}
                    <span className="text-blue-400">
                      {selectedConversation?.title || selectedConversation?.conversationId}
                    </span>
                  </>
                ) : (
                  <>
                    Video Call with{" "}
                    <span className="text-blue-400">{selectedConversation?.otherUserId}</span>
                  </>
                )}
              </h1>
              <button
                type="button"
                onClick={() => setEndSignal((n) => n + 1)}
                className="text-gray-300 hover:text-white text-xl leading-none px-2"
                aria-label="Close call"
                title="Đóng"
              >
                ✕
              </button>
            </div>

            <div className="p-3 sm:p-4">
              <div className="w-full">
                {selectedConversation?.type === "GROUP" ? (
                  <GroupVideoCall
                    roomName={callRoomName}
                    autoStart={true}
                    forceEndSignal={endSignal}
                    getDisplayName={(identity) => {
                      const id = String(identity || "");
                      const u = users.find((x) => String(x._id) === id);
                      return u?.fullName || id;
                    }}
                    onEnd={() => {
                      setIsCalling(false);
                      setCallRoomName(null);
                      setCallPeerId(null);
                      setEndSignal(0);
                    }}
                  />
                ) : (
                  <VideoCall
                    myId={authUser._id}
                    remoteId={callPeerId || selectedConversation.otherUserId}
                    roomName={callRoomName}
                    autoStart={true}
                    forceEndSignal={endSignal}
                    onEnd={() => {
                      setIsCalling(false);
                      setCallRoomName(null);
                      setCallPeerId(null);
                      setEndSignal(0);
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INCOMING CALL */}
      {incomingCall && (
        <div className="fixed top-4 right-4 z-60 bg-white/5 backdrop-blur p-3 rounded-lg border">
          <div className="flex items-center gap-3">
            <div className="flex-1 text-white">
              {(() => {
                const kind = String(incomingCall?.kind || "").toUpperCase();
                const isGroup = kind === "GROUP";
                if (isGroup) {
                  const cid = String(incomingCall?.conversationId || incomingCall?.roomName || "");
                  const conv = conversations.find((c) => String(c.conversationId) === cid);
                  const name = conv?.title || cid || "Group";
                  return (
                    <>
                      📞 Incoming group call:{" "}
                      <span className="text-blue-300">{name}</span>
                    </>
                  );
                }
                const fromName =
                  users.find((u) => String(u._id) === String(incomingCall.from))?.fullName ||
                  incomingCall.from;
                return (
                  <>
                    📞 Incoming call from{" "}
                    <span className="text-blue-300">{fromName}</span>
                  </>
                );
              })()}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  const kind = String(incomingCall?.kind || "").toUpperCase();
                  const isGroup = kind === "GROUP";

                  if (isGroup) {
                    const cid = String(incomingCall?.conversationId || incomingCall?.roomName || "").trim();
                    if (!cid) return;
                    const conv =
                      conversations.find((c) => String(c.conversationId) === cid) || null;

                    setCallPeerId(null);
                    setCallRoomName(cid);
                    setSelectedConversation(
                      conv || { conversationId: cid, type: "GROUP", title: "", avatar: "" },
                    );
                    clearIncomingCall();
                    setIsCalling(true);
                    return;
                  }

                  const caller =
                    users.find((u) => String(u._id) === String(incomingCall.from)) || {
                      _id: incomingCall.from,
                      fullName: incomingCall.from,
                    };

                  // Ensure VideoCall mounts with the correct peer id even if selectedUser updates later.
                  setCallPeerId(incomingCall.from);
                  setCallRoomName(incomingCall.roomName || null);
                  setSelectedConversation({
                    conversationId:
                      incomingCall.roomName ||
                      `DM#${[String(authUser?._id || ""), String(incomingCall.from || "")]
                        .sort()
                        .join("#")}`,
                    type: "DM",
                    otherUserId: caller._id,
                  });
                  clearIncomingCall();
                  setIsCalling(true);
                  if (socket)
                    socket.emit("callAccept", {
                      to: incomingCall.from,
                      roomName: incomingCall.roomName,
                    });
                }}
                className="bg-green-600 text-white px-3 py-1 rounded"
              >
                Accept
              </button>

              <button
                onClick={() => {
                  const kind = String(incomingCall?.kind || "").toUpperCase();
                  const isGroup = kind === "GROUP";
                  if (!isGroup && socket)
                    socket.emit("callReject", {
                      to: incomingCall.from,
                      roomName: incomingCall.roomName,
                    });
                  clearIncomingCall();
                }}
                className="bg-red-600 text-white px-3 py-1 rounded"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {selectedConversation?.type === "DM" && messages.length === 0 && (
          <div className="flex justify-center pt-6">
            <div className="max-w-[95%] sm:max-w-[520px] text-center rounded-xl border border-base-300 bg-base-200 px-4 py-3 text-sm text-base-content/80">
              {(() => {
                const otherId = selectedConversation?.otherUserId;
                const otherName =
                  users.find((u) => String(u._id) === String(otherId))?.fullName ||
                  "người ấy";
                return (
                  <>
                    Bạn và <span className="font-medium">{otherName}</span> đã trở thành bạn bè.
                    {" "}
                    Hãy gửi lời chào để bắt đầu cuộc trò chuyện nhé!
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          message?.isSystem ? (
            <div
              key={message._id}
              ref={index === messages.length - 1 ? messageEndRef : null}
              className="flex justify-center"
            >
              <div className="px-3 py-1 rounded-full bg-base-200 border border-base-300 text-xs text-base-content/70 max-w-[90%] text-center">
                {message.text || ""}
              </div>
            </div>
          ) : (
          <div
            key={message._id}
            className={`chat group ${
              message.senderId === authUser._id ? "chat-end" : "chat-start"
            }`}
            ref={index === messages.length - 1 ? messageEndRef : null}
          >
            {/* AVATAR */}
            <div className="chat-image avatar">
              <div className="size-10 rounded-full border">
                <img
                  src={
                    message.senderId === authUser._id
                      ? authUser.profilePic || "/avatar.png"
                      : (() => {
                          const sender = users.find(
                            (u) => String(u._id) === String(message.senderId),
                          );
                          return sender?.profilePic || "/avatar.png";
                        })()
                  }
                  alt="profile"
                />
              </div>
            </div>

            {/* HEADER: name (group) + time */}
            <div className="chat-header mb-1">
              {selectedConversation?.type === "GROUP" &&
                message.senderId !== authUser._id && (
                  <span className="text-xs font-medium mr-2">
                    {(() => {
                      const sender = users.find(
                        (u) => String(u._id) === String(message.senderId),
                      );
                      return sender?.fullName || message.senderId;
                    })()}
                  </span>
                )}
              <time className="text-xs opacity-50 ml-1">
                {formatMessageTime(message.createdAt)}
              </time>
            </div>

            {/* MESSAGE */}
            <div className="chat-bubble flex flex-col gap-2 relative max-w-[75%] break-words">
              {!message.isRecalled &&
                !message.isDeletedForMe &&
                message.isEdited &&
                Array.isArray(message.editHistory) && (
                  <button
                    type="button"
                    className="self-start text-[11px] opacity-70 hover:opacity-100 underline underline-offset-2 mb-1"
                    onClick={() => setHistoryMessage(message)}
                    title="Xem lịch sử chỉnh sửa"
                  >
                    Đã chỉnh sửa
                  </button>
                )}
              {message.isRecalled ? (
                <p className="italic text-gray-400">
                  {message.senderId === authUser._id
                    ? "Bạn đã thu hồi tin nhắn với mọi người."
                    : "Tin nhắn đã bị thu hồi"}
                </p>
              ) : message.isDeletedForMe ? (
                <p className="italic text-gray-400">
                  Bạn đã thu hồi tin nhắn với bản thân.
                </p>
              ) : (
                <>
                  {/* 🖼️ IMAGE */}
                  {message.image && (
                    <img
                      src={message.image}
                      alt="attachment"
                      className="max-w-[200px] rounded-lg cursor-pointer hover:opacity-90"
                      onClick={() => window.open(message.image, "_blank")}
                    />
                  )}

                  {/* 🖼️ IMAGES (gallery) */}
                  {Array.isArray(message.images) && message.images.length > 0 && (
                    <div
                      className={`grid gap-2 ${
                        message.images.length === 1
                          ? "grid-cols-1"
                          : message.images.length === 2
                            ? "grid-cols-2"
                            : "grid-cols-3"
                      }`}
                    >
                      {message.images.slice(0, 5).map((url) => (
                        <img
                          key={url}
                          src={url}
                          alt="attachment"
                          className="w-[200px] max-w-full rounded-lg cursor-pointer hover:opacity-90 object-cover"
                          onClick={() => window.open(url, "_blank")}
                        />
                      ))}
                    </div>
                  )}

                  {/* 📄 FILE / 🎞️ VIDEO / 🖼️ IMAGE (fallback) */}
                  {message.file ? (
                    typeof message.contentType === "string" &&
                    message.contentType.startsWith("image/") ? (
                      <img
                        src={message.file}
                        alt="attachment"
                        className="max-w-[200px] rounded-lg cursor-pointer hover:opacity-90"
                        onClick={() => window.open(message.file, "_blank")}
                      />
                    ) : typeof message.contentType === "string" &&
                      message.contentType.startsWith("video/") ? (
                      <div className="max-w-[320px]">
                        <video
                          src={message.file}
                          controls
                          playsInline
                          className="w-full rounded-lg border border-zinc-700 bg-black"
                        />
                      </div>
                    ) : typeof message.contentType === "string" &&
                      message.contentType.startsWith("audio/") ? (
                      <AudioMessage
                        url={message.file}
                        fileName={message.fileName || getFileName(message.file)}
                      />
                    ) : (
                      <a
                        href={message.file}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-lg transition max-w-[260px]"
                      >
                      {/* PREVIEW */}
                      <div className="w-12 h-12 rounded-lg border border-zinc-700 bg-zinc-900 flex flex-col items-center justify-center gap-0.5 shrink-0">
                        <span className="text-xl">
                          {getFileIcon(message.file)}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {(() => {
                            const name = (message.fileName || getFileName(message.file) || "").toLowerCase();
                            if (name.endsWith(".pdf")) return "PDF";
                            if (name.endsWith(".docx")) return "DOCX";
                            if (name.endsWith(".doc")) return "DOC";
                            return "FILE";
                          })()}
                        </span>
                      </div>

                      {/* NAME */}
                      <div className="min-w-0">
                        <div
                          className="truncate max-w-[180px] text-sm text-zinc-100"
                          title={message.fileName || getFileName(message.file)}
                        >
                          {message.fileName || getFileName(message.file)}
                        </div>
                        <div className="text-xs text-zinc-400">Nhấn để mở</div>
                      </div>
                      </a>
                    )
                  ) : null}

                  {/* TEXT */}
                  {message.text && (
                    <p>
                      {message.text}
                    </p>
                  )}

                </>
              )}

              {/* HOVER: react + menu */}
              {!message.isRecalled && !message.isDeletedForMe && (
                <div
                  className={[
                    "absolute top-1/2 -translate-y-1/2",
                    message.senderId === authUser._id ? "-left-15" : "-right-15",
                    "flex flex-row items-center gap-1",
                    "opacity-0 pointer-events-none",
                    "group-hover:opacity-100 group-hover:pointer-events-auto",
                    "transition-opacity",
                  ].join(" ")}
                >
                  <div className="relative" data-react-picker>
                    <button
                      type="button"
                      title="React"
                      className="btn btn-xs btn-circle bg-base-200 hover:bg-base-300 border border-base-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReactingForMessageId((id) =>
                          id === message._id ? null : message._id,
                        );
                      }}
                    >
                      <Smile className="w-4 h-4" />
                    </button>

                    {reactingForMessageId === message._id && (
                      <div className="absolute z-[70] bottom-full mb-2 right-0">
                        <EmojiPicker
                          onEmojiClick={async (emojiData) => {
                            setReactingForMessageId(null);
                            await reactToMessage(message._id, emojiData.emoji);
                          }}
                          lazyLoadEmojis
                        />
                      </div>
                    )}
                  </div>

                  <div className="relative" data-message-menu>
                    <button
                      type="button"
                      title="Thêm"
                      className="btn btn-xs btn-circle bg-base-200 hover:bg-base-300 border border-base-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMessageMenuId((id) =>
                          id === message._id ? null : message._id,
                        );
                      }}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {messageMenuId === message._id && (
                      <ul
                        className="absolute z-[60] bottom-full mb-1 min-w-[11rem] rounded-lg border border-base-300 bg-base-200 py-1 shadow-lg"
                        data-message-menu
                        style={
                          message.senderId === authUser._id
                            ? { right: 0 }
                            : { left: 0 }
                        }
                      >
                        <li>
                          <button
                            type="button"
                            disabled={
                              message.senderId !== authUser._id ||
                              message.isDeletedForMe ||
                              message.isRecalled ||
                              !message.text
                            }
                            className="w-full px-3 py-2 text-left text-sm hover:bg-base-300 disabled:opacity-40 disabled:cursor-not-allowed"
                            onClick={() => {
                              if (message.senderId !== authUser._id) return;
                              if (message.isDeletedForMe || message.isRecalled) return;
                              if (!message.text) return;
                              setEditingMessage(message);
                              setMessageMenuId(null);
                            }}
                          >
                            Chỉnh sửa
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            disabled={message.senderId !== authUser._id}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-base-300 disabled:opacity-40 disabled:cursor-not-allowed"
                            onClick={() => {
                              if (message.senderId !== authUser._id) return;
                              setRecallPromptMessage(message);
                              setMessageMenuId(null);
                            }}
                          >
                            Thu hồi
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-base-300"
                            onClick={() => {
                              handleForward(message);
                              setMessageMenuId(null);
                            }}
                          >
                            Chuyển tiếp
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            disabled
                            className="w-full px-3 py-2 text-left text-sm opacity-50 cursor-not-allowed"
                          >
                            Trả lời
                          </button>
                        </li>
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 😀 REACTIONS (footer so chat-start/end aligns correctly) */}
            {!message.isRecalled && !message.isDeletedForMe && (
              <div className="chat-footer">{renderReactions(message)}</div>
            )}
          </div>
          )
        ))}
      </div>
      {selectedConversation && isTyping && (
        <div className="px-4 pb-1 text-sm text-base-content/60">
          {(() => {
            const fromId = typingFromUserId;
            if (!fromId) return "Đang gõ...";
            const u = users.find((x) => String(x._id) === String(fromId));
            const name = u?.fullName || fromId;
            // For DM it can still be useful; for GROUP it's required.
            return `${name} đang gõ...`;
          })()}
        </div>
      )}
      {recallPromptMessage && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[55] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRecallPromptMessage(null);
          }}
          role="presentation"
        >
          <div
            className="bg-zinc-900 rounded-xl w-full max-w-md border border-zinc-700 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="recall-dialog-title"
          >
            <div className="flex justify-between items-start gap-3 p-4 border-b border-zinc-800">
              <h2
                id="recall-dialog-title"
                className="text-white font-semibold text-lg pr-2"
              >
                Thu hồi tin nhắn
              </h2>
              <button
                type="button"
                onClick={() => setRecallPromptMessage(null)}
                className="text-zinc-400 hover:text-white shrink-0 text-xl leading-none"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <button
                type="button"
                className="w-full text-left rounded-lg border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-800 p-4 transition-colors"
                onClick={async () => {
                  const id = recallPromptMessage._id;
                  setRecallPromptMessage(null);
                  await recallMessage(id);
                }}
              >
                <div className="text-white font-medium mb-1">
                  Thu hồi với mọi người
                </div>
                <p className="text-sm text-zinc-400 leading-snug">
                  Tin nhắn này sẽ bị thu hồi với mọi người trong đoạn chat.
                </p>
              </button>
              <button
                type="button"
                disabled={recallPromptMessage.isDeletedForMe}
                className="w-full text-left rounded-lg border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-800 p-4 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-zinc-800/60"
                onClick={async () => {
                  if (recallPromptMessage.isDeletedForMe) return;
                  const id = recallPromptMessage._id;
                  setRecallPromptMessage(null);
                  await recallMessageMe(id);
                }}
              >
                <div className="text-white font-medium mb-1">
                  Thu hồi với bạn
                </div>
                <p className="text-sm text-zinc-400 leading-snug">
                  Chúng tôi sẽ gỡ tin nhắn này ở phía bạn. Những người khác
                  trong đoạn chat vẫn có thể xem được.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {showForwardModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-lg w-[300px] max-h-[400px] overflow-y-auto p-4">
            {/* HEADER */}
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-white font-semibold">Chọn người nhận</h2>
              <button
                onClick={() => setShowForwardModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* USER LIST */}
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user._id}
                  onClick={() => handleSelectUser(user._id)}
                  className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-zinc-800"
                >
                  <img
                    src={user.profilePic || "/avatar.png"}
                    className="w-8 h-8 rounded-full"
                  />
                  <span className="text-white">{user.fullName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {historyMessage && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setHistoryMessage(null);
          }}
          role="presentation"
        >
          <div
            className="bg-zinc-900 rounded-xl w-full max-w-2xl border border-zinc-700 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-dialog-title"
          >
            <div className="flex justify-between items-start gap-3 p-4 border-b border-zinc-800">
              <h2
                id="history-dialog-title"
                className="text-white font-semibold text-lg pr-2"
              >
                Lịch sử chỉnh sửa
              </h2>
              <button
                type="button"
                onClick={() => setHistoryMessage(null)}
                className="text-zinc-400 hover:text-white shrink-0 text-xl leading-none"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="text-xs text-zinc-400 mb-1">Nội dung hiện tại</div>
                <div className="text-zinc-100 whitespace-pre-wrap break-words">
                  {historyMessage.text || ""}
                </div>
              </div>

              {Array.isArray(historyMessage.editHistory) &&
              historyMessage.editHistory.length > 0 ? (
                <div className="space-y-2">
                  {historyMessage.editHistory
                    .slice()
                    .reverse()
                    .map((h, idx) => {
                      const when = h?.editedAt
                        ? formatMessageTime(h.editedAt)
                        : `#${idx + 1}`;
                      const prev = typeof h?.prevText === "string" ? h.prevText : "";
                      const next =
                        typeof h?.nextText === "string" ? h.nextText : null;
                      return (
                        <div
                          key={`${h?.editedAt || "edit"}-${idx}`}
                          className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-3"
                        >
                          <div className="text-xs text-zinc-400 mb-2">
                            {when}
                          </div>
                          <div className="grid gap-2">
                            <div>
                              <div className="text-xs text-zinc-500 mb-1">
                                Trước
                              </div>
                              <div className="text-zinc-200 whitespace-pre-wrap break-words">
                                {prev}
                              </div>
                            </div>
                            {next != null && (
                              <div>
                                <div className="text-xs text-zinc-500 mb-1">
                                  Sau
                                </div>
                                <div className="text-zinc-200 whitespace-pre-wrap break-words">
                                  {next}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-sm text-zinc-400">
                  Không có lịch sử chỉnh sửa.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <MessageInput
        editingMessage={editingMessage}
        onCancelEdit={() => setEditingMessage(null)}
      />
    </div>
  );
};

export default ChatContainer;

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
import { Smile, MoreHorizontal, Play, Pause, Mic, Crown } from "lucide-react";
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

    const onLoaded = () =>
      setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    const onTime = () =>
      setCurrent(Number.isFinite(el.currentTime) ? el.currentTime : 0);
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
    <div className="w-[280px] max-w-full rounded-xl border border-base-300 bg-base-200 px-3 py-2">
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className="btn btn-success btn-circle btn-sm"
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
          title={isPlaying ? "Tạm dừng" : "Phát"}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-base-content/60 shrink-0" />
            <div
              className="truncate text-sm text-base-content"
              title={safeName}
            >
              {safeName}
            </div>
            <div className="ml-auto text-xs text-base-content/60 tabular-nums shrink-0">
              {formatSeconds(current)} / {formatSeconds(duration)}
            </div>
          </div>

          <div className="mt-2 h-2 w-full rounded-full bg-base-300 overflow-hidden">
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

  const { authUser, incomingCall, clearIncomingCall, socket, onlineUsers } =
    useAuthStore();
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
  const [showMembersPanel, setShowMembersPanel] = useState(true);
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

  useEffect(() => {
    document.body.classList.toggle("mobile-video-call-active", isCalling);
    return () => {
      document.body.classList.remove("mobile-video-call-active");
    };
  }, [isCalling]);

  const memberRows = (() => {
    if (!selectedConversation) return [];
    if (selectedConversation.type === "GROUP") {
      const ids = new Set();
      const rows = [];
      for (const m of messages) {
        const sid = String(m?.senderId || "");
        if (!sid || sid === "RushCordAI" || ids.has(sid)) continue;
        ids.add(sid);
        const u = users.find((x) => String(x._id) === sid);
        rows.push({
          id: sid,
          name: u?.fullName || sid,
          avatar: u?.profilePic || "/avatar.png",
          online: onlineUsers.includes(sid),
        });
      }
      if (authUser?._id && !ids.has(String(authUser._id))) {
        rows.unshift({
          id: String(authUser._id),
          name: authUser.fullName || "You",
          avatar: authUser.profilePic || "/avatar.png",
          online: onlineUsers.includes(String(authUser._id)),
        });
      }
      return rows;
    }
    const other = users.find(
      (u) => String(u._id) === String(selectedConversation.otherUserId),
    );
    return [
      {
        id: String(authUser?._id || "me"),
        name: authUser?.fullName || "You",
        avatar: authUser?.profilePic || "/avatar.png",
        online: onlineUsers.includes(String(authUser?._id || "")),
      },
      {
        id: String(other?._id || selectedConversation.otherUserId || "other"),
        name: other?.fullName || "User",
        avatar: other?.profilePic || "/avatar.png",
        online: onlineUsers.includes(String(other?._id || "")),
      },
    ];
  })();

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
              const roomName = String(
                selectedConversation.conversationId || "",
              ).trim();
              if (!roomName) return;
              setCallPeerId(null);
              setCallRoomName(roomName);
              setIsCalling(true);
              if (socket)
                socket.emit("callInviteGroup", { conversationId: roomName });
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
            if (socket)
              socket.emit("callInvite", { to: otherUserId, roomName });
          }}
          callDisabled={!selectedConversation}
        />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-(--discord-chat)">
      <ChatHeader
        onCall={() => {
          if (!selectedConversation) return;
          if (selectedConversation.type === "GROUP") {
            const roomName = String(
              selectedConversation.conversationId || "",
            ).trim();
            if (!roomName) return;
            setCallPeerId(null);
            setCallRoomName(roomName);
            setIsCalling(true);
            if (socket)
              socket.emit("callInviteGroup", { conversationId: roomName });
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
        onToggleMembers={() => setShowMembersPanel((v) => !v)}
        membersOpen={showMembersPanel}
      />

      {/* VIDEO CALL */}
      {isCalling && selectedConversation && (
        <div className="discord-modal-scrim fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="discord-modal-card w-full max-w-4xl overflow-hidden">
            <div className="discord-topbar flex items-center justify-between gap-3 px-4 py-3">
              <h1 className="text-base-content text-base sm:text-lg font-semibold truncate">
                {selectedConversation?.type === "GROUP" ? (
                  <>
                    Group call:{" "}
                    <span className="text-blue-400">
                      {selectedConversation?.title ||
                        selectedConversation?.conversationId}
                    </span>
                  </>
                ) : (
                  <>
                    Video Call with{" "}
                    <span className="text-blue-400">
                      {selectedConversation?.otherUserId}
                    </span>
                  </>
                )}
              </h1>
              <button
                type="button"
                onClick={() => setEndSignal((n) => n + 1)}
                className="discord-icon-button flex size-9 items-center justify-center rounded-full bg-white/5"
                aria-label="Close call"
                title="Đóng"
              >
                <MoreHorizontal className="size-4 rotate-45" />
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
        <div className="discord-modal-card fixed right-4 top-4 z-60 p-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 text-base-content">
              {(() => {
                const kind = String(incomingCall?.kind || "").toUpperCase();
                const isGroup = kind === "GROUP";
                if (isGroup) {
                  const cid = String(
                    incomingCall?.conversationId ||
                      incomingCall?.roomName ||
                      "",
                  );
                  const conv = conversations.find(
                    (c) => String(c.conversationId) === cid,
                  );
                  const name = conv?.title || cid || "Group";
                  return (
                    <>
                      📞 Incoming group call:{" "}
                      <span className="text-blue-300">{name}</span>
                    </>
                  );
                }
                const fromName =
                  users.find((u) => String(u._id) === String(incomingCall.from))
                    ?.fullName || incomingCall.from;
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
                    const cid = String(
                      incomingCall?.conversationId ||
                        incomingCall?.roomName ||
                        "",
                    ).trim();
                    if (!cid) return;
                    const conv =
                      conversations.find(
                        (c) => String(c.conversationId) === cid,
                      ) || null;

                    setCallPeerId(null);
                    setCallRoomName(cid);
                    setSelectedConversation(
                      conv || {
                        conversationId: cid,
                        type: "GROUP",
                        title: "",
                        avatar: "",
                      },
                    );
                    clearIncomingCall();
                    setIsCalling(true);
                    return;
                  }

                  const caller = users.find(
                    (u) => String(u._id) === String(incomingCall.from),
                  ) || {
                    _id: incomingCall.from,
                    fullName: incomingCall.from,
                  };

                  // Ensure VideoCall mounts with the correct peer id even if selectedUser updates later.
                  setCallPeerId(incomingCall.from);
                  setCallRoomName(incomingCall.roomName || null);
                  setSelectedConversation({
                    conversationId:
                      incomingCall.roomName ||
                      `DM#${[
                        String(authUser?._id || ""),
                        String(incomingCall.from || ""),
                      ]
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
                className="btn btn-success btn-sm rounded-md"
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
                className="btn btn-error btn-sm rounded-md"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-(--discord-chat)">
          {/* MESSAGES */}
          <div className="discord-scroll mobile-chat-scroll flex-1 overflow-y-auto bg-(--discord-chat) px-0 py-4">
            {messages.length === 0 && (
              <div className="px-5 pb-6 pt-2">
                <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-(--discord-rail) text-(--discord-text)">
                  <Smile className="size-8" />
                </div>
                <h2 className="text-3xl font-bold text-white">
                  Chào mừng bạn đến với #
                  {selectedConversation?.title || "ghi-chú-tài-nguyên"}!
                </h2>
                <p className="mt-2 text-sm text-(--discord-text-muted)">
                  Đây là sự khởi đầu của kênh #
                  {selectedConversation?.title || "ghi-chú-tài-nguyên"}.
                </p>
                <button
                  type="button"
                  className="mt-4 rounded-md bg-(--discord-active) px-3 py-2 text-sm font-medium text-(--discord-text) hover:bg-(--discord-hover)"
                >
                  ✏️ Chỉnh sửa kênh
                </button>
              </div>
            )}

            {messages.map((message, index) =>
              message?.isSystem ? (
                <div
                  key={message._id}
                  ref={index === messages.length - 1 ? messageEndRef : null}
                  className="px-5 py-1 text-center text-xs text-(--discord-text-muted)"
                >
                  {message.text || ""}
                </div>
              ) : (
                <div
                  key={message._id}
                  className={`group relative flex w-full gap-3 px-3 py-1 hover:bg-white/5 ${
                    String(message.senderId) === String(authUser?._id)
                      ? "justify-end"
                      : "justify-start"
                  }`}
                  ref={index === messages.length - 1 ? messageEndRef : null}
                >
                  <img
                    src={
                      String(message.senderId) === String(authUser?._id)
                        ? authUser.profilePic || "/avatar.png"
                        : String(message.senderId) === "RushCordAI"
                          ? "https://rushcord-media-448772857696-ap-southeast-1.s3.ap-southeast-1.amazonaws.com/AI/RushCordAI.png"
                          : (() => {
                              const sender = users.find(
                                (u) =>
                                  String(u._id) === String(message.senderId),
                              );
                              return sender?.profilePic || "/avatar.png";
                            })()
                    }
                    alt="profile"
                    className={`mt-1 size-10 rounded-full object-cover ${
                      String(message.senderId) === String(authUser?._id)
                        ? "order-2"
                        : "order-1"
                    }`}
                  />
                  <div
                    className={`relative min-w-0 max-w-[72%] rounded-2xl px-3 py-2 ${
                      String(message.senderId) === String(authUser?._id)
                        ? "bg-(--discord-accent) text-white"
                        : "bg-(--discord-panel-strong) text-(--discord-text)"
                    } ${String(message.senderId) === String(authUser?._id) ? "order-1" : "order-2"}`}
                  >
                    <div
                      className={`mb-0.5 flex items-end gap-2 ${
                        String(message.senderId) === String(authUser?._id)
                          ? "justify-end"
                          : ""
                      }`}
                    >
                      <span className="text-[14px] font-bold text-white">
                        {String(message.senderId) === String(authUser?._id)
                          ? authUser?.fullName || "You"
                          : users.find(
                              (u) => String(u._id) === String(message.senderId),
                            )?.fullName || message.senderId}
                      </span>
                      <time
                        className={`text-[11px] ${
                          String(message.senderId) === String(authUser?._id)
                            ? "text-white/80"
                            : "text-(--discord-text-muted)"
                        }`}
                      >
                        {formatMessageTime(message.createdAt)}
                      </time>
                    </div>
                    <div
                      className={`text-[16px] leading-snug ${
                        String(message.senderId) === String(authUser?._id)
                          ? "text-right text-white"
                          : "text-(--discord-text)"
                      }`}
                    >
                      {!message.isRecalled &&
                        !message.isDeletedForMe &&
                        message.isEdited &&
                        Array.isArray(message.editHistory) && (
                          <button
                            type="button"
                            className={`mb-1 text-[11px] underline underline-offset-2 ${
                              String(message.senderId) === String(authUser?._id)
                                ? "text-white/80 hover:text-white"
                                : "text-(--discord-text-muted) hover:text-(--discord-text)"
                            }`}
                            onClick={() => setHistoryMessage(message)}
                            title="Xem lịch sử chỉnh sửa"
                          >
                            Đã chỉnh sửa
                          </button>
                        )}
                      {message.isRecalled ? (
                        <p className="italic text-(--discord-text-muted)">
                          {String(message.senderId) === String(authUser?._id)
                            ? "Bạn đã thu hồi tin nhắn với mọi người."
                            : "Tin nhắn đã bị thu hồi"}
                        </p>
                      ) : message.isDeletedForMe ? (
                        <p className="italic text-(--discord-text-muted)">
                          Bạn đã thu hồi tin nhắn với bản thân.
                        </p>
                      ) : (
                        <>
                          {/* 🖼️ IMAGE */}
                          {message.image && (
                            <img
                              src={message.image}
                              alt="attachment"
                              className="mt-1 max-w-[320px] rounded cursor-pointer hover:opacity-90"
                              onClick={() =>
                                window.open(message.image, "_blank")
                              }
                            />
                          )}

                          {/* 🖼️ IMAGES (gallery) */}
                          {Array.isArray(message.images) &&
                            message.images.length > 0 && (
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
                                    className="w-[220px] max-w-full rounded cursor-pointer object-cover hover:opacity-90"
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
                                onClick={() =>
                                  window.open(message.file, "_blank")
                                }
                              />
                            ) : typeof message.contentType === "string" &&
                              message.contentType.startsWith("video/") ? (
                              <div className="max-w-[320px]">
                                <video
                                  src={message.file}
                                  controls
                                  playsInline
                                  className="w-full rounded border border-white/10 bg-black"
                                />
                              </div>
                            ) : typeof message.contentType === "string" &&
                              message.contentType.startsWith("audio/") ? (
                              <AudioMessage
                                url={message.file}
                                fileName={
                                  message.fileName || getFileName(message.file)
                                }
                              />
                            ) : (
                              <a
                                href={message.file}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 flex max-w-[320px] items-center gap-3 rounded border border-white/10 bg-black/10 px-3 py-2 transition hover:bg-white/5"
                              >
                                {/* PREVIEW */}
                                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-white/10 bg-white/5">
                                  <span className="text-xl">
                                    {getFileIcon(message.file)}
                                  </span>
                                  <span className="text-[10px] text-base-content/60">
                                    {(() => {
                                      const name = (
                                        message.fileName ||
                                        getFileName(message.file) ||
                                        ""
                                      ).toLowerCase();
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
                                    className="truncate max-w-[180px] text-sm text-base-content"
                                    title={
                                      message.fileName ||
                                      getFileName(message.file)
                                    }
                                  >
                                    {message.fileName ||
                                      getFileName(message.file)}
                                  </div>
                                  <div className="text-xs text-base-content/60">
                                    Nhấn để mở
                                  </div>
                                </div>
                              </a>
                            )
                          ) : null}

                          {/* TEXT */}
                          {message.text && <p>{message.text}</p>}
                        </>
                      )}
                    </div>
                    {!message.isRecalled && !message.isDeletedForMe && (
                      <div className="mt-1">{renderReactions(message)}</div>
                    )}
                    {!message.isRecalled && !message.isDeletedForMe && (
                      <div
                        className={`pointer-events-none absolute top-1 z-20 flex items-start gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 ${
                          String(message.senderId) === String(authUser?._id)
                            ? "-left-20"
                            : "-right-16"
                        }`}
                      >
                        <div className="relative" data-react-picker>
                          <button
                            type="button"
                            title="React"
                            className="discord-icon-button message-action-button flex items-center justify-center border border-transparent bg-transparent"
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
                            <div className="absolute bottom-full right-0 z-70 mb-2">
                              <EmojiPicker
                                onEmojiClick={async (emojiData) => {
                                  setReactingForMessageId(null);
                                  await reactToMessage(
                                    message._id,
                                    emojiData.emoji,
                                  );
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
                            className="discord-icon-button message-action-button flex items-center justify-center border border-transparent bg-transparent"
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
                              className="absolute bottom-full z-60 mb-1 min-w-44 rounded-lg border border-white/10 bg-(--discord-panel) py-1 shadow-lg"
                              data-message-menu
                              style={
                                String(message.senderId) ===
                                String(authUser?._id)
                                  ? { right: 0 }
                                  : { left: 0 }
                              }
                            >
                              <li>
                                <button
                                  type="button"
                                  disabled={
                                    String(message.senderId) !==
                                      String(authUser?._id) ||
                                    message.isDeletedForMe ||
                                    message.isRecalled ||
                                    !message.text
                                  }
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                                  onClick={() => {
                                    if (
                                      String(message.senderId) !==
                                      String(authUser?._id)
                                    )
                                      return;
                                    if (
                                      message.isDeletedForMe ||
                                      message.isRecalled
                                    )
                                      return;
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
                                  disabled={
                                    String(message.senderId) !==
                                    String(authUser?._id)
                                  }
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                                  onClick={() => {
                                    if (
                                      String(message.senderId) !==
                                      String(authUser?._id)
                                    )
                                      return;
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
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-white/5"
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
                </div>
              ),
            )}
          </div>
          {selectedConversation && isTyping && (
            <div className="px-5 pb-1 text-sm text-(--discord-text-muted)">
              {(() => {
                const fromId = typingFromUserId;
                if (!fromId) return "Đang gõ...";
                const u = users.find((x) => String(x._id) === String(fromId));
                const name = u?.fullName || fromId;
                return `${name} đang gõ...`;
              })()}
            </div>
          )}
        </div>
        {showMembersPanel ? (
          <aside className="hidden w-[240px] min-w-[240px] border-l border-(--discord-border) bg-(--discord-sidebar) px-2 py-3 lg:block">
            <div className="px-2 text-[12px] font-semibold uppercase tracking-wide text-(--discord-text-muted)">
              NGOẠI TUYẾN — {memberRows.filter((m) => !m.online).length}
            </div>
            <div className="mt-2 space-y-0.5">
              {memberRows.map((m, idx) => (
                <div
                  key={`member_${m.id}_${idx}`}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-(--discord-text) hover:bg-(--discord-hover)"
                >
                  <img
                    src={m.avatar}
                    alt={m.name}
                    className={`size-8 rounded-full object-cover ${
                      m.online ? "" : "grayscale"
                    }`}
                  />
                  <span className="truncate text-sm">{m.name}</span>
                  {idx === 0 ? (
                    <Crown className="ml-auto size-3.5 text-[#faa81a]" />
                  ) : null}
                </div>
              ))}
            </div>
          </aside>
        ) : null}
      </div>
      <MessageInput
        editingMessage={editingMessage}
        onCancelEdit={() => setEditingMessage(null)}
      />
      {recallPromptMessage && (
        <div
          className="discord-modal-scrim fixed inset-0 z-55 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRecallPromptMessage(null);
          }}
          role="presentation"
        >
          <div
            className="discord-modal-card w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="recall-dialog-title"
          >
            <div className="flex justify-between items-start gap-3 p-4 border-b border-base-300">
              <h2
                id="recall-dialog-title"
                className="text-base-content font-semibold text-lg pr-2"
              >
                Thu hồi tin nhắn
              </h2>
              <button
                type="button"
                onClick={() => setRecallPromptMessage(null)}
                className="discord-icon-button flex size-9 items-center justify-center rounded-full bg-white/5"
                aria-label="Đóng"
              >
                <MoreHorizontal className="size-4 rotate-45" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <button
                type="button"
                className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-colors hover:bg-white/8"
                onClick={async () => {
                  const id = recallPromptMessage._id;
                  setRecallPromptMessage(null);
                  await recallMessage(id);
                }}
              >
                <div className="text-base-content font-medium mb-1">
                  Thu hồi với mọi người
                </div>
                <p className="text-sm text-base-content/60 leading-snug">
                  Tin nhắn này sẽ bị thu hồi với mọi người trong đoạn chat.
                </p>
              </button>
              <button
                type="button"
                disabled={recallPromptMessage.isDeletedForMe}
                className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-colors hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={async () => {
                  if (recallPromptMessage.isDeletedForMe) return;
                  const id = recallPromptMessage._id;
                  setRecallPromptMessage(null);
                  await recallMessageMe(id);
                }}
              >
                <div className="text-base-content font-medium mb-1">
                  Thu hồi với bạn
                </div>
                <p className="text-sm text-base-content/60 leading-snug">
                  Chúng tôi sẽ gỡ tin nhắn này ở phía bạn. Những người khác
                  trong đoạn chat vẫn có thể xem được.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {showForwardModal && (
        <div className="discord-modal-scrim fixed inset-0 z-50 flex items-center justify-center">
          <div className="discord-modal-card discord-scroll max-h-[400px] w-[320px] overflow-y-auto p-4">
            {/* HEADER */}
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base-content font-semibold">
                Chọn người nhận
              </h2>
              <button
                onClick={() => setShowForwardModal(false)}
                className="discord-icon-button flex size-8 items-center justify-center rounded-full bg-white/5"
              >
                <MoreHorizontal className="size-4 rotate-45" />
              </button>
            </div>

            {/* USER LIST */}
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user._id}
                  onClick={() => handleSelectUser(user._id)}
                  className="discord-list-item cursor-pointer rounded-lg"
                >
                  <img
                    src={user.profilePic || "/avatar.png"}
                    className="h-8 w-8 rounded-full border border-white/10"
                  />
                  <span className="text-base-content">{user.fullName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {historyMessage && (
        <div
          className="discord-modal-scrim fixed inset-0 z-70 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setHistoryMessage(null);
          }}
          role="presentation"
        >
          <div
            className="discord-modal-card w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-dialog-title"
          >
            <div className="flex justify-between items-start gap-3 p-4 border-b border-base-300">
              <h2
                id="history-dialog-title"
                className="text-base-content font-semibold text-lg pr-2"
              >
                Lịch sử chỉnh sửa
              </h2>
              <button
                type="button"
                onClick={() => setHistoryMessage(null)}
                className="discord-icon-button flex size-9 items-center justify-center rounded-full bg-white/5"
                aria-label="Đóng"
              >
                <MoreHorizontal className="size-4 rotate-45" />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="rounded-lg border border-base-300 bg-base-200 p-3">
                <div className="text-xs text-base-content/60 mb-1">
                  Nội dung hiện tại
                </div>
                <div className="text-base-content whitespace-pre-wrap wrap-break-word">
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
                      const prev =
                        typeof h?.prevText === "string" ? h.prevText : "";
                      const next =
                        typeof h?.nextText === "string" ? h.nextText : null;
                      return (
                        <div
                          key={`${h?.editedAt || "edit"}-${idx}`}
                          className="rounded-lg border border-base-300 bg-base-200/60 p-3"
                        >
                          <div className="text-xs text-base-content/60 mb-2">
                            {when}
                          </div>
                          <div className="grid gap-2">
                            <div>
                              <div className="text-xs text-base-content/50 mb-1">
                                Trước
                              </div>
                              <div className="text-base-content whitespace-pre-wrap wrap-break-word">
                                {prev}
                              </div>
                            </div>
                            {next != null && (
                              <div>
                                <div className="text-xs text-base-content/50 mb-1">
                                  Sau
                                </div>
                                <div className="text-base-content whitespace-pre-wrap wrap-break-word">
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
                <div className="text-sm text-base-content/60">
                  Không có lịch sử chỉnh sửa.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatContainer;

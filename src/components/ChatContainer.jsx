import { useChatStore } from "../store/useChatStore";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import VideoCall from "../components/VideoCall";
import GroupVideoCall from "../components/GroupVideoCall";
import { getFileIcon } from "../lib/utils";
import { Smile, MoreHorizontal, Play, Pause, Mic, Volume2, Trash2, Send } from "lucide-react";
import {
  isAiBotMessage,
  RUSHCORD_AI_AVATAR_URL,
  RUSHCORD_AI_DISPLAY_NAME,
} from "../lib/aiChatUtils";
import EmojiPicker from "emoji-picker-react";
import MediaLightboxModal from "./MediaLightboxModal";
import toast from "react-hot-toast";
import {
  downloadMessageAttachments,
  getMessageDownloadables,
  hasMessageAttachments,
} from "../lib/downloadAttachment";

const REACTION_PICKER_W = 320;
const REACTION_PICKER_H = 400;
const REACTION_PICKER_GAP = 8;

const computeReactionPickerPosition = (anchorRect) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 8;

  let top = anchorRect.top - REACTION_PICKER_H - REACTION_PICKER_GAP;
  if (top < pad) {
    top = anchorRect.bottom + REACTION_PICKER_GAP;
    if (top + REACTION_PICKER_H > vh - pad) {
      top = Math.max(pad, vh - REACTION_PICKER_H - pad);
    }
  }

  let left = anchorRect.left + anchorRect.width / 2 - REACTION_PICKER_W / 2;
  left = Math.max(pad, Math.min(left, vw - REACTION_PICKER_W - pad));

  return { top, left };
};

const formatSeconds = (sec) => {
  const s = Number.isFinite(sec) ? Math.max(0, Math.floor(sec)) : 0;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
};

const dmRoomName = (userA, userB) => {
  const [x, y] = [String(userA || ""), String(userB || "")].sort();
  return `DM#${x}#${y}`;
};

const isActiveCallForConversation = (conversation, roomName, peerId, authUserId) => {
  const room = String(roomName || "");
  if (!conversation || !room) return false;

  if (conversation.type === "DM") {
    const convId = String(conversation.conversationId || "");
    const peer = String(peerId || conversation.otherUserId || "");
    if (convId === room) return true;
    if (authUserId && peer) return dmRoomName(authUserId, peer) === room;
    return false;
  }

  if (conversation.type === "GROUP") {
    const cid = String(conversation.conversationId || "");
    return room === cid || room.startsWith(`${cid}#`);
  }

  return false;
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
    <div className="message-embed w-[280px] max-w-full rounded-xl px-3 py-2">
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
            <Mic className="w-4 h-4 shrink-0 opacity-60" />
            <div
              className="truncate text-sm"
              title={safeName}
            >
              {safeName}
            </div>
            <div className="message-meta-received ml-auto shrink-0 text-xs tabular-nums">
              {formatSeconds(current)} / {formatSeconds(duration)}
            </div>
          </div>

          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--message-embed-border)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct * 100}%`,
                backgroundColor: "var(--message-audio-progress)",
              }}
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
    getChannels,
    isMessagesLoading,
    selectedConversation,
    selectedChannel,
    channels,
    voiceSession,
    voiceEndSignal,
    groupPanelView,
    joinVoiceChannel,
    leaveVoiceChannel,
    setSelectedChannel,
    setSelectedConversation,
    subscribeToMessages,
    unsubscribeFromMessages,
    isTyping,
    typingFromUserId,
    recallMessage,
    recallMessageMe,
    forwardMessage,
    reactToMessage,
    setDmCallActive,
    highlightMessageId,
    pendingScrollMessageId,
    clearMessageSearchHighlight,
    dismissAiMessage,
    sendAiDraftToConversation,
  } = useChatStore();

  const { authUser, incomingCall, clearIncomingCall, socket } = useAuthStore();
  const messageEndRef = useRef(null);
  const [isCalling, setIsCalling] = useState(false);
  // The actual peer we are calling / answering. Avoids races with selectedUser updates.
  const [callPeerId, setCallPeerId] = useState(null);
  const [callRoomName, setCallRoomName] = useState(null);
  const [endSignal, setEndSignal] = useState(0);
  const callPeerIdRef = useRef(null);
  const callRoomNameRef = useRef(null);
  const isCallingRef = useRef(false);

  const showVoicePanel =
    selectedConversation?.type === "GROUP" &&
    groupPanelView === "voice" &&
    Boolean(voiceSession) &&
    String(voiceSession.conversationId) ===
      String(selectedConversation?.conversationId);

  const activeVoiceChannel = showVoicePanel
    ? channels.find(
        (c) => String(c.channelId) === String(voiceSession.voiceChannelId),
      )
    : null;

  const groupVideoCallEl = voiceSession ? (
    <GroupVideoCall
      key={voiceSession.roomName}
      roomName={voiceSession.roomName}
      autoStart
      variant="embedded"
      forceEndSignal={voiceEndSignal}
      notifyHangupGroup={false}
      getDisplayName={(identity) => {
        const id = String(identity || "");
        const u = users.find((x) => String(x._id) === id);
        return u?.fullName || id;
      }}
      getUserProfile={(identity) => {
        const id = String(identity || "");
        const u = users.find((x) => String(x._id) === id);
        if (u) return { fullName: u.fullName, profilePic: u.profilePic };
        if (String(id) === String(authUser?._id)) {
          return {
            fullName: authUser?.fullName,
            profilePic: authUser?.profilePic,
          };
        }
        return { fullName: id, profilePic: "/avatar.png" };
      }}
      onEnd={() => {
        leaveVoiceChannel();
      }}
    />
  ) : null;
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messageMenuId, setMessageMenuId] = useState(null);
  const [recallPromptMessage, setRecallPromptMessage] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [historyMessage, setHistoryMessage] = useState(null);
  const [reactingForMessageId, setReactingForMessageId] = useState(null);
  const [reactionPickerStyle, setReactionPickerStyle] = useState(null);
  const reactButtonRef = useRef(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [aiSendConfirmMessage, setAiSendConfirmMessage] = useState(null);

  const updateReactionPickerPosition = useCallback(() => {
    const el = reactButtonRef.current;
    if (!el) return;
    setReactionPickerStyle(computeReactionPickerPosition(el.getBoundingClientRect()));
  }, []);

  const toggleReactionPicker = (messageId, buttonEl) => {
    if (reactingForMessageId === messageId) {
      setReactingForMessageId(null);
      reactButtonRef.current = null;
      setReactionPickerStyle(null);
      return;
    }
    reactButtonRef.current = buttonEl;
    setReactingForMessageId(messageId);
    setReactionPickerStyle(
      computeReactionPickerPosition(buttonEl.getBoundingClientRect()),
    );
  };

  const openMediaPreview = (type, url, fileName) => {
    if (!url) return;
    setMediaPreview({ type, url, fileName: fileName || undefined });
  };

  const handleDownloadMessage = async (message) => {
    setMessageMenuId(null);
    const items = getMessageDownloadables(message);
    if (items.length === 0) {
      toast.error("Tin nhắn không có file đính kèm");
      return;
    }

    const toastId = toast.loading(
      items.length > 1
        ? `Đang tải ${items.length} file...`
        : "Đang tải xuống...",
    );

    try {
      const count = await downloadMessageAttachments(message);
      toast.success(
        count > 1 ? `Đã tải ${count} file` : "Đã tải xuống",
        { id: toastId },
      );
    } catch {
      toast.error("Không tải được file. Vui lòng thử lại.", { id: toastId });
    }
  };

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
      reactButtonRef.current = null;
      setReactionPickerStyle(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [reactingForMessageId]);

  useEffect(() => {
    if (!reactingForMessageId) return;
    updateReactionPickerPosition();
    window.addEventListener("resize", updateReactionPickerPosition);
    window.addEventListener("scroll", updateReactionPickerPosition, true);
    return () => {
      window.removeEventListener("resize", updateReactionPickerPosition);
      window.removeEventListener("scroll", updateReactionPickerPosition, true);
    };
  }, [reactingForMessageId, updateReactionPickerPosition]);

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
            className="message-reaction shrink-0"
            onClick={() => reactToMessage(message._id, emoji)}
            title="Bấm để thả/bỏ react"
          >
            <span className="mr-1">{emoji}</span>
            <span className="message-reaction-count">{count}</span>
          </button>
        ))}
      </div>
    );
  };

  // =========================
  // GROUP: load channel list
  // =========================
  useEffect(() => {
    const conv = selectedConversation;
    if (!conv?.conversationId) return;

    let cancelled = false;
    (async () => {
      await getChannels(conv.conversationId);
      if (cancelled) return;
      if (conv.type === "GROUP") {
        const { channels: chs, selectedChannel: cur } = useChatStore.getState();
        const stillValid = cur && chs.some((c) => String(c.channelId) === String(cur.channelId));
        if (!stillValid) {
          const firstChat = chs.find((c) => c.channelType === "CHAT");
          if (firstChat) setSelectedChannel(firstChat);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedConversation?.conversationId, selectedConversation?.type, getChannels, setSelectedChannel]);

  // =========================
  // LOAD MESSAGES
  // =========================
  useEffect(() => {
    if (!selectedConversation?.conversationId) return;
    if (
      selectedConversation.type === "GROUP" &&
      !selectedChannel?.channelId
    ) {
      return;
    }

    getMessages(selectedConversation.conversationId);
    subscribeToMessages();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditingMessage(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistoryMessage(null);

    return () => {
      unsubscribeFromMessages();
    };
  }, [
    selectedConversation?.conversationId,
    selectedConversation?.type,
    selectedChannel?.channelId,
    getMessages,
    subscribeToMessages,
    unsubscribeFromMessages,
  ]);

  // =========================
  // SOCKET: join text channel room (GROUP)
  // =========================
  useEffect(() => {
    const socket = useAuthStore.getState().socket;
    const cid = selectedConversation?.conversationId;
    if (!socket || typeof cid !== "string" || !cid.startsWith("GROUP#")) return;
    const chid = selectedChannel?.channelId;
    const chType = selectedChannel?.channelType;
    if (!chid || chType === "VOICE") return;

    socket.emit("joinConversationChannel", {
      conversationId: cid,
      channelId: chid,
    });
    return () => {
      socket.emit("leaveConversationChannel", {
        conversationId: cid,
        channelId: chid,
      });
    };
  }, [
    selectedConversation?.conversationId,
    selectedChannel?.channelId,
    selectedChannel?.channelType,
  ]);

  useEffect(() => {
    callPeerIdRef.current = callPeerId;
  }, [callPeerId]);

  useEffect(() => {
    callRoomNameRef.current = callRoomName;
  }, [callRoomName]);

  useEffect(() => {
    isCallingRef.current = isCalling;
  }, [isCalling]);

  useEffect(() => {
    setDmCallActive(Boolean(isCalling && selectedConversation?.type === "DM"));
  }, [isCalling, selectedConversation?.type, setDmCallActive]);

  // =========================
  // SOCKET: 1-1 call lifecycle
  // =========================
  useEffect(() => {
    if (!socket) return () => {};

    const onCallRejected = ({ from, roomName: rn }) => {
      if (!isCallingRef.current) return;
      const peer = callPeerIdRef.current;
      const room = callRoomNameRef.current;
      if (peer && String(from) !== String(peer)) return;
      if (room && rn && rn !== room) return;
      setIsCalling(false);
      setCallPeerId(null);
      setCallRoomName(null);
      setEndSignal(0);
    };

    socket.on("callRejected", onCallRejected);
    return () => socket.off("callRejected", onCallRejected);
  }, [socket]);

  // =========================
  // RESET CALL WHEN CHANGE CONVERSATION (not when accepting into call DM)
  // =========================
  useEffect(() => {
    const conv = selectedConversation;
    const room = callRoomNameRef.current;
    const peer = callPeerIdRef.current;

    if (
      isCallingRef.current &&
      isActiveCallForConversation(conv, room, peer, authUser?._id)
    ) {
      return;
    }

    if (
      isCallingRef.current &&
      callPeerIdRef.current &&
      callRoomNameRef.current
    ) {
      const s = useAuthStore.getState().socket;
      if (s) {
        s.emit("hangup", {
          to: callPeerIdRef.current,
          roomName: callRoomNameRef.current,
        });
      }
    }

    if (!isCallingRef.current) {
      if (!callPeerId && !callRoomName) return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsCalling(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCallPeerId(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCallRoomName(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEndSignal(0);
  }, [
    selectedConversation?.conversationId,
    selectedConversation?.type,
    selectedConversation?.otherUserId,
    authUser?._id,
    callPeerId,
    callRoomName,
  ]);

  // =========================
  // AUTO SCROLL
  // =========================
  useEffect(() => {
    if (pendingScrollMessageId) return;

    const timeout = setTimeout(() => {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    return () => clearTimeout(timeout);
  }, [messages, pendingScrollMessageId]);

  // =========================
  // SCROLL TO SEARCH RESULT
  // =========================
  useEffect(() => {
    const id = pendingScrollMessageId;
    if (!id || !messages.length) return;

    const timeout = setTimeout(() => {
      const el = document.querySelector(`[data-message-id="${id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      useChatStore.setState({ pendingScrollMessageId: null });
    }, 80);

    return () => clearTimeout(timeout);
  }, [messages, pendingScrollMessageId]);

  useEffect(() => {
    if (!highlightMessageId) return;
    const timeout = setTimeout(() => {
      clearMessageSearchHighlight();
    }, 2500);
    return () => clearTimeout(timeout);
  }, [highlightMessageId, clearMessageSearchHighlight]);

  useEffect(() => {
    document.body.classList.toggle(
      "mobile-video-call-active",
      isCalling || Boolean(showVoicePanel),
    );
    return () => {
      document.body.classList.remove("mobile-video-call-active");
    };
  }, [isCalling, showVoicePanel]);

  // =========================
  // LOADING (never unmount group voice — early return remounts GroupVideoCall)
  // =========================
  if (isMessagesLoading && !voiceSession) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader
          onCall={() => {
            if (!selectedConversation || selectedConversation.type !== "DM") return;
            const otherUserId = selectedConversation.otherUserId;
            if (!otherUserId) return;
            const roomName = dmRoomName(authUser?._id, otherUserId);
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
    <div className="relative flex flex-1 flex-col overflow-hidden bg-(--discord-chat)">
      {/* DM VIDEO CALL */}
      {isCalling && selectedConversation?.type === "DM" && (
        <div className="discord-modal-scrim fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="discord-modal-card w-full max-w-4xl overflow-hidden">
            <div className="discord-topbar flex items-center justify-between gap-3 px-4 py-3">
              <h1 className="text-base-content truncate text-base font-semibold sm:text-lg">
                Video Call with{" "}
                <span className="text-blue-400">
                  {users.find(
                    (u) =>
                      String(u._id) ===
                      String(
                        callPeerId || selectedConversation?.otherUserId,
                      ),
                  )?.fullName ||
                    callPeerId ||
                    selectedConversation?.otherUserId}
                </span>
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
              <VideoCall
                myId={authUser._id}
                remoteId={callPeerId || selectedConversation.otherUserId}
                roomName={callRoomName}
                autoStart
                forceEndSignal={endSignal}
                onEnd={() => {
                  setIsCalling(false);
                  setCallRoomName(null);
                  setCallPeerId(null);
                  setEndSignal(0);
                }}
              />
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
                      🔊 Vào kênh thoại:{" "}
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
                    const rn = String(incomingCall?.roomName || "");
                    const cid = String(
                      incomingCall?.conversationId ||
                        (rn.includes("#VOICE#") ? rn.split("#VOICE#")[0] : rn),
                    ).trim();
                    if (!cid.startsWith("GROUP#")) return;
                    let vid = String(incomingCall?.voiceChannelId || "").trim();
                    if (!vid && rn.includes("#VOICE#")) {
                      vid = rn.split("#VOICE#")[1] || "";
                    }
                    if (!vid) return;

                    const conv =
                      conversations.find(
                        (c) => String(c.conversationId) === cid,
                      ) || null;

                    setSelectedConversation(
                      conv || {
                        conversationId: cid,
                        type: "GROUP",
                        title: "",
                        avatar: "",
                      },
                    );
                    joinVoiceChannel(cid, vid);
                    clearIncomingCall();
                    return;
                  }

                  const caller = users.find(
                    (u) => String(u._id) === String(incomingCall.from),
                  ) || {
                    _id: incomingCall.from,
                    fullName: incomingCall.from,
                  };

                  const callerId = incomingCall.from;
                  const roomName =
                    incomingCall.roomName ||
                    dmRoomName(authUser?._id, callerId);

                  setCallPeerId(callerId);
                  setCallRoomName(roomName);
                  setSelectedConversation({
                    conversationId: roomName,
                    type: "DM",
                    otherUserId: caller._id,
                  });
                  clearIncomingCall();
                  setIsCalling(true);
                  if (socket)
                    socket.emit("callAccept", { to: callerId, roomName });
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

      {voiceSession ? (
        <div
          className={
            showVoicePanel
              ? "flex min-h-0 min-w-0 flex-1 flex-col bg-(--discord-chat)"
              : "hidden"
          }
          aria-hidden={!showVoicePanel}
        >
          {showVoicePanel ? (
            <div className="discord-topbar flex shrink-0 items-center gap-2 border-b border-(--discord-border) px-4 py-3">
              <Volume2 className="size-5 shrink-0 text-(--discord-text-muted)" />
              <h1 className="min-w-0 truncate text-base font-semibold text-(--discord-text)">
                <span className="text-(--discord-text-muted)">Kênh thoại · </span>
                {activeVoiceChannel?.name || voiceSession.voiceChannelId}
              </h1>
            </div>
          ) : null}
          <div
            className={
              showVoicePanel
                ? "discord-scroll flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4 sm:p-6"
                : ""
            }
          >
            <div
              className={
                showVoicePanel ? "mx-auto flex w-full max-w-6xl flex-1 flex-col" : ""
              }
            >
              {groupVideoCallEl}
            </div>
          </div>
        </div>
      ) : null}

      {!showVoicePanel ? (
        <>
          <ChatHeader
            onCall={() => {
              if (!selectedConversation || selectedConversation.type !== "DM") return;
              const otherUserId = selectedConversation.otherUserId;
              if (!otherUserId) return;
              const roomName = dmRoomName(authUser?._id, otherUserId);
              setCallPeerId(otherUserId);
              setCallRoomName(roomName);
              setIsCalling(true);
              if (socket) socket.emit("callInvite", { to: otherUserId, roomName });
            }}
            callDisabled={!selectedConversation}
          />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-(--discord-chat)">
          {/* MESSAGES */}
          <div className="discord-scroll mobile-chat-scroll flex-1 overflow-y-auto bg-(--discord-chat) px-0 py-4">
            {messages.length === 0 &&
              selectedConversation?.type === "DM" &&
              (() => {
                const otherId = selectedConversation?.otherUserId;
                const otherUser = users.find(
                  (u) => String(u._id) === String(otherId),
                );
                const displayName = otherUser?.fullName || "người này";
                const avatarUrl = otherUser?.profilePic || "/avatar.png";
                return (
                  <div className="px-5 pb-6 pt-2">
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="mb-4 size-16 rounded-full border border-(--discord-border) object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "/avatar.png";
                      }}
                    />
                    <h2 className="text-3xl font-bold text-(--discord-text)">
                      {displayName}
                    </h2>
                    <p className="mt-2 text-sm text-(--discord-text-muted)">
                      Đây là đầu cuộc trò chuyện của bạn với {displayName}.
                    </p>
                    <p className="mt-1 text-sm text-(--discord-text-muted)">
                      Hãy gửi tin nhắn đầu tiên để bắt đầu cuộc trò chuyện.
                    </p>
                  </div>
                );
              })()}
            {messages.length === 0 &&
              selectedConversation?.type !== "DM" && (
                <div className="px-5 pb-6 pt-2">
                  {selectedConversation?.type === "GROUP" &&
                String(selectedConversation?.avatar || "").trim() ? (
                  <img
                    src={selectedConversation.avatar}
                    alt=""
                    className="mb-4 size-16 rounded-full border border-(--discord-border) object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/avatar.png";
                    }}
                  />
                ) : (
                  <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-(--discord-rail) text-(--discord-text)">
                    <Smile className="size-8" />
                  </div>
                )}
                <h2 className="text-3xl font-bold text-(--discord-text)">
                  Chào mừng bạn đến với #
                  {selectedChannel?.name || "kênh-chat"}!
                </h2>
                <p className="mt-2 text-sm text-(--discord-text-muted)">
                  Đây là sự khởi đầu của kênh #
                  {selectedChannel?.name || "kênh-chat"}.
                </p>
              </div>
              )}

            {messages.map((message, index) =>
              message?.isSystem ? (
                <div
                  key={message._id}
                  data-message-id={message._id}
                  ref={index === messages.length - 1 ? messageEndRef : null}
                  className={`px-5 py-1 text-center text-xs text-(--discord-text-muted) ${
                    String(highlightMessageId) === String(message._id)
                      ? "message-search-highlight"
                      : ""
                  }`}
                >
                  {message.text || ""}
                </div>
              ) : (
                (() => {
                  const isBot = isAiBotMessage(message.senderId);
                  const isOwn =
                    !isBot &&
                    String(message.senderId) === String(authUser?._id);
                  return (
                <div
                  key={message._id}
                  data-message-id={message._id}
                  className={`message-row group relative flex w-full gap-3 px-3 py-1 ${
                    isOwn ? "justify-end" : "justify-start"
                  } ${
                    String(highlightMessageId) === String(message._id)
                      ? "message-search-highlight"
                      : ""
                  }`}
                  ref={index === messages.length - 1 ? messageEndRef : null}
                >
                  <img
                    src={
                      isOwn
                        ? authUser.profilePic || "/avatar.png"
                        : isBot
                          ? RUSHCORD_AI_AVATAR_URL
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
                      isOwn ? "order-2" : "order-1"
                    }`}
                  />
                  <div
                    className={`relative min-w-0 max-w-[72%] rounded-2xl px-3 py-2 ${
                      isOwn
                        ? "message-bubble-sent"
                        : "message-bubble-received"
                    } ${isOwn ? "order-1" : "order-2"}`}
                  >
                    {isBot ? (
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-(--discord-accent)">
                          {RUSHCORD_AI_DISPLAY_NAME} (chỉ bạn thấy)
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const t = String(message.text || "").trim();
                              if (!t) return;
                              setAiSendConfirmMessage(message);
                            }}
                            className="flex items-center gap-1 rounded-full border border-(--discord-border) bg-(--discord-panel-strong) px-2 py-1 text-xs font-semibold text-(--discord-accent) shadow-sm hover:bg-(--discord-hover)"
                            title="Gửi vào hội thoại"
                          >
                            <Send className="size-3.5" />
                            Gửi
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const t = String(message.text || "").trim();
                              if (!t) return;
                              navigator.clipboard?.writeText(t);
                              toast.success("Đã sao chép");
                            }}
                            className="text-xs font-semibold text-(--discord-accent) underline underline-offset-2"
                          >
                            Sao chép
                          </button>
                          <button
                            type="button"
                            onClick={() => dismissAiMessage(message._id)}
                            className="flex size-7 items-center justify-center rounded-full text-(--discord-text-muted) transition hover:bg-(--discord-hover) hover:text-(--discord-accent)"
                            title="Xóa tin nhắn AI"
                            aria-label="Xóa tin nhắn AI"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                    <div
                      className={`mb-0.5 flex items-end gap-2 ${
                        isOwn ? "justify-end" : ""
                      }`}
                    >
                      <span
                        className={`text-[14px] font-bold ${
                          isOwn
                            ? "message-name-sent"
                            : "message-name-received"
                        }`}
                      >
                        {isOwn
                          ? authUser?.fullName || "You"
                          : users.find(
                              (u) => String(u._id) === String(message.senderId),
                            )?.fullName || message.senderId}
                      </span>
                      <time
                        className={`text-[11px] ${
                          isOwn
                            ? "message-meta-sent"
                            : "message-meta-received"
                        }`}
                      >
                        {formatMessageTime(message.createdAt)}
                      </time>
                    </div>
                    )}
                    <div
                      className={`text-[16px] leading-snug ${
                        isOwn
                          ? "message-body-sent text-right"
                          : "message-body-received"
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
                                ? "message-meta-sent hover:opacity-100"
                                : "message-meta-received hover:text-(--discord-text)"
                            }`}
                            onClick={() => setHistoryMessage(message)}
                            title="Xem lịch sử chỉnh sửa"
                          >
                            Đã chỉnh sửa
                          </button>
                        )}
                      {message.isRecalled ? (
                        <p
                          className={`italic ${
                            String(message.senderId) === String(authUser?._id)
                              ? "message-meta-sent"
                              : "message-meta-received"
                          }`}
                        >
                          {String(message.senderId) === String(authUser?._id)
                            ? "Bạn đã thu hồi tin nhắn với mọi người."
                            : "Tin nhắn đã bị thu hồi"}
                        </p>
                      ) : message.isDeletedForMe ? (
                        <p className="message-meta-sent italic">
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
                                openMediaPreview("image", message.image)
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
                                    onClick={() => openMediaPreview("image", url)}
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
                                  openMediaPreview(
                                    "image",
                                    message.file,
                                    message.fileName ||
                                      getFileName(message.file),
                                  )
                                }
                              />
                            ) : typeof message.contentType === "string" &&
                              message.contentType.startsWith("video/") ? (
                              <button
                                type="button"
                                className="message-embed group relative max-w-[320px] cursor-pointer overflow-hidden rounded text-left"
                                onClick={() =>
                                  openMediaPreview(
                                    "video",
                                    message.file,
                                    message.fileName ||
                                      getFileName(message.file),
                                  )
                                }
                                aria-label="Xem video"
                              >
                                <video
                                  src={message.file}
                                  muted
                                  playsInline
                                  preload="metadata"
                                  className="pointer-events-none w-full"
                                />
                                <span
                                  className="absolute inset-0 flex items-center justify-center transition group-hover:opacity-90"
                                  style={{ backgroundColor: "var(--message-media-scrim)" }}
                                >
                                  <span
                                    className="flex size-12 items-center justify-center rounded-full"
                                    style={{ backgroundColor: "var(--message-media-scrim)" }}
                                  >
                                    <Play className="ml-0.5 size-6 text-(--discord-accent-contrast)" />
                                  </span>
                                </span>
                              </button>
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
                                className="message-embed mt-1 flex max-w-[320px] items-center gap-3 rounded px-3 py-2"
                              >
                                {/* PREVIEW */}
                                <div className="message-embed-icon flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl">
                                  <span className="text-xl">
                                    {getFileIcon(message.file)}
                                  </span>
                                  <span className="message-meta-received text-[10px]">
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
                                    className="message-body-received truncate max-w-[180px] text-sm"
                                    title={
                                      message.fileName ||
                                      getFileName(message.file)
                                    }
                                  >
                                    {message.fileName ||
                                      getFileName(message.file)}
                                  </div>
                                  <div className="message-meta-received text-xs">
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
                    {!isBot && !message.isRecalled && !message.isDeletedForMe && (
                      <div className="mt-1">{renderReactions(message)}</div>
                    )}
                    {!isBot && !message.isRecalled && !message.isDeletedForMe && (
                      <div
                        className={`pointer-events-none absolute top-1/2 z-20 flex -translate-y-1/2 items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 ${
                          isOwn ? "-left-20" : "-right-16"
                        }`}
                      >
                        <div className="relative" data-react-picker>
                          <button
                            type="button"
                            title="React"
                            className="discord-icon-button message-action-button flex items-center justify-center border border-transparent bg-transparent"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleReactionPicker(message._id, e.currentTarget);
                            }}
                          >
                            <Smile className="w-4 h-4" />
                          </button>

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
                              className="message-menu absolute bottom-full z-60 mb-1 min-w-44 rounded-lg py-1"
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
                                  className="message-menu-item w-full px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40"
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
                                  className="message-menu-item w-full px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40"
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
                                  className="message-menu-item w-full px-3 py-2 text-left text-sm"
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
                                  disabled={
                                    message.isRecalled ||
                                    message.isDeletedForMe ||
                                    !hasMessageAttachments(message)
                                  }
                                  className="message-menu-item w-full px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40"
                                  onClick={() => handleDownloadMessage(message)}
                                >
                                  {(() => {
                                    const n = getMessageDownloadables(message).length;
                                    return n > 1 ? `Tải xuống (${n})` : "Tải xuống";
                                  })()}
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
                  );
                })(),
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
          <MessageInput
            editingMessage={editingMessage}
            onCancelEdit={() => setEditingMessage(null)}
          />
          </div>
        </>
      ) : null}

      {aiSendConfirmMessage && (
        <div
          className="discord-modal-scrim fixed inset-0 z-55 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAiSendConfirmMessage(null);
          }}
          role="presentation"
        >
          <div
            className="discord-modal-card w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-send-dialog-title"
          >
            <div className="flex justify-between items-start gap-3 p-4 border-b border-base-300">
              <h2
                id="ai-send-dialog-title"
                className="text-base-content font-semibold text-lg pr-2"
              >
                Gửi tin nhắn
              </h2>
              <button
                type="button"
                onClick={() => setAiSendConfirmMessage(null)}
                className="discord-icon-button flex size-9 items-center justify-center rounded-full bg-white/5"
                aria-label="Đóng"
              >
                <MoreHorizontal className="size-4 rotate-45" />
              </button>
            </div>
            <p className="px-4 pt-4 text-sm text-base-content/70">
              Bạn có chắc muốn gửi nội dung này vào hội thoại hiện tại?
            </p>
            <div className="flex justify-end gap-2 p-4">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setAiSendConfirmMessage(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={async () => {
                  const msg = aiSendConfirmMessage;
                  const text = String(msg?.text || "").trim();
                  setAiSendConfirmMessage(null);
                  if (!text) return;
                  const ok = await sendAiDraftToConversation(text);
                  if (ok) dismissAiMessage(msg._id);
                }}
              >
                Gửi
              </button>
            </div>
          </div>
        </div>
      )}

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
      {typeof document !== "undefined" &&
        reactingForMessageId &&
        reactionPickerStyle &&
        createPortal(
          <div
            data-react-picker
            className="fixed z-9999 shadow-xl"
            style={{
              top: reactionPickerStyle.top,
              left: reactionPickerStyle.left,
            }}
          >
            <EmojiPicker
              width={REACTION_PICKER_W}
              height={REACTION_PICKER_H}
              onEmojiClick={async (emojiData) => {
                const messageId = reactingForMessageId;
                setReactingForMessageId(null);
                reactButtonRef.current = null;
                setReactionPickerStyle(null);
                if (messageId) {
                  await reactToMessage(messageId, emojiData.emoji);
                }
              }}
              lazyLoadEmojis
            />
          </div>,
          document.body,
        )}

      <MediaLightboxModal
        open={Boolean(mediaPreview)}
        type={mediaPreview?.type}
        url={mediaPreview?.url}
        fileName={mediaPreview?.fileName}
        onClose={() => setMediaPreview(null)}
      />
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

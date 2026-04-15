import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import VideoCall from "../components/VideoCall";
import { getFileIcon } from "../lib/utils";
import { Smile, MoreHorizontal } from "lucide-react";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    isTyping,
    subscribeToMessages,
    unsubscribeFromMessages,
    recallMessage,
    recallMessageMe,
    forwardMessage,
  } = useChatStore();

  const { authUser, incomingCall, clearIncomingCall, socket } = useAuthStore();
  const messageEndRef = useRef(null);
  const [isCalling, setIsCalling] = useState(false);
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messageMenuId, setMessageMenuId] = useState(null);
  const [recallPromptMessage, setRecallPromptMessage] = useState(null);
  const users = useChatStore((s) => s.users);
  const setSelectedUser = useChatStore((s) => s.setSelectedUser);
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

  // =========================
  // LOAD MESSAGES
  // =========================
  useEffect(() => {
    if (!selectedUser?._id) return;

    getMessages(selectedUser._id);
    subscribeToMessages();

    return () => {
      unsubscribeFromMessages();
    };
  }, [selectedUser?._id]);

  // =========================
  // RESET CALL WHEN CHANGE USER
  // =========================
  useEffect(() => {
    setIsCalling(false);
  }, [selectedUser?._id]);

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
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto relative">
      <ChatHeader />

      {/* CALL BUTTON */}
      <div className="p-2 border-b flex justify-end">
        <button
          onClick={() => setIsCalling(true)}
          disabled={!selectedUser}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg shadow disabled:opacity-50"
        >
          📞 Call {selectedUser?.fullName}
        </button>
      </div>

      {/* VIDEO CALL */}
      {isCalling && selectedUser && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-gray-900 rounded-lg p-4 m-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-white text-xl font-bold">
                Video Call with{" "}
                <span className="text-blue-400">{selectedUser?.fullName}</span>
              </h1>
              <button
                onClick={() => setIsCalling(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>

            <VideoCall
              myId={authUser._id}
              remoteId={selectedUser._id}
              incomingOffer={incomingOffer}
              onEnd={() => {
                setIsCalling(false);
                setIncomingOffer(null);
              }}
            />
          </div>
        </div>
      )}

      {/* INCOMING CALL */}
      {incomingCall && (
        <div className="fixed top-4 right-4 z-60 bg-white/5 backdrop-blur p-3 rounded-lg border">
          <div className="flex items-center gap-3">
            <div className="flex-1 text-white">
              📞 Incoming call from{" "}
              {users.find((u) => u._id === incomingCall.from)?.fullName ||
                incomingCall.from}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  const caller = users.find(
                    (u) => u._id === incomingCall.from,
                  ) || {
                    _id: incomingCall.from,
                    fullName: incomingCall.from,
                  };

                  setSelectedUser(caller);
                  setIncomingOffer(incomingCall.offer);
                  clearIncomingCall();
                  setIsCalling(true);
                }}
                className="bg-green-600 text-white px-3 py-1 rounded"
              >
                Accept
              </button>

              <button
                onClick={() => {
                  if (socket)
                    socket.emit("hangup", {
                      to: incomingCall.from,
                      from: authUser._id,
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
        {messages.map((message, index) => (
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
                      : selectedUser.profilePic || "/avatar.png"
                  }
                  alt="profile"
                />
              </div>
            </div>

            {/* TIME */}
            <div className="chat-header mb-1">
              <time className="text-xs opacity-50 ml-1">
                {formatMessageTime(message.createdAt)}
              </time>
            </div>

            {/* MESSAGE */}
            <div className="chat-bubble flex flex-col gap-2 relative">
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
                  {message.text && <p>{message.text}</p>}
                </>
              )}

              {/* HOVER: react + menu */}
              {!message.isRecalled && (
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
                  <button
                    type="button"
                    title="React (sắp có)"
                    disabled
                    className="btn btn-xs btn-circle bg-base-200 border border-base-300 opacity-60 cursor-not-allowed"
                  >
                    <Smile className="w-4 h-4" />
                  </button>

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
                            disabled
                            className="w-full px-3 py-2 text-left text-sm opacity-50 cursor-not-allowed"
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
          </div>
        ))}
      </div>
      {selectedUser && isTyping && (
        <div className="px-4 pb-1 text-sm text-zinc-400">
          {selectedUser.fullName} đang gõ...
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
      <MessageInput />
    </div>
  );
};

export default ChatContainer;

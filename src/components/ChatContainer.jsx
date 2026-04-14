import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import VideoCall from "../components/VideoCall";
import { getFileIcon } from "../lib/utils";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
    recallMessage,
    forwardMessage, // 🔥 thêm dòng này
  } = useChatStore();

  const { authUser, incomingCall, clearIncomingCall, socket } = useAuthStore();
  const messageEndRef = useRef(null);
  const [isCalling, setIsCalling] = useState(false);
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
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
            className={`chat ${
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
            <div className="chat-bubble flex flex-col gap-2">
              {message.isRecalled ? (
                <p className="italic text-gray-400">
                  {message.senderId === authUser._id
                    ? "Bạn đã thu hồi tin nhắn"
                    : "Tin nhắn đã bị thu hồi"}
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

                  {/* 📄 FILE */}
                  {message.file && (
                    <a
                      href={message.file}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-lg transition"
                    >
                      {/* ICON */}
                      <span className="text-xl">
                        {getFileIcon(message.file)}
                      </span>

                      {/* FILE NAME */}
                      <span className="truncate max-w-[150px]">
                        {getFileName(message.file)}
                      </span>
                    </a>
                  )}

                  {/* TEXT */}
                  {message.text && <p>{message.text}</p>}
                </>
              )}

              {/* RECALL BUTTON */}
              {!message.isRecalled && (
                <>
                  {/* 🔴 THU HỒI */}
                  {message.senderId === authUser._id && (
                    <button
                      onClick={() => recallMessage(message._id)}
                      className="text-xs text-red-400 mt-1 text-left"
                    >
                      Thu hồi
                    </button>
                  )}

                  {/* 🔵 FORWARD */}
                  <button
                    onClick={() => handleForward(message)}
                    className="text-xs text-blue-400 mt-1 text-left"
                  >
                    Chuyển tiếp
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
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

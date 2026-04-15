import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { uploadFileViaPresign } from "../lib/uploadMedia.js";
import { useAuthStore } from "./useAuthStore";
import {
  loadRecentConversations,
  upsertRecentDmConversation,
} from "../lib/recentConversationsCache.js";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  recentConversations: loadRecentConversations(),
  isTyping: false,
  _typingTimer: null,
  isUsersLoading: false,
  isMessagesLoading: false,

  // =========================
  // GET USERS
  // =========================
  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Error");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  // =========================
  // GET MESSAGES
  // =========================
  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Error");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  // =========================
  // SEND MESSAGE
  // =========================
  sendMessage: async ({ text = "", file = null, files = null }) => {
    const { selectedUser, messages } = get();

    if (!selectedUser?._id) {
      toast.error("No user selected");
      return;
    }

    const trimmed = typeof text === "string" ? text.trim() : "";
    const many = Array.isArray(files) ? files.filter(Boolean) : [];
    if (!trimmed && !file && many.length === 0) return;

    try {
      let body = { text: trimmed };
      if (many.length > 1) {
        const images = [];
        for (const f of many) {
          const { publicUrl, key } = await uploadFileViaPresign(f, "message");
          images.push({
            fileUrl: publicUrl,
            s3Key: key,
            mimeType: f.type || "image/jpeg",
            fileName: f.name,
            sizeBytes: f.size,
          });
        }
        body = { ...body, images };
      } else if (file || many.length === 1) {
        const single = file || many[0];
        const name = String(single?.name || "").toLowerCase();
        const isImageByExt =
          name.endsWith(".jpg") ||
          name.endsWith(".jpeg") ||
          name.endsWith(".png") ||
          name.endsWith(".webp") ||
          name.endsWith(".gif");
        const inferredMime =
          (single?.type && String(single.type)) ||
          (isImageByExt ? "image/jpeg" : "application/octet-stream");
        const { publicUrl, key } = await uploadFileViaPresign(single, "message");
        body = {
          ...body,
          fileUrl: publicUrl,
          s3Key: key,
          mimeType: inferredMime,
          fileName: single.name,
          sizeBytes: single.size,
        };
      }

      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        body,
      );

      set({ messages: [...messages, res.data] });

      // Update recent DM conversations cache (top 10)
      try {
        const myId = useAuthStore.getState().authUser?._id;
        if (myId) {
          const nextCache = upsertRecentDmConversation({
            myUserId: myId,
            otherUser: selectedUser,
            message: res.data,
          });
          set({ recentConversations: nextCache });
        }
      } catch {
        // ignore cache failures
      }
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Send failed";
      toast.error(msg);
    }
  },
  // =========================
  // 🔥 Forward
  // =========================

  forwardMessage: async (messageId, receiverId) => {
    try {
      await axiosInstance.post("/messages/forward", {
        messageId,
        receiverId,
      });
    } catch (error) {
      console.error("Forward failed:", error);
    }
  },

  // =========================
  // 🔥 RECALL MESSAGE
  // =========================
  recallMessage: async (messageId) => {
    try {
      const res = await axiosInstance.put(`/messages/recall/${messageId}`);

      const updatedMessage = res.data;

      // update ngay UI
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === updatedMessage._id ? updatedMessage : msg,
        ),
      }));
    } catch (error) {
      toast.error(error.response?.data?.message || "Recall failed");
    }
  },

  // =========================
  // 🔥 RECALL MESSAGE (ME)
  // =========================
  recallMessageMe: async (messageId) => {
    try {
      const res = await axiosInstance.put(`/messages/recall-me/${messageId}`);

      const updatedMessage = res.data;

      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === updatedMessage._id ? updatedMessage : msg,
        ),
      }));
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Recall failed";
      toast.error(msg);
    }
  },

  // =========================
  // SOCKET SUBSCRIBE
  // =========================
  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    const TYPING_WINDOW_MS = 10_000;

    // NEW MESSAGE
    socket.off("newMessage");
    socket.on("newMessage", (newMessage) => {
      set((state) => {
        const selected = state.selectedUser;
        const myId = useAuthStore.getState().authUser._id;

        // Update recent conversations cache even if user is not in this chat right now
        try {
          const otherId =
            newMessage.senderId === myId
              ? newMessage.receiverId
              : newMessage.senderId;
          const otherUser =
            state.users.find((u) => String(u._id) === String(otherId)) ||
            (selected && String(selected._id) === String(otherId)
              ? selected
              : null);
          if (otherUser) {
            const nextCache = upsertRecentDmConversation({
              myUserId: myId,
              otherUser,
              message: newMessage,
            });
            // Return state with updated cache; keep other state changes below
            state = { ...state, recentConversations: nextCache };
          }
        } catch {
          // ignore
        }

        // If no chat is selected, we don't append message into messages[] view
        if (!selected?._id) return state;

        const isCurrentConversation =
          (newMessage.senderId === myId &&
            newMessage.receiverId === selected._id) ||
          (newMessage.senderId === selected._id &&
            newMessage.receiverId === myId);

        if (!isCurrentConversation) return state;

        // Once a message arrives, clear "typing" indicator for this chat.
        if (state._typingTimer) clearTimeout(state._typingTimer);
        state = { ...state, isTyping: false, _typingTimer: null };

        const exists = state.messages.some((m) => m._id === newMessage._id);
        if (exists) return state;

        return { ...state, messages: [...state.messages, newMessage] };
      });
    });

    // TYPING
    socket.off("typing");
    socket.on("typing", ({ from } = {}) => {
      set((state) => {
        const selected = state.selectedUser;
        if (!selected?._id) return state;
        if (String(from) !== String(selected._id)) return state;
        if (state._typingTimer) clearTimeout(state._typingTimer);
        const timer = setTimeout(() => {
          set({ isTyping: false, _typingTimer: null });
        }, TYPING_WINDOW_MS);
        return { isTyping: true, _typingTimer: timer };
      });
    });

    socket.off("stopTyping");
    socket.on("stopTyping", ({ from } = {}) => {
      set((state) => {
        const selected = state.selectedUser;
        if (!selected?._id) return state;
        if (String(from) !== String(selected._id)) return state;
        if (state._typingTimer) clearTimeout(state._typingTimer);
        return { isTyping: false, _typingTimer: null };
      });
    });

    // 🔥 MESSAGE RECALL
    socket.on("messageRecalled", (updatedMessage) => {
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === updatedMessage._id ? updatedMessage : msg,
        ),
      }));
    });

    // 🔥 MESSAGE RECALL (ME)
    socket.off("messageRecalledMe");
    socket.on("messageRecalledMe", (updatedMessage) => {
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === updatedMessage._id ? updatedMessage : msg,
        ),
      }));
    });
  },

  // =========================
  // UNSUBSCRIBE
  // =========================
  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
    socket.off("typing");
    socket.off("stopTyping");
    socket.off("messageRecalled"); // 🔥 thêm dòng này
    socket.off("messageRecalledMe");

    const t = get()._typingTimer;
    if (t) clearTimeout(t);
    set({ isTyping: false, _typingTimer: null });
  },

  // =========================
  // SELECT USER
  // =========================
  setSelectedUser: (selectedUser) => {
    const t = get()._typingTimer;
    if (t) clearTimeout(t);
    set({ selectedUser, isTyping: false, _typingTimer: null });
  },
}));

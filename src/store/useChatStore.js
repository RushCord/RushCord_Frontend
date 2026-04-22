import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { uploadFileViaPresign } from "../lib/uploadMedia.js";
import { useAuthStore } from "./useAuthStore";
import { loadRecentConversations } from "../lib/recentConversationsCache.js";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  conversations: [],
  friends: [],
  incomingFriendRequests: [],
  outgoingFriendRequests: [],
  selectedConversation: null, // { conversationId, type, title, otherUserId, ... }
  recentConversations: loadRecentConversations(),
  isTyping: false,
  typingFromUserId: null,
  _typingTimer: null,
  isReacting: false,
  isUsersLoading: false,
  isMessagesLoading: false,
  isConversationsLoading: false,
  isFriendsLoading: false,
  isFriendRequestsLoading: false,

  // =========================
  // FRIENDS
  // =========================
  getFriends: async () => {
    set({ isFriendsLoading: true });
    try {
      const res = await axiosInstance.get("/friends");
      set({ friends: res.data || [] });
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Error";
      toast.error(msg);
    } finally {
      set({ isFriendsLoading: false });
    }
  },

  getFriendRequests: async () => {
    set({ isFriendRequestsLoading: true });
    try {
      const [incomingRes, outgoingRes] = await Promise.all([
        axiosInstance.get("/friends/requests?type=incoming"),
        axiosInstance.get("/friends/requests?type=outgoing"),
      ]);
      set({
        incomingFriendRequests: incomingRes.data || [],
        outgoingFriendRequests: outgoingRes.data || [],
      });
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Error";
      toast.error(msg);
    } finally {
      set({ isFriendRequestsLoading: false });
    }
  },

  sendFriendRequest: async (otherUserId) => {
    try {
      await axiosInstance.post("/friends/requests", { otherUserId });
      toast.success("Friend request sent");
      await get().getFriendRequests();
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Send request failed";
      toast.error(msg);
      throw error;
    }
  },

  acceptFriendRequest: async (otherUserId) => {
    try {
      await axiosInstance.post(`/friends/requests/${otherUserId}/accept`);
      toast.success("Friend request accepted");
      await Promise.all([get().getFriends(), get().getFriendRequests()]);
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Accept failed";
      toast.error(msg);
      throw error;
    }
  },

  deleteFriendRequest: async (otherUserId) => {
    try {
      await axiosInstance.delete(`/friends/requests/${otherUserId}`);
      toast.success("Request removed");
      await get().getFriendRequests();
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Delete failed";
      toast.error(msg);
      throw error;
    }
  },

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
  // GET CONVERSATIONS (inbox)
  // =========================
  getConversations: async () => {
    set({ isConversationsLoading: true });
    try {
      const res = await axiosInstance.get(`/conversations`);
      set({ conversations: res.data || [] });
    } catch (error) {
      toast.error(error.response?.data?.message || "Error");
    } finally {
      set({ isConversationsLoading: false });
    }
  },

  // =========================
  // GET MESSAGES (conversation)
  // =========================
  getMessages: async (conversationId) => {
    set({ isMessagesLoading: true });
    try {
      const { selectedConversation } = get();
      const isDm = selectedConversation?.type === "DM" && selectedConversation?.otherUserId;

      const res = isDm
        ? await axiosInstance.get(
            `/messages/${encodeURIComponent(String(selectedConversation.otherUserId))}`,
          )
        : await axiosInstance.get(
            `/conversations/${encodeURIComponent(String(conversationId || ""))}/messages`,
          );

      set({ messages: res.data || [] });
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Error";
      toast.error(msg);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  // =========================
  // SEND MESSAGE (conversation)
  // =========================
  sendMessage: async ({ text = "", file = null, files = null }) => {
    const { selectedConversation, messages } = get();

    if (!selectedConversation?.conversationId) {
      toast.error("No conversation selected");
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

      const isDm =
        selectedConversation?.type === "DM" && selectedConversation?.otherUserId;

      const res = isDm
        ? await axiosInstance.post(
            `/messages/send/${encodeURIComponent(String(selectedConversation.otherUserId))}`,
            body,
          )
        : await axiosInstance.post(
            `/conversations/${encodeURIComponent(
              String(selectedConversation.conversationId),
            )}/messages`,
            body,
          );

      set({ messages: [...messages, res.data] });

      // Refresh inbox ordering (best effort).
      try {
        await get().getConversations();
      } catch {
        // ignore
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
  // ✏️ EDIT MESSAGE TEXT
  // =========================
  editMessageText: async (messageId, text) => {
    try {
      const res = await axiosInstance.put(`/messages/edit/${messageId}`, { text });
      const updatedMessage = res.data;
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === updatedMessage._id ? updatedMessage : msg,
        ),
      }));
      return updatedMessage;
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Edit failed";
      toast.error(msg);
      throw error;
    }
  },

  // =========================
  // 😀 REACT MESSAGE (toggle)
  // =========================
  reactToMessage: async (messageId, emoji) => {
    if (!messageId) return;
    const e = typeof emoji === "string" ? emoji.trim() : "";
    if (!e) return;
    set({ isReacting: true });
    try {
      const res = await axiosInstance.put(`/messages/react/${messageId}`, {
        emoji: e,
      });
      const updatedMessage = res.data;
      set((state) => ({
        messages: state.messages.map((m) =>
          m._id === updatedMessage._id ? updatedMessage : m,
        ),
      }));
      return updatedMessage;
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "React failed";
      toast.error(msg);
      throw error;
    } finally {
      set({ isReacting: false });
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
        // Update conversation list preview/order (best effort)
        try {
          const cid = String(newMessage.conversationId || "");
          if (cid) {
            const idx = state.conversations.findIndex(
              (c) => String(c.conversationId) === cid,
            );
            if (idx >= 0) {
              const old = state.conversations[idx];
              const updated = {
                ...old,
                lastMessage: newMessage,
                lastMessageAt: newMessage.createdAt,
                lastMessageId: newMessage._id,
              };
              const next = state.conversations.slice();
              next.splice(idx, 1);
              next.unshift(updated);
              state = { ...state, conversations: next };
            }
          }
        } catch {
          // ignore
        }

        // If no chat is selected, we don't append message into messages[] view
        if (!state.selectedConversation?.conversationId) return state;
        if (
          String(newMessage.conversationId || "") !==
          String(state.selectedConversation.conversationId)
        )
          return state;

        // Once a message arrives, clear "typing" indicator for this chat.
        if (state._typingTimer) clearTimeout(state._typingTimer);
        state = {
          ...state,
          isTyping: false,
          typingFromUserId: null,
          _typingTimer: null,
        };

        const exists = state.messages.some((m) => m._id === newMessage._id);
        if (exists) return state;

        return { ...state, messages: [...state.messages, newMessage] };
      });
    });

    // TYPING (conversation rooms)
    socket.off("typingInConversation");
    socket.on("typingInConversation", ({ from, conversationId } = {}) => {
      set((state) => {
        if (!state.selectedConversation?.conversationId) return state;
        if (String(conversationId) !== String(state.selectedConversation.conversationId))
          return state;
        if (String(from) === String(useAuthStore.getState().authUser?._id))
          return state;
        if (state._typingTimer) clearTimeout(state._typingTimer);
        const timer = setTimeout(() => {
          set({ isTyping: false, typingFromUserId: null, _typingTimer: null });
        }, TYPING_WINDOW_MS);
        return { isTyping: true, typingFromUserId: String(from), _typingTimer: timer };
      });
    });

    socket.off("stopTypingInConversation");
    socket.on("stopTypingInConversation", ({ from, conversationId } = {}) => {
      set((state) => {
        if (!state.selectedConversation?.conversationId) return state;
        if (String(conversationId) !== String(state.selectedConversation.conversationId))
          return state;
        if (String(from) === String(useAuthStore.getState().authUser?._id))
          return state;
        if (state._typingTimer) clearTimeout(state._typingTimer);
        return { isTyping: false, typingFromUserId: null, _typingTimer: null };
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

    // ✏️ MESSAGE EDIT
    socket.off("messageEdited");
    socket.on("messageEdited", (updatedMessage) => {
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === updatedMessage._id ? updatedMessage : msg,
        ),
      }));
    });

    // 😀 MESSAGE REACTION UPDATE
    socket.off("messageReactionUpdated");
    socket.on("messageReactionUpdated", (updatedMessage) => {
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
    socket.off("typingInConversation");
    socket.off("stopTypingInConversation");
    socket.off("messageRecalled"); // 🔥 thêm dòng này
    socket.off("messageRecalledMe");
    socket.off("messageEdited");
    socket.off("messageReactionUpdated");

    const t = get()._typingTimer;
    if (t) clearTimeout(t);
    set({ isTyping: false, typingFromUserId: null, _typingTimer: null });
  },

  // =========================
  // SELECT CONVERSATION
  // =========================
  setSelectedConversation: (selectedConversation) => {
    const t = get()._typingTimer;
    if (t) clearTimeout(t);
    set({ selectedConversation, isTyping: false, typingFromUserId: null, _typingTimer: null });

    // Socket room join/leave (best effort)
    try {
      const socket = useAuthStore.getState().socket;
      if (socket && selectedConversation?.conversationId) {
        socket.emit("joinConversation", {
          conversationId: selectedConversation.conversationId,
        });
      }
    } catch {
      // ignore
    }
  },
}));

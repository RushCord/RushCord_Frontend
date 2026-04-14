import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
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
  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();

    if (!selectedUser?._id) {
      toast.error("No user selected");
      return;
    }

    try {
      const isFormData = messageData instanceof FormData;

      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        messageData,
      );

      set({ messages: [...messages, res.data] });
    } catch (error) {
      toast.error(error.response?.data?.message || "Send failed");
    }
  },
  // =========================
  // 🔥 Forward
  // =========================

  forwardMessage: async (messageId, receiverId) => {
    try {
      const res = await axiosInstance.post("/messages/forward", {
        messageId,
        receiverId,
      });

      const newMessage = res.data;

      // 🔥 QUAN TRỌNG: ADD NGAY VÀO UI
      set((state) => ({
        messages: [...state.messages, newMessage],
      }));
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
  // SOCKET SUBSCRIBE
  // =========================
  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;

    // NEW MESSAGE
    socket.on("newMessage", (newMessage) => {
      set((state) => {
        const selectedUser = state.selectedUser;
        const myId = useAuthStore.getState().authUser._id;

        // ✅ luôn add message của mình (forward case)
        if (newMessage.senderId === myId) {
          return {
            messages: [...state.messages, newMessage],
          };
        }

        // ✅ message của người đang chat
        if (
          selectedUser &&
          (newMessage.senderId === selectedUser._id ||
            newMessage.receiverId === selectedUser._id)
        ) {
          return {
            messages: [...state.messages, newMessage],
          };
        }

        return state;
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
  },

  // =========================
  // UNSUBSCRIBE
  // =========================
  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
    socket.off("messageRecalled"); // 🔥 thêm dòng này
  },

  // =========================
  // SELECT USER
  // =========================
  setSelectedUser: (selectedUser) => set({ selectedUser }),
}));

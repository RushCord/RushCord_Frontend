import { create } from "zustand";
import {
  axiosInstance,
  setAuthTokens,
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
} from "../lib/axios.js";
import { useChatStore } from "./useChatStore";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const SOCKET_BASE = (() => {
  const fromEnv = import.meta.env.VITE_SOCKET_URL;
  if (typeof fromEnv === "string" && fromEnv.trim() !== "") {
    return fromEnv.trim().replace(/\/+$/, "");
  }
  return import.meta.env.MODE === "development" ? "http://localhost:3000" : "/";
})();

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isConfirming: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  incomingCall: null,
  socket: null,

  checkAuth: async () => {
    try {
      if (!getAccessToken()) {
        set({ authUser: null });
        return;
      }
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      console.log("Error in checkAuth:", error);
      clearAuthTokens();
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  /** POST /auth/register — returns { userSub, pendingConfirmation } */
  register: async ({ email, password, displayName }) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/register", {
        email,
        password,
        displayName,
      });
      toast.success("Check your email for the verification code");
      return res.data;
    } catch (error) {
      const msg =
        error.response?.data?.message || "Registration failed";
      toast.error(msg);
      throw error;
    } finally {
      set({ isSigningUp: false });
    }
  },

  confirmSignup: async ({ email, otpCode }) => {
    set({ isConfirming: true });
    try {
      await axiosInstance.post("/auth/confirm", { email, otpCode });
      toast.success("Email verified. You can sign in now.");
    } catch (error) {
      const msg =
        error.response?.data?.message || "Verification failed";
      toast.error(msg);
      throw error;
    } finally {
      set({ isConfirming: false });
    }
  },

  resendConfirmation: async ({ email }) => {
    try {
      await axiosInstance.post("/auth/resend-confirmation", { email });
      toast.success("A new code has been sent to your email");
    } catch (error) {
      const msg =
        error.response?.data?.message || "Could not resend code";
      toast.error(msg);
      throw error;
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      const { accessToken, refreshToken } = res.data;
      setAuthTokens(accessToken, refreshToken || "");
      const checkRes = await axiosInstance.get("/auth/check");
      set({ authUser: checkRes.data });
      toast.success("Logged in successfully");
      get().connectSocket();
    } catch (error) {
      const msg = error.response?.data?.message || "Login failed";
      toast.error(msg);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      const access = getAccessToken();
      const refresh = getRefreshToken();
      if (access) {
        await axiosInstance.post(
          "/auth/logout",
          refresh ? { refreshToken: refresh } : {}
        );
      }
    } catch (error) {
      const msg = error.response?.data?.message;
      if (msg) toast.error(msg);
    } finally {
      clearAuthTokens();
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().disconnectSocket();
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("error in update profile:", error);
      const msg = error.response?.data?.message || "Update failed";
      toast.error(msg);
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    const token = getAccessToken();
    if (!authUser || !token) return;
    if (get().socket?.connected) return;
    const old = get().socket;
    if (old) {
      old.disconnect();
      set({ socket: null });
    }

    const socket = io(SOCKET_BASE, {
      auth: { token },
    });
    socket.connect();

    console.log("🔌 Socket connecting (Cognito sub):", authUser._id);

    set({ socket });

    // Subscribe chat events globally so sidebar/cache updates even before opening a chat
    try {
      useChatStore.getState().subscribeToMessages();
    } catch {
      // ignore
    }

    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });

    socket.on("incomingCall", ({ from, roomName, conversationId, kind }) => {
      set({
        incomingCall: {
          from,
          roomName,
          conversationId: conversationId || roomName || null,
          kind: kind || null,
        },
      });
    });

    socket.on("hangup", ({ from, roomName, conversationId, kind }) => {
      const ic = get().incomingCall;
      if (!ic) return;
      const icRoom = String(ic.conversationId || ic.roomName || "");
      const evRoom = String(conversationId || roomName || "");
      const icKind = String(ic.kind || "").toUpperCase();
      const evKind = String(kind || "").toUpperCase();

      // If server didn't send kind, fall back to matching by from only.
      const kindMatches = !evKind || !icKind || icKind === evKind;
      const roomMatches = !evRoom || !icRoom || evRoom === icRoom;
      if (String(ic.from) === String(from) && kindMatches && roomMatches) {
        set({ incomingCall: null });
      }
    });

    socket.on("connect", () => {
      console.log("🔌 Socket connected:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("🔌 Socket disconnected");
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connect_error:", err.message);
    });
  },
  clearIncomingCall: () => set({ incomingCall: null }),
  disconnectSocket: () => {
    const s = get().socket;
    if (s?.connected) s.disconnect();
    set({ incomingCall: null, socket: null });
    try {
      useChatStore.getState().unsubscribeFromMessages();
    } catch {
      // ignore
    }
  },
}));

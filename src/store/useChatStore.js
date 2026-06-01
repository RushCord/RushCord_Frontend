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
  /** Rail trái: 'dms' = sidebar chỉ danh sách 1-1; 'group' = sidebar chỉ kênh nhóm đang chọn */
  sidebarRailMode: "dms",
  /** Panel chính trên Home: 'chat' | 'friends' | 'discover' */
  homeMainView: "chat",
  setHomeMainView: (view) => set({ homeMainView: view }),
  openFriendsView: () => set({ homeMainView: "friends" }),
  channels: [], // GROUP channels from API
  selectedChannel: null, // { channelId, channelType, name } — text channel for messages
  selectedVoiceChannelId: null, // VOICE channel id for group calls
  /** Active group voice session: join by clicking a VOICE channel */
  voiceSession: null, // { conversationId, voiceChannelId, roomName } | null
  voiceMicMuted: false,
  voiceOutputMuted: false,
  voiceVideoEnabled: false,
  voiceScreenShareEnabled: false,
  /** Increment to signal GroupVideoCall to disconnect (sidebar leave button) */
  voiceEndSignal: 0,
  /** LiveKit roomName -> sorted userId[] (sidebar under voice channels) */
  voiceMembersByRoom: {},
  /** GROUP main panel: 'chat' = messages, 'voice' = camera grid */
  groupPanelView: "chat",
  /** Voice channel id currently shown in the main panel */
  viewingVoiceChannelId: null,
  /** True while a 1:1 LiveKit call is active (sidebar mic/headphone controls) */
  dmCallActive: false,
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
  isCreatingGroup: false,
  aiMode: false,
  isAiBusy: false,
  highlightMessageId: null,
  pendingScrollMessageId: null,

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

  removeFriend: async (otherUserId) => {
    try {
      await axiosInstance.delete(`/friends/${otherUserId}`);
      toast.success("Friend removed");
      await Promise.all([get().getFriends(), get().getFriendRequests()]);
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Remove friend failed";
      toast.error(msg);
      throw error;
    }
  },

  // =========================
  // GET USERS
  // =========================
  getUsers: async () => {
    const showLoading = (get().users || []).length === 0;
    if (showLoading) set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Error");
    } finally {
      if (showLoading) set({ isUsersLoading: false });
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

  exploreGroups: async ({ q = "", topic = "", limit = 40 } = {}) => {
    try {
      const res = await axiosInstance.get("/conversations/explore", {
        params: {
          ...(q ? { q } : {}),
          ...(topic ? { topic } : {}),
          limit,
        },
      });
      return Array.isArray(res.data) ? res.data : [];
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Không tải được danh sách nhóm";
      toast.error(msg);
      return [];
    }
  },

  fetchGroupExplorePreview: async (conversationId, { silent = false } = {}) => {
    const cid = String(conversationId || "").trim();
    if (!cid) return null;
    try {
      const res = await axiosInstance.get(
        `/conversations/explore/${encodeURIComponent(cid)}/preview`,
      );
      return res.data;
    } catch (error) {
      if (!silent) {
        const msg =
          error.response?.data?.error ||
          error.response?.data?.message ||
          "Không tải được thông tin nhóm";
        toast.error(msg);
      }
      return null;
    }
  },

  fetchInvitePreview: async (code, { silent = false } = {}) => {
    const c = String(code || "").trim();
    if (!c) return null;
    try {
      const res = await axiosInstance.get(
        `/invites/${encodeURIComponent(c)}/preview`,
      );
      return res.data;
    } catch (error) {
      if (!silent) {
        const msg =
          error.response?.data?.error ||
          error.response?.data?.message ||
          "Không tải được lời mời";
        toast.error(msg);
      }
      return null;
    }
  },

  acceptInvite: async (code) => {
    const c = String(code || "").trim();
    if (!c) return null;
    try {
      const res = await axiosInstance.post(
        `/invites/${encodeURIComponent(c)}/join`,
      );
      const data = res.data;
      const cid = String(data.conversationId || "");
      await get().getConversations();
      const conv = (get().conversations || []).find(
        (x) => String(x.conversationId) === cid,
      );
      const conversation = conv || {
        conversationId: cid,
        type: "GROUP",
        title: data.title,
        topic: data.topic || "",
        description: data.description || "",
        avatar: data.avatar || "",
        cover: data.cover || "",
        joinPolicy: data.joinPolicy || "OPEN",
      };
      get().setSelectedConversation(conversation);
      toast.success(
        data.alreadyMember ? "Bạn đã là thành viên nhóm" : "Đã tham gia nhóm",
      );
      return conversation;
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Tham gia nhóm thất bại";
      toast.error(msg);
      return null;
    }
  },

  listGroupInvites: async (conversationId) => {
    const cid = String(conversationId || "");
    if (!cid.startsWith("GROUP#")) return [];
    try {
      const res = await axiosInstance.get(
        `/conversations/${encodeURIComponent(cid)}/invites`,
      );
      return Array.isArray(res.data) ? res.data : [];
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Không tải được lời mời";
      toast.error(msg);
      return [];
    }
  },

  createGroupInvite: async (
    conversationId,
    { expiresInHours, expiresAt, maxUses } = {},
  ) => {
    const cid = String(conversationId || "");
    if (!cid.startsWith("GROUP#")) return null;
    try {
      const res = await axiosInstance.post(
        `/conversations/${encodeURIComponent(cid)}/invites`,
        {
          ...(expiresInHours != null ? { expiresInHours } : {}),
          ...(expiresAt != null && expiresAt !== ""
            ? { expiresAt }
            : {}),
          ...(maxUses != null && maxUses !== "" ? { maxUses } : {}),
        },
      );
      toast.success("Đã tạo lời mời");
      return res.data;
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Tạo lời mời thất bại";
      toast.error(msg);
      return null;
    }
  },

  revokeGroupInvite: async (conversationId, inviteId) => {
    const cid = String(conversationId || "");
    const iid = String(inviteId || "");
    if (!cid.startsWith("GROUP#") || !iid) return false;
    try {
      await axiosInstance.delete(
        `/conversations/${encodeURIComponent(cid)}/invites/${encodeURIComponent(iid)}`,
      );
      toast.success("Đã thu hồi lời mời");
      return true;
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Thu hồi lời mời thất bại";
      toast.error(msg);
      return false;
    }
  },

  updateGroupJoinPolicy: async (conversationId, joinPolicy) => {
    const cid = String(conversationId || "");
    if (!cid.startsWith("GROUP#")) return null;
    try {
      const res = await axiosInstance.patch(
        `/conversations/${encodeURIComponent(cid)}`,
        { joinPolicy },
      );
      await get().getConversations();
      const selected = get().selectedConversation;
      if (selected && String(selected.conversationId) === cid) {
        get().setSelectedConversation({
          ...selected,
          joinPolicy: res.data.joinPolicy || joinPolicy,
        });
      }
      toast.success("Đã cập nhật chế độ tham gia");
      return res.data;
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Cập nhật thất bại";
      toast.error(msg);
      return null;
    }
  },

  joinGroupConversation: async (conversationId) => {
    const cid = String(conversationId || "");
    if (!cid.startsWith("GROUP#")) return null;
    try {
      await axiosInstance.post(
        `/conversations/${encodeURIComponent(cid)}/join`,
      );
      await get().getConversations();
      const conv = (get().conversations || []).find(
        (c) => String(c.conversationId) === cid,
      );
      const conversation = conv || {
        conversationId: cid,
        type: "GROUP",
      };
      get().setSelectedConversation(conversation);
      toast.success("Đã tham gia nhóm");
      return conversation;
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Tham gia nhóm thất bại";
      toast.error(msg);
      return null;
    }
  },

  createGroupConversation: async ({
    title,
    memberIds,
    topic,
    description,
    avatar,
    cover,
  }) => {
    set({ isCreatingGroup: true });
    try {
      const res = await axiosInstance.post("/conversations", {
        title,
        memberIds,
        topic,
        description,
        ...(avatar ? { avatar } : {}),
        ...(cover ? { cover } : {}),
      });
      await get().getConversations();
      const conversation = {
        conversationId: res.data.conversationId,
        type: res.data.type || "GROUP",
        title: res.data.title,
        topic: res.data.topic || "",
        description: res.data.description || "",
        avatar: res.data.avatar || "",
        cover: res.data.cover || "",
      };
      get().setSelectedConversation(conversation);
      toast.success("Đã tạo nhóm");
      return conversation;
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Tạo nhóm thất bại";
      toast.error(msg);
      return null;
    } finally {
      set({ isCreatingGroup: false });
    }
  },

  getChannels: async (conversationId) => {
    const cid = String(conversationId || "");
    if (!cid.startsWith("GROUP#")) {
      set({
        channels: [],
        selectedChannel: null,
        selectedVoiceChannelId: null,
        voiceSession: null,
      });
      return;
    }
    try {
      const res = await axiosInstance.get(
        `/conversations/${encodeURIComponent(cid)}/channels`,
      );
      const channels = Array.isArray(res.data) ? res.data : [];
      set({ channels });
      const firstVoice = channels.find((c) => c.channelType === "VOICE");
      set((s) => ({
        selectedVoiceChannelId: s.selectedVoiceChannelId || firstVoice?.channelId || null,
      }));
      get().requestVoicePresence(cid);
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Error";
      toast.error(msg);
      set({ channels: [] });
    }
  },

  setSelectedChannel: (ch) => {
    set({ selectedChannel: ch, groupPanelView: "chat" });
  },

  showVoicePanel: (voiceChannelId) => {
    const vid = String(voiceChannelId || "").trim();
    if (!vid) return;
    set({
      groupPanelView: "voice",
      viewingVoiceChannelId: vid,
      selectedVoiceChannelId: vid,
    });
  },

  setSelectedVoiceChannelId: (id) => {
    set({ selectedVoiceChannelId: id ? String(id) : null });
  },

  joinVoiceChannel: (conversationId, voiceChannelId) => {
    const cid = String(conversationId || "").trim();
    const vid = String(voiceChannelId || "").trim();
    if (!cid.startsWith("GROUP#") || !vid) return;
    const roomName = `${cid}#VOICE#${vid}`;

    const prev = get().voiceSession;
    const socket = useAuthStore.getState().socket;
    if (
      socket &&
      prev &&
      (String(prev.conversationId) !== cid ||
        String(prev.voiceChannelId) !== vid)
    ) {
      socket.emit("voiceChannelLeave", {
        conversationId: prev.conversationId,
        voiceChannelId: prev.voiceChannelId,
        roomName: prev.roomName,
      });
    }

    set({
      selectedVoiceChannelId: vid,
      groupPanelView: "voice",
      viewingVoiceChannelId: vid,
      voiceSession: { conversationId: cid, voiceChannelId: vid, roomName },
      voiceMicMuted: false,
      voiceOutputMuted: false,
      voiceVideoEnabled: false,
      voiceScreenShareEnabled: false,
    });

    if (socket) {
      socket.emit("voiceChannelJoin", {
        conversationId: cid,
        voiceChannelId: vid,
        roomName,
      });
    }
  },

  leaveVoiceChannel: () => {
    const session = get().voiceSession;
    const socket = useAuthStore.getState().socket;
    if (socket && session) {
      socket.emit("voiceChannelLeave", {
        conversationId: session.conversationId,
        voiceChannelId: session.voiceChannelId,
        roomName: session.roomName,
      });
    }
    set({
      voiceSession: null,
      voiceMicMuted: false,
      voiceOutputMuted: false,
      voiceVideoEnabled: false,
      voiceScreenShareEnabled: false,
      voiceEndSignal: 0,
      groupPanelView: "chat",
      viewingVoiceChannelId: null,
    });
  },

  setVoiceChannelPresence: ({ roomName, members }) => {
    const rn = String(roomName || "").trim();
    if (!rn) return;
    const list = Array.isArray(members)
      ? [...new Set(members.map((id) => String(id)).filter(Boolean))].sort()
      : [];
    set((s) => ({
      voiceMembersByRoom: { ...s.voiceMembersByRoom, [rn]: list },
    }));
  },

  setVoicePresenceSnapshot: ({ conversationId, rooms }) => {
    const cid = String(conversationId || "").trim();
    if (!cid.startsWith("GROUP#")) return;
    const prefix = `${cid}#VOICE#`;
    set((s) => {
      const next = { ...s.voiceMembersByRoom };
      for (const key of Object.keys(next)) {
        if (key.startsWith(prefix)) delete next[key];
      }
      const map = rooms && typeof rooms === "object" ? rooms : {};
      for (const [roomName, members] of Object.entries(map)) {
        const rn = String(roomName || "").trim();
        if (!rn.startsWith(prefix)) continue;
        next[rn] = Array.isArray(members)
          ? [...new Set(members.map((id) => String(id)).filter(Boolean))].sort()
          : [];
      }
      return { voiceMembersByRoom: next };
    });
  },

  requestVoicePresence: (conversationId) => {
    const cid = String(conversationId || "").trim();
    if (!cid.startsWith("GROUP#")) return;
    const socket = useAuthStore.getState().socket;
    if (socket) socket.emit("requestVoicePresence", { conversationId: cid });
  },

  toggleVoiceMic: () => {
    set((s) => ({ voiceMicMuted: !s.voiceMicMuted }));
  },

  toggleVoiceOutput: () => {
    set((s) => ({ voiceOutputMuted: !s.voiceOutputMuted }));
  },

  toggleVoiceVideo: () => {
    set((s) => ({ voiceVideoEnabled: !s.voiceVideoEnabled }));
  },

  toggleVoiceScreenShare: () => {
    set((s) => ({ voiceScreenShareEnabled: !s.voiceScreenShareEnabled }));
  },

  setVoiceScreenShareEnabled: (enabled) => {
    set({ voiceScreenShareEnabled: Boolean(enabled) });
  },

  requestLeaveVoice: () => {
    set((s) => ({ voiceEndSignal: (s.voiceEndSignal || 0) + 1 }));
  },

  setDmCallActive: (active) => {
    set({
      dmCallActive: Boolean(active),
      ...(!active ? { voiceMicMuted: false, voiceOutputMuted: false } : {}),
    });
  },

  openGroupAtChannel: async (conversation, channel) => {
    const cid = conversation?.conversationId;
    if (!cid || !String(cid).startsWith("GROUP#") || !channel?.channelId) return;
    get().setSelectedConversation(conversation);
    await get().getChannels(cid);
    const ch = get().channels.find(
      (c) => String(c.channelId) === String(channel.channelId),
    );
    if (!ch) return;
    if (ch.channelType === "VOICE") {
      get().joinVoiceChannel(cid, ch.channelId);
    } else {
      get().setSelectedChannel(ch);
    }
  },

  createChannel: async ({ channelType, name }) => {
    const { selectedConversation } = get();
    const cid = selectedConversation?.conversationId;
    if (!cid || !String(cid).startsWith("GROUP#")) return false;
    try {
      await axiosInstance.post(`/conversations/${encodeURIComponent(cid)}/channels`, {
        channelType,
        name,
      });
      toast.success("Đã tạo kênh");
      await get().getChannels(cid);
      return true;
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Tạo kênh thất bại";
      toast.error(msg);
      return false;
    }
  },

  updateChannelName: async ({ channelId, name }) => {
    const { selectedConversation } = get();
    const cid = selectedConversation?.conversationId;
    if (!cid) return false;
    const trimmed = String(name || "").trim();
    if (!trimmed) return false;
    try {
      await axiosInstance.patch(
        `/conversations/${encodeURIComponent(cid)}/channels/${encodeURIComponent(channelId)}`,
        { name: trimmed },
      );
      toast.success("Đã đổi tên kênh");
      set((s) => {
        const id = String(channelId);
        const nextChannels = (s.channels || []).map((c) =>
          String(c.channelId) === id ? { ...c, name: trimmed } : c,
        );
        const nextSelected =
          s.selectedChannel && String(s.selectedChannel.channelId) === id
            ? { ...s.selectedChannel, name: trimmed }
            : s.selectedChannel;
        return { channels: nextChannels, selectedChannel: nextSelected };
      });
      await get().getChannels(cid);
      return true;
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Cập nhật thất bại";
      toast.error(msg);
      return false;
    }
  },

  deleteChannel: async (channelId) => {
    const { selectedConversation } = get();
    const cid = selectedConversation?.conversationId;
    if (!cid) return false;
    const deletedId = String(channelId);
    const prev = get();
    try {
      await axiosInstance.delete(
        `/conversations/${encodeURIComponent(cid)}/channels/${encodeURIComponent(channelId)}`,
      );
      toast.success("Đã xóa kênh");
      if (String(prev.voiceSession?.voiceChannelId) === deletedId) {
        get().leaveVoiceChannel();
      }
      await get().getChannels(cid);
      const channels = get().channels || [];
      const updates = {};
      if (
        prev.selectedChannel &&
        String(prev.selectedChannel.channelId) === deletedId
      ) {
        const type = prev.selectedChannel.channelType;
        const sameType = channels.filter((c) => c.channelType === type);
        updates.selectedChannel =
          sameType[0] || channels.find((c) => c.channelType === "CHAT") || null;
        updates.messages = [];
      }
      if (String(prev.selectedVoiceChannelId) === deletedId) {
        const firstVoice = channels.find((c) => c.channelType === "VOICE");
        updates.selectedVoiceChannelId = firstVoice?.channelId || null;
      }
      if (
        String(prev.viewingVoiceChannelId) === deletedId &&
        !prev.voiceSession
      ) {
        const firstVoice = channels.find((c) => c.channelType === "VOICE");
        if (prev.groupPanelView === "voice") {
          if (firstVoice) {
            updates.viewingVoiceChannelId = firstVoice.channelId;
            updates.selectedVoiceChannelId = firstVoice.channelId;
          } else {
            updates.viewingVoiceChannelId = null;
            updates.groupPanelView = "chat";
          }
        } else {
          updates.viewingVoiceChannelId = null;
        }
      }
      if (Object.keys(updates).length > 0) set(updates);
      return true;
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Xóa kênh thất bại";
      toast.error(msg);
      return false;
    }
  },

  clearMessageSearchHighlight: () => {
    set({ highlightMessageId: null, pendingScrollMessageId: null });
  },

  searchMessages: async (conversationId, query) => {
    const q = String(query || "").trim();
    if (q.length < 2) return [];
    try {
      const res = await axiosInstance.get(
        `/conversations/${encodeURIComponent(String(conversationId || ""))}/messages/search`,
        { params: { q, limit: 30 } },
      );
      return Array.isArray(res.data) ? res.data : [];
    } catch (error) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Tìm kiếm thất bại";
      toast.error(msg);
      return [];
    }
  },

  jumpToMessage: async ({ messageId, channelId }) => {
    const mid = String(messageId || "").trim();
    const { selectedConversation, selectedChannel } = get();
    if (!mid || !selectedConversation?.conversationId) return;

    const cid = selectedConversation.conversationId;
    const isGroup = selectedConversation.type === "GROUP";

    if (isGroup && channelId) {
      const chId = String(channelId);
      const currentCh = String(selectedChannel?.channelId || "");
      if (chId !== currentCh) {
        let ch = (get().channels || []).find((c) => String(c.channelId) === chId);
        if (!ch) {
          await get().getChannels(cid);
          ch = (get().channels || []).find((c) => String(c.channelId) === chId);
        }
        if (!ch) {
          toast.error("Không tìm thấy kênh");
          return;
        }
        if (ch.channelType === "VOICE") {
          toast.error("Không thể mở tin nhắn trong kênh thoại");
          return;
        }
        get().setSelectedChannel(ch);
      }
    }

    set({
      pendingScrollMessageId: mid,
      highlightMessageId: mid,
    });

    await get().getMessages(cid);
  },

  // =========================
  // GET MESSAGES (conversation)
  // =========================
  getMessages: async (conversationId) => {
    set({ isMessagesLoading: true });
    try {
      const { selectedConversation, selectedChannel } = get();
      const isDm = selectedConversation?.type === "DM" && selectedConversation?.otherUserId;

      const res = isDm
        ? await axiosInstance.get(
            `/messages/${encodeURIComponent(String(selectedConversation.otherUserId))}`,
          )
        : await axiosInstance.get(
            `/conversations/${encodeURIComponent(String(conversationId || ""))}/channels/${encodeURIComponent(
              String(selectedChannel?.channelId || ""),
            )}/messages`,
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
    const { selectedConversation, messages, selectedChannel } = get();

    if (!selectedConversation?.conversationId) {
      toast.error("No conversation selected");
      return;
    }

    if (
      selectedConversation.type === "GROUP" &&
      (!selectedChannel?.channelId || selectedChannel.channelType === "VOICE")
    ) {
      toast.error("Chọn kênh chat hoặc kênh thông tin để nhắn tin");
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
            )}/channels/${encodeURIComponent(String(selectedChannel?.channelId || ""))}/messages`,
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

  setAiMode: (value) => {
    set({ aiMode: Boolean(value) });
  },

  aiChatInConversation: async (promptText) => {
    const prompt = String(promptText || "").trim();
    if (!prompt) return;

    const { messages, users, selectedConversation } = get();
    const { authUser } = useAuthStore.getState();

    // Take last 20 non-system messages as context (best-effort).
    const context = (Array.isArray(messages) ? messages : [])
      .filter((m) => m && !m.isSystem && !m.isDeletedForMe && !m.isRecalled)
      .slice(-20)
      .map((m) => {
        const senderId = String(m.senderId || "");
        const senderName =
          senderId === String(authUser?._id || "")
            ? "Bạn"
            : users.find((u) => String(u._id) === senderId)?.fullName || senderId || "Người dùng";
        const content = String(m.text || "").trim();
        return {
          role: "user",
          content: content ? `${senderName}: ${content}` : `${senderName}: (đính kèm)`,
        };
      });

    const now = Date.now();
    const userLocalMessage = {
      _id: `ai-user-${now}`,
      senderId: authUser?._id || "me",
      text: `@RushCord ${prompt}`,
      createdAt: new Date(now).toISOString(),
      conversationId: selectedConversation?.conversationId,
    };
    set({ messages: [...messages, userLocalMessage], isAiBusy: true });

    try {
      const payload = { messages: [...context, { role: "user", content: prompt }] };
      const res = await axiosInstance.post("/ai/chat", payload);
      const reply = String(res?.data?.reply || "").trim();

      const botLocalMessage = {
        _id: `ai-bot-${now + 1}`,
        senderId: "RushCordAI",
        text: reply || "(AI không trả lời)",
        createdAt: new Date(now + 1).toISOString(),
        conversationId: selectedConversation?.conversationId,
      };
      set((s) => ({ messages: [...(s.messages || []), botLocalMessage] }));
    } catch (error) {
      // Useful debugging for browser "Network Error" cases (CORS/blocked/timeout).
      // eslint-disable-next-line no-console
      console.error("[RushCordAI] /v1/chat failed", {
        message: error?.message,
        code: error?.code,
        status: error?.response?.status,
        data: error?.response?.data,
      });
      const msg =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "Gọi RushCordAI thất bại";
      toast.error(msg);
    } finally {
      set({ isAiBusy: false });
    }
  },

  aiSummarizeLast20: async () => {
    const { messages, users, selectedConversation } = get();
    const { authUser } = useAuthStore.getState();

    const last20 = (Array.isArray(messages) ? messages : [])
      .filter((m) => m && !m.isSystem && !m.isDeletedForMe && !m.isRecalled)
      .slice(-20);

    if (last20.length === 0) {
      toast.error("Chưa có tin nhắn để tóm tắt");
      return;
    }

    const payload = {
      messages: last20.map((m) => {
        const senderId = String(m.senderId || "");
        const senderName =
          senderId === String(authUser?._id || "")
            ? "Bạn"
            : users.find((u) => String(u._id) === senderId)?.fullName || senderId || "Người dùng";
        const content = String(m.text || "").trim();
        return {
          role: "user",
          content: content ? `${senderName}: ${content}` : `${senderName}: (đính kèm)`,
        };
      }),
    };

    const now = Date.now();
    set({ isAiBusy: true });
    try {
      const res = await axiosInstance.post("/ai/summarize", payload);
      const summary = String(res?.data?.summary || "").trim();
      const botLocalMessage = {
        _id: `ai-summary-${now}`,
        senderId: "RushCordAI",
        text: summary ? `Tóm tắt 20 tin nhắn mới nhất:\n${summary}` : "(Không có tóm tắt)",
        createdAt: new Date(now).toISOString(),
        conversationId: selectedConversation?.conversationId,
      };
      set((s) => ({ messages: [...(s.messages || []), botLocalMessage] }));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[RushCordAI] /v1/summarize failed", {
        message: error?.message,
        code: error?.code,
        status: error?.response?.status,
        data: error?.response?.data,
      });
      const msg =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "Tóm tắt thất bại";
      toast.error(msg);
    } finally {
      set({ isAiBusy: false });
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

        if (state.selectedConversation.type === "GROUP") {
          const activeCh = state.selectedChannel?.channelId;
          if (
            activeCh &&
            String(newMessage.channelId || "") !== String(activeCh)
          ) {
            return state;
          }
        }

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

    socket.off("voiceChannelPresence");
    socket.on("voiceChannelPresence", ({ roomName, members } = {}) => {
      get().setVoiceChannelPresence({ roomName, members });
    });

    socket.off("voicePresenceSnapshot");
    socket.on("voicePresenceSnapshot", ({ conversationId, rooms } = {}) => {
      get().setVoicePresenceSnapshot({ conversationId, rooms });
    });

    // TYPING (conversation rooms)
    socket.off("typingInConversation");
    socket.on("typingInConversation", ({ from, conversationId, channelId } = {}) => {
      set((state) => {
        if (!state.selectedConversation?.conversationId) return state;
        if (String(conversationId) !== String(state.selectedConversation.conversationId))
          return state;
        if (state.selectedConversation.type === "GROUP") {
          const ac = state.selectedChannel?.channelId;
          if (ac && String(channelId || "") !== String(ac)) return state;
        }
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
    socket.on("stopTypingInConversation", ({ from, conversationId, channelId } = {}) => {
      set((state) => {
        if (!state.selectedConversation?.conversationId) return state;
        if (String(conversationId) !== String(state.selectedConversation.conversationId))
          return state;
        if (state.selectedConversation.type === "GROUP") {
          const ac = state.selectedChannel?.channelId;
          if (ac && String(channelId || "") !== String(ac)) return state;
        }
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
    const prev = get().selectedConversation;
    const prevChannel = get().selectedChannel;
    const t = get()._typingTimer;
    if (t) clearTimeout(t);

    const convChanged =
      String(prev?.conversationId) !== String(selectedConversation?.conversationId);

    const socket = useAuthStore.getState().socket;
    if (convChanged) {
      try {
        if (socket && prev?.conversationId) {
          if (
            prevChannel?.channelId &&
            String(prev.conversationId || "").startsWith("GROUP#")
          ) {
            socket.emit("leaveConversationChannel", {
              conversationId: prev.conversationId,
              channelId: prevChannel.channelId,
            });
          }
          socket.emit("leaveConversation", { conversationId: prev.conversationId });
        }
      } catch {
        // ignore
      }
    }

    const nextRailMode =
      selectedConversation?.type === "GROUP" ? "group" : "dms";

    set({
      selectedConversation,
      sidebarRailMode: nextRailMode,
      ...(selectedConversation ? { homeMainView: "chat" } : {}),
      ...(convChanged
        ? {
            channels: [],
            selectedChannel: null,
            selectedVoiceChannelId: null,
            voiceSession: null,
            voiceMicMuted: false,
            voiceOutputMuted: false,
            voiceVideoEnabled: false,
            voiceScreenShareEnabled: false,
            voiceEndSignal: 0,
            groupPanelView: "chat",
            viewingVoiceChannelId: null,
            messages: [],
          }
        : {}),
      isTyping: false,
      typingFromUserId: null,
      _typingTimer: null,
    });

    if (convChanged) {
      try {
        if (socket && selectedConversation?.conversationId) {
          socket.emit("joinConversation", {
            conversationId: selectedConversation.conversationId,
          });
        }
      } catch {
        // ignore
      }
    } else if (
      selectedConversation?.type === "GROUP" &&
      selectedConversation?.conversationId
    ) {
      get().requestVoicePresence(selectedConversation.conversationId);
    }
  },
}));

import { useEffect, useMemo, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import {
  Compass,
  Hash,
  Plus,
  Search,
  Users,
  Volume2,
} from "lucide-react";
import FindConversationModal from "./FindConversationModal";
import ChannelNameModal from "./ChannelNameModal";
import NavigationItem from "./NavigationItem";
import { axiosInstance } from "../lib/axios";
import { formatMessageTime, getLastMessagePreviewBody } from "../lib/utils";

const SideBar = () => {
  const {
    getUsers,
    users,
    getConversations,
    conversations,
    getFriends,
    selectedConversation,
    setSelectedConversation,
    sidebarRailMode,
    homeMainView,
    openFriendsView,
    setHomeMainView,
    channels,
    selectedChannel,
    voiceSession,
    voiceMembersByRoom,
    groupPanelView,
    viewingVoiceChannelId,
    setSelectedChannel,
    joinVoiceChannel,
    showVoicePanel,
    requestLeaveVoice,
    createChannel,
    updateChannelName,
    deleteChannel,
    getChannels,
    isUsersLoading,
  } = useChatStore();

  const { onlineUsers, authUser } = useAuthStore();
  const [infoOpen, setInfoOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [voiceOpen, setVoiceOpen] = useState(true);
  const [recentChannelsOpen, setRecentChannelsOpen] = useState(true);
  const [showFindConversation, setShowFindConversation] = useState(false);
  const [myGroupRole, setMyGroupRole] = useState(null);
  const [channelNameModal, setChannelNameModal] = useState(null);
  const [channelMenu, setChannelMenu] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isChannelActionLoading, setIsChannelActionLoading] = useState(false);

  useEffect(() => {
    getUsers();
    getConversations();
    getFriends();
  }, [getUsers, getConversations, getFriends]);

  useEffect(() => {
    const cid = selectedConversation?.conversationId;
    if (!cid || selectedConversation?.type !== "GROUP" || !authUser?._id) {
      setMyGroupRole(null);
      return;
    }
    let cancelled = false;
    axiosInstance
      .get(`/conversations/${encodeURIComponent(cid)}/members`)
      .then((res) => {
        if (cancelled) return;
        const me = (res.data || []).find(
          (m) => String(m.userId) === String(authUser._id),
        );
        setMyGroupRole(me?.role || "MEMBER");
      })
      .catch(() => {
        if (!cancelled) setMyGroupRole(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedConversation?.conversationId, selectedConversation?.type, authUser?._id]);

  useEffect(() => {
    const cid = selectedConversation?.conversationId;
    if (cid && selectedConversation?.type === "GROUP") {
      getChannels(cid);
    }
  }, [selectedConversation?.conversationId, selectedConversation?.type, getChannels]);

  const sortedConversations = useMemo(() => {
    const items = Array.isArray(conversations) ? conversations : [];
    return items
      .slice()
      .sort((a, b) => {
        const ta = String(a?.lastMessageAt || a?.lastMessage?.createdAt || "");
        const tb = String(b?.lastMessageAt || b?.lastMessage?.createdAt || "");
        return tb.localeCompare(ta);
      });
  }, [conversations]);

  const recentDms = useMemo(
    () => sortedConversations.filter((c) => c?.type === "DM").slice(0, 10),
    [sortedConversations],
  );

  const renderRecentRow = (c) => {
    const isSelected =
      String(selectedConversation?.conversationId) === String(c.conversationId);
    const isGroup = c?.type === "GROUP";
    const other = !isGroup
      ? users.find((u) => String(u._id) === String(c.otherUserId))
      : null;
    const title = isGroup ? c?.title || "Group" : other?.fullName || "Direct message";
    const avatar = isGroup
      ? c?.avatar || "/avatar.png"
      : other?.profilePic || "/avatar.png";

    const last = c.lastMessage;
    const previewBody = getLastMessagePreviewBody(last);

    const previewText = (() => {
      if (!previewBody) return "";
      const sid = String(last?.senderId || "");
      const me = String(authUser?._id || "");
      const senderName =
        sid && me && sid === me
          ? "Bạn"
          : users.find((u) => String(u._id) === sid)?.fullName || "Ai đó";
      return `${senderName}: ${previewBody}`;
    })();

    const timeRaw = c?.lastMessageAt || c?.lastMessage?.createdAt || "";
    const timeLabel = timeRaw ? formatMessageTime(timeRaw) : "";

    return (
      <button
        key={`recent_${c.conversationId}`}
        type="button"
        onClick={() => setSelectedConversation(c)}
        title={title}
        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition ${
          isSelected
            ? "bg-(--discord-active) text-white"
            : "text-(--discord-text-muted) hover:bg-(--discord-hover) hover:text-(--discord-text)"
        }`}
      >
        <div className="relative shrink-0">
          <img
            src={avatar}
            alt={title}
            className="size-9 rounded-full object-cover ring-1 ring-(--discord-border)"
          />
          {!isGroup && other && onlineUsers.includes(String(other._id)) ? (
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-(--discord-sidebar) bg-emerald-500" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-medium">{title}</span>
            {timeLabel ? (
              <span
                className={`ml-auto shrink-0 text-[11px] tabular-nums ${
                  isSelected ? "text-white/70" : "text-(--discord-text-muted)"
                }`}
              >
                {timeLabel}
              </span>
            ) : null}
          </div>
          <div
            className={`truncate text-xs ${
              isSelected ? "text-white/75" : "text-(--discord-text-muted)"
            }`}
          >
            {previewText || (isGroup ? "Nhóm" : "Tin nhắn trực tiếp")}
          </div>
        </div>
      </button>
    );
  };

  const showGroupChannels =
    sidebarRailMode === "group" && selectedConversation?.type === "GROUP";
  const showDmListOnly = sidebarRailMode === "dms";

  const canManageChannels =
    myGroupRole === "OWNER" || myGroupRole === "ADMIN";

  const infoChannels = useMemo(
    () => channels.filter((c) => c.channelType === "INFO"),
    [channels],
  );
  const chatChannels = useMemo(
    () => channels.filter((c) => c.channelType === "CHAT"),
    [channels],
  );
  const voiceChannels = useMemo(
    () => channels.filter((c) => c.channelType === "VOICE"),
    [channels],
  );

  useEffect(() => {
    if (!channelMenu) return;
    const close = (e) => {
      if (e.target?.closest?.("[data-channel-menu]")) return;
      setChannelMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [channelMenu]);

  const openCreateModal = (channelType) => {
    setChannelNameModal({
      mode: "create",
      channelType,
      channelId: null,
      initialName: "",
    });
  };

  const openChannelContextMenu = (e, ch) => {
    if (!canManageChannels) return;
    e.preventDefault();
    e.stopPropagation();
    setChannelMenu({
      channelId: ch.channelId,
      channelType: ch.channelType,
      name: ch.name,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleChannelNameSubmit = async (name) => {
    if (!channelNameModal) return;
    setIsChannelActionLoading(true);
    try {
      let ok = false;
      if (channelNameModal.mode === "create") {
        ok = await createChannel({
          channelType: channelNameModal.channelType,
          name,
        });
      } else if (channelNameModal.channelId) {
        ok = await updateChannelName({
          channelId: channelNameModal.channelId,
          name,
        });
      }
      if (ok) setChannelNameModal(null);
    } finally {
      setIsChannelActionLoading(false);
    }
  };

  const handleConfirmDeleteChannel = async () => {
    if (!deleteTarget?.channelId) return;
    setIsChannelActionLoading(true);
    try {
      const ok = await deleteChannel(deleteTarget.channelId);
      if (ok) setDeleteTarget(null);
    } finally {
      setIsChannelActionLoading(false);
    }
  };

  const modals = (
    <>
      <FindConversationModal
        open={showFindConversation}
        onClose={() => setShowFindConversation(false)}
      />
      <ChannelNameModal
        open={Boolean(channelNameModal)}
        onClose={() => {
          if (!isChannelActionLoading) setChannelNameModal(null);
        }}
        mode={channelNameModal?.mode || "create"}
        channelType={channelNameModal?.channelType || "CHAT"}
        initialName={channelNameModal?.initialName || ""}
        onSubmit={handleChannelNameSubmit}
        isSubmitting={isChannelActionLoading}
      />
      {deleteTarget ? (
        <div
          className="discord-modal-scrim fixed inset-0 z-[2200] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isChannelActionLoading) {
              setDeleteTarget(null);
            }
          }}
          role="presentation"
        >
          <div
            className="discord-modal-card w-full max-w-md p-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="mb-2 text-lg font-semibold">Xóa kênh</h3>
            <p className="mb-1 text-sm text-(--discord-text-muted)">
              Xóa kênh «{deleteTarget.name}»? Toàn bộ tin nhắn trong kênh sẽ bị xóa
              vĩnh viễn.
            </p>
            <p className="mb-4 text-xs text-(--discord-text-muted)">
              Mỗi loại kênh phải giữ lại ít nhất một kênh (thông tin, chat, thoại).
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-4 py-2 text-sm text-(--discord-text-muted) hover:bg-white/5 disabled:opacity-40"
                disabled={isChannelActionLoading}
                onClick={() => setDeleteTarget(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="rounded-md bg-error px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={isChannelActionLoading}
                onClick={handleConfirmDeleteChannel}
              >
                {isChannelActionLoading ? "Đang xóa..." : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {channelMenu ? (
        <div
          className="fixed z-[2120]"
          style={{ left: channelMenu.x, top: channelMenu.y }}
          data-channel-menu
        >
          <div className="w-40 overflow-hidden rounded-lg border border-white/10 bg-(--discord-panel) shadow-xl">
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-white/5"
              onClick={() => {
                setChannelNameModal({
                  mode: "edit",
                  channelType: channelMenu.channelType,
                  channelId: channelMenu.channelId,
                  initialName: channelMenu.name,
                });
                setChannelMenu(null);
              }}
            >
              Chỉnh sửa
            </button>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm text-error hover:bg-white/5"
              onClick={() => {
                setDeleteTarget({
                  channelId: channelMenu.channelId,
                  name: channelMenu.name,
                  channelType: channelMenu.channelType,
                });
                setChannelMenu(null);
              }}
            >
              Xóa
            </button>
          </div>
        </div>
      ) : null}
    </>
  );

  if (isUsersLoading) {
    return (
      <>
        <SidebarSkeleton />
        {modals}
      </>
    );
  }

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-(--discord-sidebar) text-(--discord-text)">
      {showDmListOnly ? (
        <div className="section-aside border-b border-(--discord-border) px-2 py-2">
          <nav className="space-y-0.5">
            <NavigationItem
              label="Find a conversation"
              icon={Search}
              onClick={() => setShowFindConversation(true)}
            />
            <NavigationItem
              label="Friends"
              icon={Users}
              active={homeMainView === "friends"}
              onClick={() => {
                if (homeMainView === "friends") {
                  setHomeMainView("chat");
                  return;
                }
                setSelectedConversation(null);
                openFriendsView();
              }}
            />
            <NavigationItem
              label="Discover"
              icon={Compass}
              active={homeMainView === "discover"}
              onClick={() => {
                if (homeMainView === "discover") {
                  setHomeMainView("chat");
                  return;
                }
                setSelectedConversation(null);
                setHomeMainView("discover");
              }}
            />
          </nav>
        </div>
      ) : null}

      <div className="flex-1 space-y-3 overflow-y-auto px-2 py-2">
        {showDmListOnly ? (
          <div className="group">
            <button
              type="button"
              className="flex w-full items-center justify-between px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide text-(--discord-text-muted)"
              onClick={() => setRecentChannelsOpen((v) => !v)}
            >
              <span>Tin nhắn trực tiếp {recentChannelsOpen ? "▾" : "▸"}</span>
            </button>
            {recentChannelsOpen ? (
              <div className="mt-2 space-y-0.5">
                {recentDms.length === 0 ? (
                  <div className="px-2 py-1 text-xs text-(--discord-text-muted)">
                    Chưa có cuộc trò chuyện 1-1 gần đây
                  </div>
                ) : (
                  recentDms.map((c) => renderRecentRow(c))
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {showGroupChannels ? (
          <>
            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-(--discord-text-muted)">
              Kênh
            </div>
            <div className="group">
              <div className="flex w-full items-center justify-between px-2 py-1">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left text-xs font-semibold uppercase tracking-wide text-(--discord-text-muted)"
                  onClick={() => setInfoOpen((v) => !v)}
                >
                  Thông tin {infoOpen ? "▾" : "▸"}
                </button>
                {canManageChannels ? (
                  <button
                    type="button"
                    className="rounded p-0.5 text-(--discord-text-muted) hover:bg-(--discord-hover)"
                    title="Thêm kênh thông tin"
                    onClick={() => openCreateModal("INFO")}
                  >
                    <Plus className="size-3" />
                  </button>
                ) : null}
              </div>
              {infoOpen ? (
                <div className="mt-1 space-y-0.5">
                  {infoChannels.map((ch) => {
                    const active =
                      groupPanelView === "chat" &&
                      String(selectedChannel?.channelId) === String(ch.channelId);
                    return (
                      <button
                        key={ch.channelId}
                        type="button"
                        onClick={() => setSelectedChannel(ch)}
                        onContextMenu={(e) => openChannelContextMenu(e, ch)}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-[15px] font-medium transition ${
                          active
                            ? "bg-(--discord-active) text-white"
                            : "text-(--discord-text-muted) hover:bg-(--discord-hover) hover:text-(--discord-text)"
                        }`}
                      >
                        <Hash className="size-4 shrink-0" />
                        <span className="truncate">{ch.name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="group">
              <div className="flex w-full items-center justify-between px-2 py-1">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left text-xs font-semibold uppercase tracking-wide text-(--discord-text-muted)"
                  onClick={() => setChatOpen((v) => !v)}
                >
                  Kênh chat {chatOpen ? "▾" : "▸"}
                </button>
                {canManageChannels ? (
                  <button
                    type="button"
                    className="rounded p-0.5 text-(--discord-text-muted) hover:bg-(--discord-hover)"
                    title="Thêm kênh chat"
                    onClick={() => openCreateModal("CHAT")}
                  >
                    <Plus className="size-3" />
                  </button>
                ) : null}
              </div>
              {chatOpen ? (
                <div className="mt-1 space-y-0.5">
                  {chatChannels.map((ch) => {
                    const active =
                      groupPanelView === "chat" &&
                      String(selectedChannel?.channelId) === String(ch.channelId);
                    return (
                      <button
                        key={ch.channelId}
                        type="button"
                        onClick={() => setSelectedChannel(ch)}
                        onContextMenu={(e) => openChannelContextMenu(e, ch)}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-[15px] font-medium transition ${
                          active
                            ? "bg-(--discord-active) text-white"
                            : "text-(--discord-text-muted) hover:bg-(--discord-hover) hover:text-(--discord-text)"
                        }`}
                      >
                        <Hash className="size-4 shrink-0" />
                        <span className="truncate">{ch.name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="group">
              <div className="flex w-full items-center justify-between px-2 py-1">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left text-xs font-semibold uppercase tracking-wide text-(--discord-text-muted)"
                  onClick={() => setVoiceOpen((v) => !v)}
                >
                  Kênh thoại {voiceOpen ? "▾" : "▸"}
                </button>
                {canManageChannels ? (
                  <button
                    type="button"
                    className="rounded p-0.5 text-(--discord-text-muted) hover:bg-(--discord-hover)"
                    title="Thêm kênh thoại"
                    onClick={() => openCreateModal("VOICE")}
                  >
                    <Plus className="size-3" />
                  </button>
                ) : null}
              </div>
              {voiceOpen ? (
                <div className="mt-1 space-y-0.5">
                  {voiceChannels.map((ch) => {
                    const cid = selectedConversation?.conversationId;
                    const inThisChannel =
                      voiceSession &&
                      String(voiceSession.conversationId) === String(cid) &&
                      String(voiceSession.voiceChannelId) === String(ch.channelId);
                    const active =
                      groupPanelView === "voice" &&
                      String(viewingVoiceChannelId) === String(ch.channelId);
                    const roomKey = cid
                      ? `${String(cid)}#VOICE#${String(ch.channelId)}`
                      : "";
                    const members = roomKey
                      ? voiceMembersByRoom[roomKey] || []
                      : [];
                    return (
                      <div key={ch.channelId} className="space-y-0.5">
                        <button
                          type="button"
                          onContextMenu={(e) => openChannelContextMenu(e, ch)}
                          onClick={() => {
                            if (!cid) return;
                            const vid = ch.channelId;
                            if (inThisChannel) {
                              if (
                                groupPanelView === "voice" &&
                                String(viewingVoiceChannelId) === String(vid)
                              ) {
                                requestLeaveVoice();
                                return;
                              }
                              showVoicePanel(vid);
                              return;
                            }
                            joinVoiceChannel(cid, vid);
                          }}
                          className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-[15px] font-medium transition ${
                            active
                              ? "bg-(--discord-active) text-white"
                              : "text-(--discord-text-muted) hover:bg-(--discord-hover) hover:text-(--discord-text)"
                          }`}
                        >
                          <Volume2 className="size-4 shrink-0" />
                          <span className="truncate">{ch.name}</span>
                        </button>
                        {members.length > 0 ? (
                          <div className="ml-2 space-y-0.5 border-l border-white/10 pl-2">
                            {members.map((userId) => {
                              const u = users.find(
                                (x) => String(x._id) === String(userId),
                              );
                              const name =
                                String(userId) === String(authUser?._id)
                                  ? authUser?.fullName || "Bạn"
                                  : u?.fullName || userId;
                              const pic =
                                String(userId) === String(authUser?._id)
                                  ? authUser?.profilePic
                                  : u?.profilePic;
                              return (
                                <div
                                  key={`${ch.channelId}_${userId}`}
                                  className="flex items-center gap-2 rounded px-1.5 py-1"
                                  title={name}
                                >
                                  <img
                                    src={pic || "/avatar.png"}
                                    alt=""
                                    className="size-5 shrink-0 rounded-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.src = "/avatar.png";
                                    }}
                                  />
                                  <span className="truncate text-xs font-medium text-(--discord-text)">
                                    {name}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
      {modals}
    </aside>
  );
};
export default SideBar;

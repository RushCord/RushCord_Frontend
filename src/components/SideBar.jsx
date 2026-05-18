import { useEffect, useMemo, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import {
  ChevronDown,
  Hash,
  Headphones,
  Mic,
  Plus,
  Settings,
  Volume2,
  UserPlus,
} from "lucide-react";
import UserSettingsModal from "./UserSettingsModal";

const Sidebar = () => {
  const {
    getUsers,
    users,
    getConversations,
    conversations,
    getFriends,
    selectedConversation,
    setSelectedConversation,
    isUsersLoading,
  } = useChatStore();

  const { onlineUsers, authUser } = useAuthStore();
  const [infoOpen, setInfoOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [voiceOpen, setVoiceOpen] = useState(true);
  const [showUserSettings, setShowUserSettings] = useState(false);

  useEffect(() => {
    getUsers();
    getConversations();
    getFriends();
  }, [getUsers, getConversations, getFriends]);

  const recentConversationsList = useMemo(() => {
    const items = Array.isArray(conversations) ? conversations : [];
    return items
      .slice()
      .sort((a, b) => {
        const ta = String(a?.lastMessageAt || a?.lastMessage?.createdAt || "");
        const tb = String(b?.lastMessageAt || b?.lastMessage?.createdAt || "");
        return tb.localeCompare(ta);
      })
      .slice(0, 12);
  }, [conversations]);

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-(--discord-sidebar) text-(--discord-text)">
      <div className="border-b border-(--discord-border) px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1 text-left text-[16px] font-bold text-(--discord-text)"
          >
            <span className="truncate">Hiện Tại Và Tương Lai</span>
            <ChevronDown className="size-4 text-(--discord-text-muted)" />
          </button>
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-md text-(--discord-text-muted) hover:bg-(--discord-hover) hover:text-(--discord-text)"
            title="Invite"
          >
            <UserPlus className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-md text-(--discord-text-muted) hover:bg-(--discord-hover) hover:text-(--discord-text)"
            title="Settings"
            onClick={() => setShowUserSettings(true)}
          >
            <Settings className="size-4" />
          </button>
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-md text-(--discord-text-muted) hover:bg-(--discord-hover) hover:text-(--discord-text)"
            title="Create channel"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-2 py-2">
        <div className="group">
          <button
            type="button"
            className="flex w-full items-center justify-between px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide text-(--discord-text-muted)"
            onClick={() => setInfoOpen((v) => !v)}
          >
            <span>Thông Tin {infoOpen ? "▾" : "▸"}</span>
            <Plus className="size-3 opacity-0 transition group-hover:opacity-100" />
          </button>
          {infoOpen ? (
            <div className="mt-1 space-y-0.5">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[16px] font-medium text-(--discord-text-muted) hover:bg-(--discord-hover) hover:text-(--discord-text)"
              >
                <Hash className="size-4" />
                <span>chào mừng và nội quy</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[16px] font-medium text-(--discord-text-muted) hover:bg-(--discord-hover) hover:text-(--discord-text)"
              >
                <Hash className="size-4" />
                <span>ghi-chú-tài-nguyên</span>
              </button>
            </div>
          ) : null}
        </div>

        <div className="group">
          <button
            type="button"
            className="flex w-full items-center justify-between px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide text-(--discord-text-muted)"
            onClick={() => setChatOpen((v) => !v)}
          >
            <span>Kênh Chat {chatOpen ? "▾" : "▸"}</span>
            <Plus className="size-3 opacity-0 transition group-hover:opacity-100" />
          </button>
          {chatOpen ? (
            <div className="mt-1 space-y-0.5">
              {recentConversationsList.map((c) => {
                const isActive =
                  String(selectedConversation?.conversationId) ===
                  String(c.conversationId);
                const isGroup = c?.type === "GROUP";
                const other = !isGroup
                  ? users.find((u) => String(u._id) === String(c.otherUserId))
                  : null;
                const channelName = isGroup
                  ? c?.title || "group-chat"
                  : other?.fullName || "direct-message";
                return (
                  <button
                    key={c.conversationId}
                    type="button"
                    onClick={() => setSelectedConversation(c)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-[16px] font-medium transition ${
                      isActive
                        ? "bg-(--discord-active) text-white"
                        : "text-(--discord-text-muted) hover:bg-(--discord-hover) hover:text-(--discord-text)"
                    }`}
                  >
                    <Hash className="size-4" />
                    <span className="truncate">{channelName}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="group">
          <button
            type="button"
            className="flex w-full items-center justify-between px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide text-(--discord-text-muted)"
            onClick={() => setVoiceOpen((v) => !v)}
          >
            <span>Kênh Thoại {voiceOpen ? "▾" : "▸"}</span>
            <Plus className="size-3 opacity-0 transition group-hover:opacity-100" />
          </button>
          {voiceOpen ? (
            <div className="mt-1 space-y-0.5">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[16px] font-medium text-(--discord-text-muted) hover:bg-(--discord-hover) hover:text-(--discord-text)"
              >
                <Volume2 className="size-4" />
                <span>Phòng Chờ</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[16px] font-medium text-(--discord-text-muted) hover:bg-(--discord-hover) hover:text-(--discord-text)"
              >
                <Volume2 className="size-4" />
                <span>Phòng Học 1</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-(--discord-border) bg-(--discord-rail) px-2 py-2">
        <div className="relative">
          <img
            src={authUser?.profilePic || "/avatar.png"}
            alt={authUser?.fullName || "Profile"}
            className="size-8 rounded-full object-cover"
          />
          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-(--discord-rail) bg-(--discord-success)" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-(--discord-text)">
            {authUser?.fullName || "RushCord User"}
          </div>
          <div className="truncate text-xs text-(--discord-text-muted)">
            {onlineUsers.includes(String(authUser?._id)) ? "Online" : "Offline"}
          </div>
        </div>
        <div className="flex items-center gap-1 text-(--discord-text-muted)">
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded hover:bg-(--discord-hover) hover:text-(--discord-text)"
            title="Mic"
          >
            <Mic className="size-4" />
          </button>
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded hover:bg-(--discord-hover) hover:text-(--discord-text)"
            title="Headphones"
          >
            <Headphones className="size-4" />
          </button>
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded hover:bg-(--discord-hover) hover:text-(--discord-text)"
            title="Settings"
            onClick={() => setShowUserSettings(true)}
          >
            <Settings className="size-4" />
          </button>
        </div>
      </div>
      <UserSettingsModal
        open={showUserSettings}
        onClose={() => setShowUserSettings(false)}
      />
    </aside>
  );
};
export default Sidebar;

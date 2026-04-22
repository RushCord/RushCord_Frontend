import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Home,
  MessageCircle,
  Plus,
  Search,
  Settings,
  User,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useChatStore } from "../store/useChatStore";

import { useAuthStore } from "../store/useAuthStore";
import Sidebar from "../components/SideBar";

import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";

function dmConversationId(a, b) {
  const [x, y] = [String(a || ""), String(b || "")].sort();
  return `DM#${x}#${y}`;
}

export const HomePage = () => {
  const navigate = useNavigate();
  const {
    selectedConversation,
    setSelectedConversation,
    conversations,
    users,
    friends,
    getUsers,
    getConversations,
    getFriends,
    incomingFriendRequests,
    outgoingFriendRequests,
    getFriendRequests,
    acceptFriendRequest,
    deleteFriendRequest,
  } = useChatStore();
  const { authUser, onlineUsers } = useAuthStore();
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  );
  const [mobilePanel, setMobilePanel] = useState("list");
  const [mobileSearch, setMobileSearch] = useState("");

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    getUsers();
    getConversations();
    getFriends();
  }, [getUsers, getConversations, getFriends]);

  useEffect(() => {
    getFriendRequests();
  }, [getFriendRequests]);

  const recentConversations = useMemo(() => {
    const items = Array.isArray(conversations) ? conversations.slice() : [];
    return items.sort((a, b) => {
      const ta = String(a?.lastMessageAt || a?.lastMessage?.createdAt || "");
      const tb = String(b?.lastMessageAt || b?.lastMessage?.createdAt || "");
      return tb.localeCompare(ta);
    });
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    const q = String(mobileSearch || "")
      .trim()
      .toLowerCase();
    if (!q) return recentConversations;
    return recentConversations.filter((c) => {
      const isGroup = c?.type === "GROUP";
      const other = !isGroup
        ? users.find((u) => String(u._id) === String(c.otherUserId))
        : null;
      const title = isGroup
        ? c?.title || "Group"
        : other?.fullName || "Direct message";
      const preview = String(c?.lastMessage?.text || "");
      return `${title} ${preview}`.toLowerCase().includes(q);
    });
  }, [mobileSearch, recentConversations, users]);

  const groupConversations = useMemo(
    () => recentConversations.filter((c) => c?.type === "GROUP").slice(0, 8),
    [recentConversations],
  );

  const quickFriends = useMemo(() => {
    return (Array.isArray(friends) ? friends : [])
      .map((f) => {
        const u = users.find((x) => String(x._id) === String(f.otherUserId));
        return {
          otherUserId: f.otherUserId,
          fullName: u?.fullName || "Friend",
          profilePic: u?.profilePic || "/avatar.png",
          email: u?.email || "",
        };
      })
      .slice(0, 8);
  }, [friends, users]);

  const openConversation = (conversation) => {
    setSelectedConversation(conversation);
    if (isMobile) setMobilePanel("chat");
  };

  const activeMobilePanel =
    mobilePanel === "chat"
      ? selectedConversation
        ? "chat"
        : "list"
      : mobilePanel;

  if (isMobile) {
    return (
      <div className="mobile-home-shell md:hidden">
        {activeMobilePanel === "list" && (
          <div className="mobile-panel flex h-full min-h-0">
            <aside className="mobile-server-strip">
              <button
                type="button"
                className="mobile-server-icon is-active"
                title="Trang chu"
                onClick={() => setMobilePanel("list")}
              >
                <MessageCircle className="size-5" />
              </button>
              {groupConversations.map((c) => (
                <button
                  key={c.conversationId}
                  type="button"
                  title={c.title || "Group"}
                  onClick={() => openConversation(c)}
                  className={`mobile-server-avatar ${
                    String(selectedConversation?.conversationId) ===
                    String(c.conversationId)
                      ? "is-active"
                      : ""
                  }`}
                >
                  <img
                    src={c.avatar || "/avatar.png"}
                    alt={c.title || "Group"}
                    className="size-9 rounded-full object-cover"
                  />
                </button>
              ))}
            </aside>

            <section className="mobile-conversation-panel">
              <div className="mobile-list-toolbar">
                <div className="mobile-search-box">
                  <Search className="size-4 text-base-content/50" />
                  <input
                    type="text"
                    value={mobileSearch}
                    onChange={(e) => setMobileSearch(e.target.value)}
                    placeholder="Tim cuoc tro chuyen"
                    className="discord-input-reset w-full text-sm"
                  />
                </div>
                <button
                  type="button"
                  className="mobile-toolbar-button"
                  title="Add friend"
                  onClick={() => navigate("/friends?add=1")}
                >
                  <Plus className="size-5" />
                </button>
              </div>

              <div className="mobile-conversation-scroll">
                {filteredConversations.map((c) => {
                  const isGroup = c.type === "GROUP";
                  const other = !isGroup
                    ? users.find((u) => String(u._id) === String(c.otherUserId))
                    : null;
                  const title = isGroup
                    ? c.title || "Group"
                    : other?.fullName || "Direct message";
                  const avatar = isGroup
                    ? c.avatar || "/avatar.png"
                    : other?.profilePic || "/avatar.png";
                  const preview =
                    c?.lastMessage?.text ||
                    (isGroup ? "Group conversation" : "Direct message");
                  const timeLabel =
                    c?.lastMessageAt || c?.lastMessage?.createdAt || "";
                  const isOnline =
                    !isGroup &&
                    other &&
                    onlineUsers.includes(String(other._id));
                  return (
                    <button
                      key={c.conversationId}
                      type="button"
                      onClick={() => openConversation(c)}
                      className={`mobile-conversation-row ${
                        String(selectedConversation?.conversationId) ===
                        String(c.conversationId)
                          ? "is-active"
                          : ""
                      }`}
                    >
                      <div className="relative shrink-0">
                        <img
                          src={avatar}
                          alt={title}
                          className="size-12 rounded-full object-cover"
                        />
                        {isOnline ? (
                          <span className="discord-status-dot" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex items-start gap-2">
                          <div className="truncate text-[15px] font-semibold">
                            {title}
                          </div>
                          <div className="ml-auto shrink-0 text-[12px] text-base-content/50">
                            {timeLabel
                              ? new Date(timeLabel).toLocaleDateString()
                              : ""}
                          </div>
                        </div>
                        <div className="truncate text-[13px] text-base-content/60">
                          {preview}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {activeMobilePanel === "chat" && selectedConversation && (
          <div className="mobile-panel mobile-chat-shell">
            <ChatContainer />
          </div>
        )}

        {activeMobilePanel === "notifications" && (
          <div className="mobile-panel mobile-info-panel">
            <div className="mobile-info-header">
              <button
                type="button"
                className="discord-icon-button flex size-10 items-center justify-center rounded-full bg-white/5"
                onClick={() => setMobilePanel("list")}
                aria-label="Quay lại"
                title="Quay lại"
              >
                <ArrowLeft className="size-5" />
              </button>
              <Bell className="size-5 text-primary" />
              <div>
                <div className="text-base font-semibold">Các thông báo</div>
                <div className="text-sm text-base-content/60">
                  Lời mời kết bạn và cập nhật liên quan
                </div>
              </div>
            </div>

            <div className="space-y-4 pb-24">
              <div className="discord-card p-4">
                <div className="mb-3 text-sm font-semibold">
                  Lời mời đến ({incomingFriendRequests.length})
                </div>
                <div className="space-y-2">
                  {incomingFriendRequests.length === 0 ? (
                    <div className="text-sm text-base-content/60">
                      Không có thông báo mới.
                    </div>
                  ) : (
                    incomingFriendRequests.map((r) => {
                      const u = users.find(
                        (x) => String(x._id) === String(r.otherUserId),
                      );
                      return (
                        <div
                          key={`mobile-in-${r.otherUserId}`}
                          className="mobile-info-row"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {u?.fullName || "User"}
                            </div>
                            <div className="truncate text-xs text-base-content/60">
                              {u?.email || ""}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              className="btn btn-xs btn-primary rounded-md border-0"
                              onClick={() => acceptFriendRequest(r.otherUserId)}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs rounded-md border-0 bg-white/5 hover:bg-white/10"
                              onClick={() => deleteFriendRequest(r.otherUserId)}
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="discord-card p-4">
                <div className="mb-3 text-sm font-semibold">
                  Lời mời đi ({outgoingFriendRequests.length})
                </div>
                <div className="space-y-2">
                  {outgoingFriendRequests.length === 0 ? (
                    <div className="text-sm text-base-content/60">
                      Không có lời mời đang chờ.
                    </div>
                  ) : (
                    outgoingFriendRequests.map((r) => {
                      const u = users.find(
                        (x) => String(x._id) === String(r.otherUserId),
                      );
                      return (
                        <div
                          key={`mobile-out-${r.otherUserId}`}
                          className="mobile-info-row"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {u?.fullName || "User"}
                            </div>
                            <div className="truncate text-xs text-base-content/60">
                              {u?.email || ""}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-xs rounded-md border-0 bg-white/5 hover:bg-white/10"
                            onClick={() => deleteFriendRequest(r.otherUserId)}
                          >
                            Cancel
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeMobilePanel === "profile" && (
          <div className="mobile-panel mobile-info-panel">
            <div className="mobile-profile-card">
              <button
                type="button"
                className="discord-icon-button flex size-10 items-center justify-center rounded-full bg-white/5"
                onClick={() => setMobilePanel("list")}
                aria-label="Quay lại"
                title="Quay lại"
              >
                <ArrowLeft className="size-5" />
              </button>
              <img
                src={authUser?.profilePic || "/avatar.png"}
                alt={authUser?.fullName || "Profile"}
                className="size-20 rounded-full border border-white/10 object-cover"
              />
              <div>
                <div className="text-lg font-semibold">
                  {authUser?.fullName || "RushCord User"}
                </div>
                <div className="text-sm text-base-content/60">
                  {authUser?.email || ""}
                </div>
              </div>
            </div>

            <div className="space-y-4 pb-24">
              <div className="discord-card p-4">
                <div className="mb-3 text-sm font-semibold">Shortcut</div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    className="mobile-shortcut-button"
                    onClick={() => navigate("/friends")}
                  >
                    <Users className="size-5" />
                    <span>Bạn bè</span>
                  </button>
                  <button
                    type="button"
                    className="mobile-shortcut-button"
                    onClick={() => navigate("/profile")}
                  >
                    <User className="size-5" />
                    <span>Hồ sơ</span>
                  </button>
                  <button
                    type="button"
                    className="mobile-shortcut-button"
                    onClick={() => navigate("/settings")}
                  >
                    <Settings className="size-5" />
                    <span>Cài đặt</span>
                  </button>
                </div>
              </div>

              <div className="discord-card p-4">
                <div className="mb-3 text-sm font-semibold">Ban be</div>
                <div className="space-y-2">
                  {quickFriends.length === 0 ? (
                    <div className="text-sm text-base-content/60">
                      Chưa có bạn bè.
                    </div>
                  ) : (
                    quickFriends.map((f) => (
                      <button
                        key={f.otherUserId}
                        type="button"
                        className="mobile-info-row w-full text-left"
                        onClick={() => {
                          openConversation({
                            conversationId: dmConversationId(
                              authUser?._id,
                              f.otherUserId,
                            ),
                            type: "DM",
                            otherUserId: f.otherUserId,
                          });
                        }}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <img
                            src={f.profilePic}
                            alt={f.fullName}
                            className="size-11 rounded-full border border-white/10 object-cover"
                          />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {f.fullName}
                            </div>
                            <div className="truncate text-xs text-base-content/60">
                              {f.email}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <nav className="mobile-bottom-nav">
          <button
            type="button"
            className={`mobile-bottom-nav-button ${activeMobilePanel === "list" ? "is-active" : ""}`}
            onClick={() => {
              setMobilePanel("list");
              if (selectedConversation) setSelectedConversation(null);
            }}
          >
            <Home className="size-5" />
            <span>Trang chủ</span>
          </button>
          <button
            type="button"
            className={`mobile-bottom-nav-button ${activeMobilePanel === "notifications" ? "is-active" : ""}`}
            onClick={() => setMobilePanel("notifications")}
          >
            <Bell className="size-5" />
            <span>Các thông báo</span>
          </button>
          <button
            type="button"
            className={`mobile-bottom-nav-button ${activeMobilePanel === "profile" ? "is-active" : ""}`}
            onClick={() => setMobilePanel("profile")}
          >
            <Users className="size-5" />
            <span>Bạn</span>
          </button>
        </nav>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[var(--discord-app)]">
      <div className="flex h-full min-h-0 w-full overflow-hidden">
        <section className="conversation-sidebar discord-sidebar flex h-full flex-col">
          <Sidebar />
        </section>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-white/5">
          {!selectedConversation ? <NoChatSelected /> : <ChatContainer />}
        </div>
      </div>
    </div>
  );
};

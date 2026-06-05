import {
  ArrowLeft,
  Phone,
  Play,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useThemeStore } from "../store/useThemeStore";
import { axiosInstance } from "../lib/axios";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { uploadFileViaPresign } from "../lib/uploadMedia.js";
import { formatMessageTime, getFileIcon } from "../lib/utils";
import toast from "react-hot-toast";
import { GroupInvitePanel } from "./GroupInvitePanel";
import MessageSearchModal from "./MessageSearchModal";

const getFileNameFromUrl = (url) => {
  try {
    return url.split("/").pop().split("?")[0];
  } catch {
    return "file";
  }
};

const isImageUrl = (url, contentType = "") => {
  const ct = String(contentType || "").toLowerCase();
  if (ct.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(String(url || ""));
};

const isVideoUrl = (url, contentType = "") => {
  const ct = String(contentType || "").toLowerCase();
  if (ct.startsWith("video/")) return true;
  return /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(String(url || ""));
};

function effectiveAdminGrantedAt(member) {
  return String(
    member?.adminGrantedAt || member?.updatedAt || member?.joinedAt || "",
  );
}

function pickLongestTenuredAdminFromList(members) {
  const admins = (Array.isArray(members) ? members : [])
    .filter((m) => String(m.role || "").toUpperCase() === "ADMIN")
    .filter((m) => {
      const st = String(m.status || "ACCEPTED").toUpperCase();
      return st === "ACCEPTED";
    });
  if (admins.length === 0) return null;
  admins.sort((a, b) => {
    const ta = effectiveAdminGrantedAt(a);
    const tb = effectiveAdminGrantedAt(b);
    if (ta !== tb) return ta.localeCompare(tb);
    return String(a.userId).localeCompare(String(b.userId));
  });
  return admins[0];
}

const collectChatAttachments = (messages) => {
  const mediaItems = [];
  const fileItems = [];

  for (const msg of messages || []) {
    if (msg?.isRecalled || msg?.isDeletedForMe || msg?.isSystem) continue;

    const pushItem = (url, contentType, fileName) => {
      if (!url || typeof url !== "string") return;
      const item = {
        id: `${msg._id}_${url}`,
        url,
        fileName: fileName || getFileNameFromUrl(url),
        contentType: String(contentType || "").toLowerCase(),
        createdAt: msg.createdAt,
      };

      if (isVideoUrl(url, item.contentType)) {
        mediaItems.push({ ...item, kind: "video" });
      } else if (isImageUrl(url, item.contentType)) {
        mediaItems.push({ ...item, kind: "image" });
      } else {
        fileItems.push(item);
      }
    };

    if (msg.image) pushItem(msg.image, "image/");
    if (Array.isArray(msg.images)) {
      for (const url of msg.images) pushItem(url, "image/");
    }
    if (msg.file) pushItem(msg.file, msg.contentType, msg.fileName);
  }

  const byNewest = (a, b) =>
    String(b.createdAt || "").localeCompare(String(a.createdAt || ""));

  mediaItems.sort(byNewest);
  fileItems.sort(byNewest);

  return { mediaItems, fileItems };
};

const ChatHeader = ({ onCall, callDisabled = false }) => {
  const navigate = useNavigate();
  const { selectedConversation, setSelectedConversation, users, messages } =
    useChatStore();
  const { onlineUsers, authUser } = useAuthStore();
  const { theme } = useThemeStore();

  const openMemberProfile = (userId) => {
    if (String(userId) === String(authUser?._id)) {
      navigate("/profile");
      return;
    }
    navigate(`/profile/${encodeURIComponent(String(userId))}`);
  };

  const [showSettings, setShowSettings] = useState(false);
  const [showMessageSearchModal, setShowMessageSearchModal] = useState(false);
  const [settingsTitle, setSettingsTitle] = useState("");
  const [settingsAvatar, setSettingsAvatar] = useState("");
  const [settingsCover, setSettingsCover] = useState("");
  const [myRole, setMyRole] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null); // "chatSettings" | "members" | "files" | null
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [members, setMembers] = useState([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [memberMenu, setMemberMenu] = useState(null); // { userId, x, y } | null
  const [isMemberActionLoading, setIsMemberActionLoading] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberEmail, setAddMemberEmail] = useState("");
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleTargetUserId, setRoleTargetUserId] = useState(null);
  const [roleSelected, setRoleSelected] = useState("MEMBER");
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removeTargetUserId, setRemoveTargetUserId] = useState(null);
  const [showDissolveConfirm, setShowDissolveConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isGroupLeaveDissolveLoading, setIsGroupLeaveDissolveLoading] =
    useState(false);
  const [avatarUploadFileName, setAvatarUploadFileName] = useState("");
  const [coverUploadFileName, setCoverUploadFileName] = useState("");

  const isGroup = selectedConversation?.type === "GROUP";
  const canEdit = isGroup && myRole === "OWNER";

  const title = (() => {
    if (!selectedConversation) return "";
    if (selectedConversation.type === "GROUP")
      return selectedConversation.title || "Group";
    const otherId = selectedConversation.otherUserId;
    const u = users.find((x) => String(x._id) === String(otherId));
    return u?.fullName || "Direct message";
  })();

  const avatarUrl = (() => {
    if (!selectedConversation) return "/avatar.png";
    if (selectedConversation.type === "GROUP")
      return selectedConversation.avatar || "/avatar.png";
    const otherId = selectedConversation.otherUserId;
    const u = users.find((x) => String(x._id) === String(otherId));
    return u?.profilePic || "/avatar.png";
  })();

  useEffect(() => {
    if (!showSettings) return;
    if (!selectedConversation?.conversationId) return;

    if (selectedConversation.type !== "GROUP") {
      setExpandedSection("files");
      return;
    }

    setSettingsTitle(selectedConversation.title || "");
    setSettingsAvatar(selectedConversation.avatar || "");
    setSettingsCover(selectedConversation.cover || "");
    setExpandedSection("chatSettings");
    setShowRenameModal(false);
    setShowAvatarModal(false);
    setShowCoverModal(false);
    setShowDissolveConfirm(false);
    setShowLeaveConfirm(false);
    setMembers([]);

    let cancelled = false;
    (async () => {
      try {
        const cid = encodeURIComponent(
          String(selectedConversation.conversationId),
        );
        const res = await axiosInstance.get(`/conversations/${cid}/members`);
        const items = Array.isArray(res.data) ? res.data : [];
        const mine = items.find(
          (m) => String(m.userId) === String(authUser?._id),
        );
        if (!cancelled) setMyRole(mine?.role || "MEMBER");
      } catch {
        if (!cancelled) setMyRole("MEMBER");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showSettings, selectedConversation?.conversationId]);

  const settingsHelp = useMemo(() => "", []);

  const ownerLeaveSuccessor = useMemo(() => {
    if (myRole !== "OWNER") return null;
    return pickLongestTenuredAdminFromList(members);
  }, [myRole, members]);

  const { mediaItems: chatMedia, fileItems: chatFiles } = useMemo(
    () => collectChatAttachments(messages),
    [messages],
  );

  async function loadMembers() {
    if (!selectedConversation?.conversationId) return;
    if (selectedConversation.type !== "GROUP") return;
    setIsMembersLoading(true);
    try {
      const cid = encodeURIComponent(
        String(selectedConversation.conversationId),
      );
      const res = await axiosInstance.get(`/conversations/${cid}/members`);
      const items = Array.isArray(res.data) ? res.data : [];
      setMembers(items);
    } finally {
      setIsMembersLoading(false);
    }
  }

  useEffect(() => {
    if (!showLeaveConfirm || myRole !== "OWNER") return;
    loadMembers();
  }, [showLeaveConfirm, myRole, selectedConversation?.conversationId]);

  async function performLeaveGroup() {
    if (!selectedConversation?.conversationId) return;
    const cidRaw = String(selectedConversation.conversationId);
    setIsGroupLeaveDissolveLoading(true);
    try {
      const cid = encodeURIComponent(cidRaw);
      await axiosInstance.post(`/conversations/${cid}/leave`);
      try {
        await useChatStore.getState().getConversations();
      } catch {
        // ignore
      }
      setShowLeaveConfirm(false);
      setShowSettings(false);
      setSelectedConversation(null);
    } catch (e) {
      const code = e?.response?.data?.code;
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        (code === "NO_ELIGIBLE_SUCCESSOR"
          ? "Cần bổ nhiệm ít nhất một admin trước khi rời nhóm"
          : "Không thể thoát nhóm");
      toast.error(msg);
    } finally {
      setIsGroupLeaveDissolveLoading(false);
    }
  }

  async function performDissolveGroup() {
    if (!selectedConversation?.conversationId) return;
    const cidRaw = String(selectedConversation.conversationId);
    setIsGroupLeaveDissolveLoading(true);
    try {
      const cid = encodeURIComponent(cidRaw);
      await axiosInstance.delete(`/conversations/${cid}`);
      try {
        await useChatStore.getState().getConversations();
      } catch {
        // ignore
      }
      setShowDissolveConfirm(false);
      setShowSettings(false);
      setSelectedConversation(null);
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        "Không thể giải tán nhóm";
      toast.error(msg);
    } finally {
      setIsGroupLeaveDissolveLoading(false);
    }
  }

  async function changeMemberRole(targetUserId, role) {
    if (!selectedConversation?.conversationId) return;
    const cid = encodeURIComponent(String(selectedConversation.conversationId));
    setIsMemberActionLoading(true);
    try {
      await axiosInstance.patch(
        `/conversations/${cid}/members/${targetUserId}`,
        {
          role,
        },
      );
      await loadMembers();
    } finally {
      setIsMemberActionLoading(false);
      setMemberMenu(null);
    }
  }

  async function removeMemberFromGroup(targetUserId) {
    if (!selectedConversation?.conversationId) return;
    const cid = encodeURIComponent(String(selectedConversation.conversationId));
    setIsMemberActionLoading(true);
    try {
      await axiosInstance.delete(
        `/conversations/${cid}/members/${targetUserId}`,
      );
      await loadMembers();
      try {
        await useChatStore.getState().getConversations();
      } catch {
        // ignore
      }
    } finally {
      setIsMemberActionLoading(false);
      setMemberMenu(null);
    }
  }

  async function addMemberToGroup(targetUserId) {
    if (!selectedConversation?.conversationId) return;
    const cid = encodeURIComponent(String(selectedConversation.conversationId));
    setIsMemberActionLoading(true);
    try {
      await axiosInstance.post(`/conversations/${cid}/members`, {
        userId: targetUserId,
      });
      await loadMembers();
      try {
        await useChatStore.getState().getConversations();
      } catch {
        // ignore
      }
      setShowAddMemberModal(false);
    } finally {
      setIsMemberActionLoading(false);
    }
  }

  useEffect(() => {
    if (!memberMenu) return;
    const close = (e) => {
      if (e.target?.closest?.("[data-member-menu]")) return;
      setMemberMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [memberMenu]);

  useEffect(() => {
    const hasMobileOverlay =
      showSettings ||
      showRenameModal ||
      showAvatarModal ||
      showCoverModal ||
      showAddMemberModal ||
      showRoleModal ||
      showRemoveConfirm ||
      showDissolveConfirm ||
      showLeaveConfirm;
    document.body.classList.toggle("mobile-overlay-active", hasMobileOverlay);
    return () => {
      document.body.classList.remove("mobile-overlay-active");
    };
  }, [
    showSettings,
    showRenameModal,
    showAvatarModal,
    showCoverModal,
    showAddMemberModal,
    showRoleModal,
    showRemoveConfirm,
    showDissolveConfirm,
    showLeaveConfirm,
  ]);

  useEffect(() => {
    document.body.classList.toggle("group-settings-open", showSettings);
    return () => {
      document.body.classList.remove("group-settings-open");
    };
  }, [showSettings]);

  const roleTarget = roleTargetUserId
    ? members.find((x) => String(x.userId) === String(roleTargetUserId))
    : null;

  const removeTarget = removeTargetUserId
    ? members.find((x) => String(x.userId) === String(removeTargetUserId))
    : null;

  const hasPortaledOverlays =
    (showSettings && selectedConversation) ||
    (showRenameModal && selectedConversation?.type === "GROUP") ||
    (showAvatarModal && selectedConversation?.type === "GROUP") ||
    (showCoverModal && selectedConversation?.type === "GROUP") ||
    (showAddMemberModal && selectedConversation?.type === "GROUP") ||
    !!memberMenu ||
    showRoleModal ||
    showRemoveConfirm ||
    showDissolveConfirm ||
    showLeaveConfirm;

  return (
    <>
      <div className="mobile-chat-header border-b border-(--discord-border) bg-(--discord-panel) px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedConversation(null)}
              aria-label="Back to messages"
              title="Back"
              className="discord-icon-button flex size-8 items-center justify-center rounded-md text-(--discord-text-muted) md:hidden"
            >
              <ArrowLeft className="size-4" />
            </button>
            <img
              src={avatarUrl}
              alt={title || "Chat"}
              className="size-8 shrink-0 rounded-full border border-white/10 object-cover"
              onError={(e) => {
                e.currentTarget.src = "/avatar.png";
              }}
            />
            <div className="min-w-0">
              <h3 className="truncate text-[16px] font-bold text-(--discord-text)">
                {title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1 text-(--discord-text-muted)">
            <button
              type="button"
              onClick={() => setShowSettings((prev) => !prev)}
              className={`flex size-8 items-center justify-center rounded-md ${
                showSettings
                  ? "bg-(--discord-active) text-(--discord-active-text)"
                  : "hover:bg-(--discord-hover) hover:text-(--discord-text)"
              }`}
              aria-label="Toggle details"
              title="Toggle details"
            >
              <Settings2 className="size-4" />
            </button>
            {!isGroup && (
              <button
                type="button"
                onClick={onCall}
                disabled={callDisabled || !selectedConversation}
                className="flex size-8 items-center justify-center rounded-md bg-(--discord-success)/20 text-(--discord-success) disabled:opacity-50"
                title="Call"
                aria-label="Call"
              >
                <Phone className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedConversation(null)}
              aria-label="Close"
              title="Close"
              className="flex size-8 items-center justify-center rounded-md hover:bg-(--discord-hover) hover:text-(--discord-text)"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {typeof document !== "undefined" &&
        hasPortaledOverlays &&
        createPortal(
          <div data-theme={theme}>
            {showSettings && selectedConversation && (
              <div
                className="fixed inset-0 z-2000 md:pointer-events-none"
                role="presentation"
              >
                <div
                  className="discord-modal-scrim absolute inset-0 md:hidden"
                  onClick={() => setShowSettings(false)}
                />

                <div
                  className="mobile-group-settings-drawer desktop-group-settings-drawer absolute right-0 top-0 h-full w-full max-w-md border-l border-white/10 bg-(--discord-sidebar) shadow-2xl md:pointer-events-auto"
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="h-full flex flex-col">
                    <div className="discord-topbar flex items-center justify-between gap-3 p-4">
                      <div>
                        <div className="discord-section-title mb-1">
                          {isGroup ? "Members" : "Details"}
                        </div>
                        <h2 className="text-base-content font-semibold">
                          {isGroup ? "Tùy chỉnh đoạn chat" : "Chi tiết đoạn chat"}
                        </h2>
                      </div>
                      <button
                        type="button"
                        className="discord-icon-button flex size-9 items-center justify-center rounded-full bg-white/5"
                        onClick={() => setShowSettings(false)}
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    <div className="discord-scroll p-4 flex-1 overflow-y-auto">
                      {settingsHelp ? (
                        <div className="text-xs text-base-content/60 mb-3">
                          {settingsHelp}
                        </div>
                      ) : null}

                      <button
                        type="button"
                        className="btn btn-sm mb-3 w-full justify-start gap-2 rounded-lg border border-white/10 bg-black/10 hover:bg-white/10"
                        onClick={() => setShowMessageSearchModal(true)}
                      >
                        <Search className="size-4 shrink-0" />
                        Tìm kiếm tin nhắn
                      </button>

                      {/* Collapsible sections */}
                      <div className="space-y-3">
                        {isGroup ? (
                          <>
                        <div className="overflow-hidden rounded-lg border border-white/10 bg-black/10">
                          <button
                            type="button"
                            className="w-full flex items-center justify-between px-3 py-3 hover:bg-white/5 transition"
                            onClick={() =>
                              setExpandedSection((s) =>
                                s === "chatSettings" ? null : "chatSettings",
                              )
                            }
                          >
                            <div className="text-sm font-medium">
                              Tùy chỉnh đoạn chat
                            </div>
                            <div className="text-base-content/70 text-sm">
                              {expandedSection === "chatSettings" ? "▾" : "▸"}
                            </div>
                          </button>

                          {expandedSection === "chatSettings" && (
                            <div className="px-3 pb-3 space-y-3">
                              <div className="overflow-hidden rounded-lg border border-white/10">
                                <div className="relative h-20 bg-gradient-to-r from-primary/30 via-purple-900/30 to-slate-900">
                                  {String(
                                    settingsCover ||
                                      selectedConversation?.cover ||
                                      "",
                                  ).trim() ? (
                                    <img
                                      src={
                                        settingsCover ||
                                        selectedConversation?.cover
                                      }
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  ) : null}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                </div>
                                <div className="relative -mt-6 px-3 pb-3">
                                  <img
                                    src={
                                      settingsAvatar?.trim()
                                        ? settingsAvatar
                                        : avatarUrl
                                    }
                                    alt=""
                                    className="size-12 rounded-full border-2 border-(--discord-sidebar) object-cover"
                                    onError={(e) => {
                                      e.currentTarget.src = "/avatar.png";
                                    }}
                                  />
                                </div>
                              </div>
                              <p className="text-[11px] text-base-content/50">
                                Ảnh bìa hiển thị trên trang khám phá nhóm (sắp ra mắt).
                              </p>
                              <button
                                type="button"
                                className="btn btn-sm w-full justify-start rounded-lg border-0 bg-white/5 hover:bg-white/10"
                                disabled={!canEdit}
                                onClick={() => setShowRenameModal(true)}
                              >
                                Đổi tên đoạn chat
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm w-full justify-start rounded-lg border-0 bg-white/5 hover:bg-white/10"
                                disabled={!canEdit}
                                onClick={() => setShowAvatarModal(true)}
                              >
                                Thay đổi ảnh đại diện
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm w-full justify-start rounded-lg border-0 bg-white/5 hover:bg-white/10"
                                disabled={!canEdit}
                                onClick={() => setShowCoverModal(true)}
                              >
                                Thay đổi ảnh bìa
                              </button>
                            </div>
                          )}
                        </div>

                        {(myRole === "OWNER" || myRole === "ADMIN") &&
                        selectedConversation?.conversationId ? (
                          <GroupInvitePanel
                            conversationId={selectedConversation.conversationId}
                            myRole={myRole}
                            joinPolicy={selectedConversation.joinPolicy}
                          />
                        ) : null}

                        <div className="overflow-hidden rounded-lg border border-white/10 bg-black/10">
                          <button
                            type="button"
                            className="w-full flex items-center justify-between px-3 py-3 hover:bg-white/5 transition"
                            onClick={async () => {
                              setExpandedSection((s) =>
                                s === "members" ? null : "members",
                              );
                              // lazy load when opening
                              if (expandedSection !== "members") {
                                await loadMembers();
                              }
                            }}
                          >
                            <div className="text-sm font-medium">
                              Thành viên trong đoạn chat
                            </div>
                            <div className="text-base-content/70 text-sm">
                              {expandedSection === "members" ? "▾" : "▸"}
                            </div>
                          </button>

                          {expandedSection === "members" && (
                            <div className="px-3 pb-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-xs text-base-content/60">
                                  {(() => {
                                    if (isMembersLoading) return "Đang tải...";
                                    const onlineCount = members.filter((m) =>
                                      onlineUsers.includes(String(m.userId)),
                                    ).length;
                                    return `${onlineCount}/${members.length} online`;
                                  })()}
                                </div>
                              </div>

                              <div className="space-y-2">
                                {members.map((m) => {
                                  const u = users.find(
                                    (x) => String(x._id) === String(m.userId),
                                  );
                                  const isMe =
                                    String(m.userId) === String(authUser?._id);
                                  const name =
                                    (isMe ? authUser?.fullName : u?.fullName) ||
                                    m.fullName ||
                                    m.userId;
                                  const avatar =
                                    (isMe
                                      ? authUser?.profilePic
                                      : u?.profilePic) || "/avatar.png";
                                  const isOnline = onlineUsers.includes(
                                    String(m.userId),
                                  );
                                  const targetRole = String(
                                    m.role || "MEMBER",
                                  ).toUpperCase();
                                  const actorRole = String(
                                    myRole || "MEMBER",
                                  ).toUpperCase();
                                  const canManageTarget = (() => {
                                    if (targetRole === "OWNER") return false;
                                    if (actorRole === "OWNER") return true;
                                    if (actorRole === "ADMIN") return true;
                                    return false;
                                  })();
                                  return (
                                    <div
                                      key={m.userId}
                                      className="flex items-center gap-3"
                                    >
                                      <button
                                        type="button"
                                        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 -mx-1 text-left transition hover:bg-white/5 cursor-pointer"
                                        onClick={() =>
                                          openMemberProfile(m.userId)
                                        }
                                      >
                                        <div className="relative shrink-0">
                                          <img
                                            src={avatar}
                                            alt={name}
                                            className="size-9 rounded-full object-cover border border-white/10"
                                          />
                                          {isOnline && (
                                            <span className="discord-status-dot" />
                                          )}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="text-sm truncate">
                                            {name}
                                          </div>
                                          <div className="text-xs text-base-content/60">
                                            {targetRole === "OWNER"
                                              ? "OWNER"
                                              : targetRole === "ADMIN"
                                                ? "ADMIN"
                                                : "MEMBER"}
                                          </div>
                                        </div>
                                      </button>

                                      {(actorRole === "OWNER" ||
                                        actorRole === "ADMIN") && (
                                        <div className="ml-auto relative">
                                          <button
                                            type="button"
                                            className="btn btn-xs rounded-md border-0 bg-white/5 hover:bg-white/10"
                                            disabled={
                                              !canManageTarget ||
                                              isMemberActionLoading
                                            }
                                            onClick={(e) => {
                                              const r =
                                                e.currentTarget.getBoundingClientRect();
                                              setMemberMenu((cur) =>
                                                cur?.userId === m.userId
                                                  ? null
                                                  : {
                                                      userId: m.userId,
                                                      x: Math.round(r.right),
                                                      y: Math.round(r.bottom),
                                                    },
                                              );
                                            }}
                                            title="Quản lý"
                                          >
                                            ...
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {!isMembersLoading && members.length === 0 && (
                                  <div className="text-xs text-base-content/60">
                                    Không có dữ liệu thành viên.
                                  </div>
                                )}

                                {(() => {
                                  const actorRole = String(
                                    myRole || "MEMBER",
                                  ).toUpperCase();
                                  const canAdd =
                                    actorRole === "OWNER" ||
                                    actorRole === "ADMIN";
                                  return (
                                    <button
                                      type="button"
                                      className="btn btn-sm mt-2 w-full justify-start rounded-lg border-0 bg-primary/85 text-primary-content hover:bg-primary"
                                      disabled={
                                        !canAdd || isMemberActionLoading
                                      }
                                      onClick={() =>
                                        setShowAddMemberModal(true)
                                      }
                                    >
                                      + Thêm thành viên
                                    </button>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                          </>
                        ) : null}

                        <div className="overflow-hidden rounded-lg border border-white/10 bg-black/10">
                          <button
                            type="button"
                            className="w-full flex items-center justify-between px-3 py-3 hover:bg-white/5 transition"
                            onClick={() =>
                              setExpandedSection((s) =>
                                s === "files" ? null : "files",
                              )
                            }
                          >
                            <div className="text-sm font-medium">
                              File trong đoạn chat
                            </div>
                            <div className="text-base-content/70 text-sm">
                              {expandedSection === "files" ? "▾" : "▸"}
                            </div>
                          </button>

                          {expandedSection === "files" && (
                            <div className="px-3 pb-3 space-y-4">
                              <div>
                                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/60">
                                  Ảnh / Video ({chatMedia.length})
                                </div>
                                {chatMedia.length === 0 ? (
                                  <div className="text-xs text-base-content/50">
                                    Chưa có ảnh hoặc video.
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-3 gap-1.5">
                                    {chatMedia.map((item) => (
                                      <button
                                        key={item.id}
                                        type="button"
                                        className="group relative aspect-square overflow-hidden rounded-md border border-white/10 bg-black/20"
                                        onClick={() =>
                                          window.open(item.url, "_blank")
                                        }
                                        title={item.fileName}
                                      >
                                        {item.kind === "video" ? (
                                          <>
                                            <video
                                              src={item.url}
                                              className="size-full object-cover"
                                              muted
                                              preload="metadata"
                                            />
                                            <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                                              <Play className="size-5 text-white" />
                                            </span>
                                          </>
                                        ) : (
                                          <img
                                            src={item.url}
                                            alt={item.fileName}
                                            className="size-full object-cover transition group-hover:opacity-90"
                                          />
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div>
                                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/60">
                                  File ({chatFiles.length})
                                </div>
                                {chatFiles.length === 0 ? (
                                  <div className="text-xs text-base-content/50">
                                    Chưa có file đính kèm.
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    {chatFiles.map((item) => (
                                      <a
                                        key={item.id}
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-white/5"
                                        title={item.fileName}
                                      >
                                        <span className="shrink-0 text-base">
                                          {getFileIcon(item.url)}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <div className="truncate text-sm">
                                            {item.fileName}
                                          </div>
                                          {item.createdAt ? (
                                            <div className="text-xs text-base-content/50">
                                              {formatMessageTime(item.createdAt)}
                                            </div>
                                          ) : null}
                                        </div>
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {isGroup ? (
                          <div className="overflow-hidden rounded-lg border border-error/25 bg-error/5">
                            <div className="px-3 py-2 border-b border-error/15">
                              <div className="text-xs font-semibold uppercase tracking-wide text-error/90">
                                Thao tác nguy hiểm
                              </div>
                            </div>
                            <div className="p-3 flex flex-col gap-2">
                              {myRole === "OWNER" ? (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-sm w-full justify-start rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
                                    onClick={() => setShowLeaveConfirm(true)}
                                  >
                                    Thoát khỏi đoạn chat
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-error w-full justify-start rounded-lg border-error/40"
                                    onClick={() => setShowDissolveConfirm(true)}
                                  >
                                    Giải tán nhóm
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-sm w-full justify-start rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
                                  onClick={() => setShowLeaveConfirm(true)}
                                >
                                  Thoát khỏi đoạn chat
                                </button>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Footer intentionally omitted (click overlay to close) */}
                  </div>
                </div>
              </div>
            )}

            {/* Rename modal */}
            {showRenameModal && selectedConversation?.type === "GROUP" && (
              <div
          className="discord-modal-scrim fixed inset-0 z-2100 flex items-center justify-center p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowRenameModal(false);
                }}
                role="presentation"
              >
                <div
                  className="discord-modal-card w-full max-w-md p-4"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base-content font-semibold">
                      Đổi tên đoạn chat
                    </h3>
                    <button
                      type="button"
                      className="discord-icon-button flex size-8 items-center justify-center rounded-full bg-white/5"
                      onClick={() => setShowRenameModal(false)}
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <input
                    className="input discord-input-reset w-full rounded-xl border border-white/10 bg-black/10 px-4"
                    value={settingsTitle}
                    onChange={(e) => setSettingsTitle(e.target.value)}
                    disabled={!canEdit || isSaving}
                    placeholder="Tên mới"
                  />

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setShowRenameModal(false)}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!canEdit || isSaving}
                      onClick={async () => {
                        if (!selectedConversation?.conversationId) return;
                        setIsSaving(true);
                        try {
                          const cid = encodeURIComponent(
                            String(selectedConversation.conversationId),
                          );
                          const res = await axiosInstance.patch(
                            `/conversations/${cid}`,
                            { title: settingsTitle },
                          );
                          const updated = res.data;
                          useChatStore.setState((s) => ({
                            selectedConversation: s.selectedConversation
                              ? {
                                  ...s.selectedConversation,
                                  title: updated.title,
                                }
                              : s.selectedConversation,
                          }));
                          try {
                            await useChatStore.getState().getConversations();
                          } catch {
                            // ignore
                          }
                          setShowRenameModal(false);
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                    >
                      {isSaving ? "Đang lưu..." : "Lưu"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Avatar modal */}
            {showAvatarModal && selectedConversation?.type === "GROUP" && (
              <div
          className="discord-modal-scrim fixed inset-0 z-2100 flex items-center justify-center p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowAvatarModal(false);
                }}
                role="presentation"
              >
                <div
                  className="discord-modal-card w-full max-w-md p-4"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base-content font-semibold">
                      Thay đổi ảnh đại diện
                    </h3>
                    <button
                      type="button"
                      className="discord-icon-button flex size-8 items-center justify-center rounded-full bg-white/5"
                      onClick={() => setShowAvatarModal(false)}
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          settingsAvatar?.trim()
                            ? settingsAvatar
                            : "/avatar.png"
                        }
                        alt="preview"
                        className="size-12 rounded-full object-cover border border-white/10"
                        onError={(e) => {
                          e.currentTarget.src = "/avatar.png";
                        }}
                      />
                      <div className="text-xs text-base-content/60">
                        {settingsAvatar?.trim()
                          ? "Ảnh hiện tại / đã chọn"
                          : "Chưa có ảnh"}
                      </div>
                    </div>

                    {canEdit && (
                      <div>
                        <div className="text-sm text-base-content mb-1">
                          Upload ảnh
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="file-input file-input-bordered file-input-sm w-full rounded-xl"
                          disabled={!canEdit || isUploadingAvatar || isSaving}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setAvatarUploadFileName(file.name || "");
                            setIsUploadingAvatar(true);
                            try {
                              const { publicUrl } = await uploadFileViaPresign(
                                file,
                                "avatar",
                              );
                              setSettingsAvatar(publicUrl);
                            } finally {
                              setIsUploadingAvatar(false);
                            }
                          }}
                        />
                        {avatarUploadFileName ? (
                          <div className="mt-1 text-xs text-base-content/60">
                            Đã chọn:{" "}
                            <span className="font-medium">
                              {avatarUploadFileName}
                            </span>
                          </div>
                        ) : null}
                        <div className="mt-1 text-xs text-base-content/60">
                          Ảnh sẽ được upload qua presigned URL.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setShowAvatarModal(false)}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={
                        !canEdit ||
                        isSaving ||
                        isUploadingAvatar ||
                        !String(settingsAvatar || "").trim()
                      }
                      onClick={async () => {
                        if (!selectedConversation?.conversationId) return;
                        setIsSaving(true);
                        try {
                          const cid = encodeURIComponent(
                            String(selectedConversation.conversationId),
                          );
                          const res = await axiosInstance.patch(
                            `/conversations/${cid}`,
                            { avatar: settingsAvatar },
                          );
                          const updated = res.data;
                          useChatStore.setState((s) => ({
                            selectedConversation: s.selectedConversation
                              ? {
                                  ...s.selectedConversation,
                                  avatar: updated.avatar,
                                }
                              : s.selectedConversation,
                            conversations: (s.conversations || []).map((c) =>
                              String(c.conversationId) ===
                              String(updated.conversationId)
                                ? { ...c, avatar: updated.avatar }
                                : c,
                            ),
                          }));
                          try {
                            await useChatStore.getState().getConversations();
                          } catch {
                            // ignore
                          }
                          setShowAvatarModal(false);
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                    >
                      {isUploadingAvatar
                        ? "Đang tải ảnh..."
                        : isSaving
                          ? "Đang lưu..."
                          : "Lưu"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showCoverModal && selectedConversation?.type === "GROUP" && (
              <div
                className="discord-modal-scrim fixed inset-0 z-2100 flex items-center justify-center p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowCoverModal(false);
                }}
                role="presentation"
              >
                <div
                  className="discord-modal-card w-full max-w-md p-4"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base-content font-semibold">
                      Thay đổi ảnh bìa
                    </h3>
                    <button
                      type="button"
                      className="discord-icon-button flex size-8 items-center justify-center rounded-full bg-white/5"
                      onClick={() => setShowCoverModal(false)}
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="relative h-28 overflow-hidden rounded-lg border border-white/10 bg-gradient-to-r from-primary/30 via-purple-900/30 to-slate-900">
                      {settingsCover?.trim() ? (
                        <img
                          src={settingsCover}
                          alt="preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-base-content/60">
                          Chưa có ảnh bìa
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-base-content/50">
                      Ảnh bìa dùng cho thẻ nhóm trên trang khám phá.
                    </p>

                    {canEdit ? (
                      <div>
                        <div className="text-sm text-base-content mb-1">
                          Upload ảnh bìa
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="file-input file-input-bordered file-input-sm w-full rounded-xl"
                          disabled={!canEdit || isUploadingCover || isSaving}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setCoverUploadFileName(file.name || "");
                            setIsUploadingCover(true);
                            try {
                              const { publicUrl } = await uploadFileViaPresign(
                                file,
                                "cover",
                              );
                              setSettingsCover(publicUrl);
                            } finally {
                              setIsUploadingCover(false);
                            }
                          }}
                        />
                        {coverUploadFileName ? (
                          <div className="mt-1 text-xs text-base-content/60">
                            Đã chọn:{" "}
                            <span className="font-medium">
                              {coverUploadFileName}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setShowCoverModal(false)}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={
                        !canEdit ||
                        isSaving ||
                        isUploadingCover ||
                        !String(settingsCover || "").trim()
                      }
                      onClick={async () => {
                        if (!selectedConversation?.conversationId) return;
                        setIsSaving(true);
                        try {
                          const cid = encodeURIComponent(
                            String(selectedConversation.conversationId),
                          );
                          const res = await axiosInstance.patch(
                            `/conversations/${cid}`,
                            { cover: settingsCover },
                          );
                          const updated = res.data;
                          useChatStore.setState((s) => ({
                            selectedConversation: s.selectedConversation
                              ? {
                                  ...s.selectedConversation,
                                  cover: updated.cover,
                                }
                              : s.selectedConversation,
                            conversations: (s.conversations || []).map((c) =>
                              String(c.conversationId) ===
                              String(updated.conversationId)
                                ? { ...c, cover: updated.cover }
                                : c,
                            ),
                          }));
                          try {
                            await useChatStore.getState().getConversations();
                          } catch {
                            // ignore
                          }
                          setShowCoverModal(false);
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                    >
                      {isUploadingCover
                        ? "Đang tải ảnh..."
                        : isSaving
                          ? "Đang lưu..."
                          : "Lưu"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Fixed member menu (not clipped by overflow) */}
            {memberMenu && (
              <div
          className="fixed z-2120"
                style={{
                  left: memberMenu.x,
                  top: memberMenu.y,
                  transform: "translateX(-100%)",
                }}
                data-member-menu
              >
                {(() => {
                  const m = members.find(
                    (x) => String(x.userId) === String(memberMenu.userId),
                  );
                  const targetRole = String(m?.role || "MEMBER").toUpperCase();
                  const actorRole = String(myRole || "MEMBER").toUpperCase();
                  const canManageTarget =
                    targetRole !== "OWNER" &&
                    (actorRole === "OWNER" || actorRole === "ADMIN");
                  const canRemove =
                    canManageTarget &&
                    (actorRole === "OWNER" ||
                      (actorRole === "ADMIN" && targetRole === "MEMBER"));

                  return (
              <div className="w-44 overflow-hidden rounded-lg border border-white/10 bg-(--discord-panel) shadow-xl">
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={!canManageTarget || isMemberActionLoading}
                        onClick={() => {
                          setRoleTargetUserId(memberMenu.userId);
                          setRoleSelected(
                            targetRole === "ADMIN" ? "ADMIN" : "MEMBER",
                          );
                          setShowRoleModal(true);
                          setMemberMenu(null);
                        }}
                      >
                        Phân quyền
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 text-error disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={!canRemove || isMemberActionLoading}
                        onClick={() => {
                          setRemoveTargetUserId(memberMenu.userId);
                          setShowRemoveConfirm(true);
                          setMemberMenu(null);
                        }}
                      >
                        Xóa khỏi nhóm
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Role modal */}
            {showRoleModal && roleTargetUserId && (
              <div
          className="discord-modal-scrim fixed inset-0 z-2140 flex items-center justify-center p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowRoleModal(false);
                }}
                role="presentation"
              >
                <div
                  className="discord-modal-card w-full max-w-md p-4"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Phân quyền</h3>
                    <button
                      type="button"
                      className="discord-icon-button flex size-8 items-center justify-center rounded-full bg-white/5"
                      onClick={() => setShowRoleModal(false)}
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {(() => {
                    const actorRole = String(myRole || "MEMBER").toUpperCase();
                    const targetRole = String(
                      roleTarget?.role || "MEMBER",
                    ).toUpperCase();
                    const isOwner = actorRole === "OWNER";
                    const isAdmin = actorRole === "ADMIN";

                    const canSetAdmin =
                      targetRole === "MEMBER" && (isOwner || isAdmin);
                    const canSetMember = targetRole === "ADMIN" && isOwner;

                    return (
                      <>
                        <div className="text-sm mb-3">
                          Chọn quyền cho{" "}
                          <span className="font-medium">
                            {roleTarget?.fullName || roleTargetUserId}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="role"
                              className="radio radio-sm"
                              checked={roleSelected === "MEMBER"}
                              onChange={() => setRoleSelected("MEMBER")}
                              disabled={
                                !canSetMember && targetRole !== "MEMBER"
                              }
                            />
                            <span>MEMBER</span>
                            {!canSetMember && targetRole === "ADMIN" && (
                              <span className="text-xs text-base-content/60">
                                (ADMIN không thể tự hạ quyền)
                              </span>
                            )}
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="role"
                              className="radio radio-sm"
                              checked={roleSelected === "ADMIN"}
                              onChange={() => setRoleSelected("ADMIN")}
                              disabled={!canSetAdmin && targetRole !== "ADMIN"}
                            />
                            <span>ADMIN</span>
                          </label>
                        </div>

                        <div className="mt-4 flex justify-end gap-2">
                          <button
                            type="button"
                            className="btn"
                            onClick={() => setShowRoleModal(false)}
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={isMemberActionLoading}
                            onClick={async () => {
                              const next = roleSelected;
                              if (next === targetRole) {
                                setShowRoleModal(false);
                                return;
                              }
                              // enforce rules client-side (backend also enforces)
                              if (next === "ADMIN" && !canSetAdmin) return;
                              if (next === "MEMBER" && !canSetMember) return;
                              await changeMemberRole(roleTargetUserId, next);
                              setShowRoleModal(false);
                            }}
                          >
                            {isMemberActionLoading ? "Đang lưu..." : "Lưu"}
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Remove confirm modal */}
            {showRemoveConfirm && removeTargetUserId && (
              <div
          className="discord-modal-scrim fixed inset-0 z-2140 flex items-center justify-center p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowRemoveConfirm(false);
                }}
                role="presentation"
              >
                <div
                  className="discord-modal-card w-full max-w-md p-4"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-error">Xóa khỏi nhóm</h3>
                    <button
                      type="button"
                      className="discord-icon-button flex size-8 items-center justify-center rounded-full bg-white/5"
                      onClick={() => setShowRemoveConfirm(false)}
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="text-sm">
                    Bạn có chắc muốn xóa{" "}
                    <span className="font-medium">
                      {removeTarget?.fullName || removeTargetUserId}
                    </span>{" "}
                    khỏi nhóm?
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setShowRemoveConfirm(false)}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="btn btn-error"
                      disabled={isMemberActionLoading}
                      onClick={async () => {
                        await removeMemberFromGroup(removeTargetUserId);
                        setShowRemoveConfirm(false);
                      }}
                    >
                      {isMemberActionLoading ? "Đang xóa..." : "Xóa"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Dissolve group confirm */}
            {showDissolveConfirm && selectedConversation?.type === "GROUP" && (
              <div
          className="discord-modal-scrim fixed inset-0 z-2180 flex items-center justify-center p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget)
                    setShowDissolveConfirm(false);
                }}
                role="presentation"
              >
                <div
                  className="discord-modal-card w-full max-w-md p-4"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-error">Giải tán nhóm</h3>
                    <button
                      type="button"
                      className="discord-icon-button flex size-8 items-center justify-center rounded-full bg-white/5"
                      onClick={() => setShowDissolveConfirm(false)}
                      disabled={isGroupLeaveDissolveLoading}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <p className="text-sm text-base-content/90">
                    Giải tán nhóm sẽ xóa hội thoại nhóm cho tất cả thành viên.
                    Hành động này không thể hoàn tác.
                  </p>
                  <p className="mt-2 text-sm">
                    Nhóm: <span className="font-medium">{title}</span>
                  </p>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      className="btn"
                      disabled={isGroupLeaveDissolveLoading}
                      onClick={() => setShowDissolveConfirm(false)}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="btn btn-error"
                      disabled={isGroupLeaveDissolveLoading}
                      onClick={() => performDissolveGroup()}
                    >
                      {isGroupLeaveDissolveLoading
                        ? "Đang xử lý..."
                        : "Giải tán nhóm"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Leave group confirm */}
            {showLeaveConfirm && selectedConversation?.type === "GROUP" && (
              <div
          className="discord-modal-scrim fixed inset-0 z-2180 flex items-center justify-center p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowLeaveConfirm(false);
                }}
                role="presentation"
              >
                <div
                  className="discord-modal-card w-full max-w-md p-4"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Thoát khỏi đoạn chat</h3>
                    <button
                      type="button"
                      className="discord-icon-button flex size-8 items-center justify-center rounded-full bg-white/5"
                      onClick={() => setShowLeaveConfirm(false)}
                      disabled={isGroupLeaveDissolveLoading}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <p className="text-sm text-base-content/90">
                    Bạn có chắc muốn rời khỏi nhóm này? Bạn sẽ không còn nhận
                    tin nhắn từ đoạn chat này.
                  </p>
                  {myRole === "OWNER" ? (
                    ownerLeaveSuccessor ? (
                      <p className="mt-2 text-sm text-warning/90">
                        Quyền chủ nhóm sẽ chuyển cho{" "}
                        <span className="font-medium">
                          {ownerLeaveSuccessor.fullName ||
                            ownerLeaveSuccessor.userId}
                        </span>
                        .
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-warning">
                        Cần bổ nhiệm ít nhất một admin trước khi rời nhóm.
                      </p>
                    )
                  ) : null}
                  <p className="mt-2 text-sm">
                    Nhóm: <span className="font-medium">{title}</span>
                  </p>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      className="btn"
                      disabled={isGroupLeaveDissolveLoading}
                      onClick={() => setShowLeaveConfirm(false)}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={
                        isGroupLeaveDissolveLoading ||
                        (myRole === "OWNER" && !ownerLeaveSuccessor)
                      }
                      onClick={() => performLeaveGroup()}
                    >
                      {isGroupLeaveDissolveLoading
                        ? "Đang xử lý..."
                        : "Thoát nhóm"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Add member modal */}
            {showAddMemberModal && selectedConversation?.type === "GROUP" && (
              <div
          className="discord-modal-scrim fixed inset-0 z-2160 flex items-center justify-center p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget)
                    setShowAddMemberModal(false);
                }}
                role="presentation"
              >
                <div
                  className="discord-modal-card w-full max-w-md p-4"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Thêm thành viên</h3>
                    <button
                      type="button"
                      className="discord-icon-button flex size-8 items-center justify-center rounded-full bg-white/5"
                      onClick={() => setShowAddMemberModal(false)}
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {(() => {
                    const existing = new Set(
                      members.map((m) => String(m.userId)),
                    );

                    const recentDmCandidates = (() => {
                      const convs = useChatStore.getState().conversations || [];
                      const sorted = convs
                        .filter((c) => c && c.type === "DM" && c.otherUserId)
                        .slice()
                        .sort((a, b) => {
                          const ta = String(
                            a?.lastMessageAt || a?.lastMessage?.createdAt || "",
                          );
                          const tb = String(
                            b?.lastMessageAt || b?.lastMessage?.createdAt || "",
                          );
                          return tb.localeCompare(ta);
                        });

                      const out = [];
                      const seen = new Set();
                      for (const c of sorted) {
                        const uid = String(c.otherUserId || "");
                        if (!uid) continue;
                        if (existing.has(uid)) continue;
                        if (seen.has(uid)) continue;
                        seen.add(uid);
                        const u = users.find((x) => String(x._id) === uid);
                        out.push({
                          userId: uid,
                          fullName: u?.fullName || "User",
                          email: u?.email || "",
                          profilePic: u?.profilePic || "/avatar.png",
                        });
                        if (out.length >= 5) break;
                      }
                      return out;
                    })();

                    return (
                      <>
                        <div className="space-y-3">
                          <div>
                            <div className="text-sm font-medium mb-1">
                              Thêm bằng email
                            </div>
                            <div className="flex gap-2">
                              <input
                                className="input discord-input-reset w-full rounded-xl border border-white/10 bg-black/10 px-4"
                                placeholder="Nhập email"
                                value={addMemberEmail}
                                onChange={(e) =>
                                  setAddMemberEmail(e.target.value)
                                }
                                disabled={isMemberActionLoading}
                                inputMode="email"
                                autoComplete="off"
                              />
                              <button
                                type="button"
                                className="btn btn-primary rounded-lg border-0"
                                disabled={
                                  !String(addMemberEmail || "").trim() ||
                                  isMemberActionLoading
                                }
                                onClick={async () => {
                                  const email = String(addMemberEmail || "")
                                    .trim()
                                    .toLowerCase();
                                  const u = users.find(
                                    (x) =>
                                      String(x?.email || "")
                                        .trim()
                                        .toLowerCase() === email,
                                  );
                                  if (!u?._id) {
                                    toast.error(
                                      "Không tìm thấy người dùng với email này",
                                    );
                                    return;
                                  }
                                  const uid = String(u._id);
                                  if (existing.has(uid)) {
                                    toast.error(
                                      "Người dùng đã là thành viên trong nhóm",
                                    );
                                    return;
                                  }
                                  await addMemberToGroup(uid);
                                  setAddMemberEmail("");
                                }}
                              >
                                Thêm
                              </button>
                            </div>
                          </div>

                          <div>
                            <div className="text-sm font-medium mb-2">
                              Gợi ý (5 cuộc trò chuyện gần nhất)
                            </div>
                            {recentDmCandidates.length === 0 ? (
                              <div className="text-sm text-base-content/60">
                                Không có gợi ý phù hợp.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {recentDmCandidates.map((c) => (
                                  <button
                                    key={`recent_add_${c.userId}`}
                                    type="button"
                                    className="w-full flex items-center gap-3 rounded-lg border border-base-300 bg-base-100 px-3 py-2 hover:bg-base-200/60 transition"
                                    disabled={isMemberActionLoading}
                                    onClick={() => addMemberToGroup(c.userId)}
                                  >
                                    <img
                                      src={c.profilePic}
                                      alt={c.fullName}
                                      className="size-8 rounded-full object-cover border border-base-300"
                                    />
                                    <div className="min-w-0 text-left">
                                      <div className="text-sm font-medium truncate">
                                        {c.fullName}
                                      </div>
                                      <div className="text-xs text-base-content/60 truncate">
                                        {c.email || "—"}
                                      </div>
                                    </div>
                                    <div className="ml-auto text-sm font-medium text-primary">
                                      + Add
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 flex justify-end gap-2">
                          <button
                            type="button"
                            className="btn"
                            onClick={() => setShowAddMemberModal(false)}
                          >
                            Hủy
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}

      <MessageSearchModal
        open={showMessageSearchModal}
        onClose={() => setShowMessageSearchModal(false)}
        conversationId={selectedConversation?.conversationId}
        isGroup={isGroup}
        onJumpComplete={() => setShowSettings(false)}
      />
    </>
  );
};
export default ChatHeader;

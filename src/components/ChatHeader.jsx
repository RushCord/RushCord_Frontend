import { ArrowLeft, Hash, Phone, Pin, Search, Settings2, Users, X } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { axiosInstance } from "../lib/axios";
import { useEffect, useMemo, useState } from "react";
import { uploadFileViaPresign } from "../lib/uploadMedia.js";
import toast from "react-hot-toast";

const ChatHeader = ({ onCall, callDisabled = false }) => {
  const { selectedConversation, setSelectedConversation, users } = useChatStore();
  const { onlineUsers, authUser } = useAuthStore();

  const [showSettings, setShowSettings] = useState(false);
  const [settingsTitle, setSettingsTitle] = useState("");
  const [settingsAvatar, setSettingsAvatar] = useState("");
  const [myRole, setMyRole] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null); // "chatSettings" | null
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
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
  const [avatarUploadFileName, setAvatarUploadFileName] = useState("");

  const isGroup = selectedConversation?.type === "GROUP";
  const canEdit = isGroup && myRole === "OWNER";

  const title = (() => {
    if (!selectedConversation) return "";
    if (selectedConversation.type === "GROUP") return selectedConversation.title || "Group";
    const otherId = selectedConversation.otherUserId;
    const u = users.find((x) => String(x._id) === String(otherId));
    return u?.fullName || "Direct message";
  })();

  const avatarUrl = (() => {
    if (!selectedConversation) return "/avatar.png";
    if (selectedConversation.type === "GROUP") return selectedConversation.avatar || "/avatar.png";
    const otherId = selectedConversation.otherUserId;
    const u = users.find((x) => String(x._id) === String(otherId));
    return u?.profilePic || "/avatar.png";
  })();

  const online = (() => {
    if (!selectedConversation) return false;
    if (selectedConversation.type === "GROUP") return false;
    const otherId = selectedConversation.otherUserId;
    return onlineUsers.includes(otherId);
  })();

  useEffect(() => {
    if (!showSettings) return;
    if (!selectedConversation?.conversationId) return;
    if (selectedConversation.type !== "GROUP") return;

    setSettingsTitle(selectedConversation.title || "");
    setSettingsAvatar(selectedConversation.avatar || "");
    setExpandedSection("chatSettings");
    setShowRenameModal(false);
    setShowAvatarModal(false);
    setMembers([]);

    let cancelled = false;
    (async () => {
      try {
        const cid = encodeURIComponent(String(selectedConversation.conversationId));
        const res = await axiosInstance.get(`/conversations/${cid}/members`);
        const items = Array.isArray(res.data) ? res.data : [];
        const mine = items.find((m) => String(m.userId) === String(authUser?._id));
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

  async function loadMembers() {
    if (!selectedConversation?.conversationId) return;
    if (selectedConversation.type !== "GROUP") return;
    setIsMembersLoading(true);
    try {
      const cid = encodeURIComponent(String(selectedConversation.conversationId));
      const res = await axiosInstance.get(`/conversations/${cid}/members`);
      const items = Array.isArray(res.data) ? res.data : [];
      setMembers(items);
    } finally {
      setIsMembersLoading(false);
    }
  }

  async function leaveGroup() {
    if (!selectedConversation?.conversationId) return;
    const cidRaw = String(selectedConversation.conversationId);
    const ok = window.confirm("Bạn có chắc muốn thoát khỏi đoạn chat nhóm này?");
    if (!ok) return;
    try {
      const cid = encodeURIComponent(cidRaw);
      await axiosInstance.post(`/conversations/${cid}/leave`);
      try {
        await useChatStore.getState().getConversations();
      } catch {
        // ignore
      }
      setShowSettings(false);
      setSelectedConversation(null);
    } catch (e) {
      const msg = e?.response?.data?.error || e?.response?.data?.message || "Không thể thoát nhóm";
      // fallback toast via alert to avoid adding new deps here
      window.alert(msg);
    }
  }

  async function dissolveGroup() {
    if (!selectedConversation?.conversationId) return;
    const cidRaw = String(selectedConversation.conversationId);
    const ok = window.confirm("Giải tán nhóm sẽ xóa nhóm với tất cả thành viên. Bạn chắc chắn chứ?");
    if (!ok) return;
    try {
      const cid = encodeURIComponent(cidRaw);
      await axiosInstance.delete(`/conversations/${cid}`);
      try {
        await useChatStore.getState().getConversations();
      } catch {
        // ignore
      }
      setShowSettings(false);
      setSelectedConversation(null);
    } catch (e) {
      const msg = e?.response?.data?.error || e?.response?.data?.message || "Không thể giải tán nhóm";
      window.alert(msg);
    }
  }

  async function changeMemberRole(targetUserId, role) {
    if (!selectedConversation?.conversationId) return;
    const cid = encodeURIComponent(String(selectedConversation.conversationId));
    setIsMemberActionLoading(true);
    try {
      await axiosInstance.patch(`/conversations/${cid}/members/${targetUserId}`, {
        role,
      });
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
      await axiosInstance.delete(`/conversations/${cid}/members/${targetUserId}`);
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
      showAddMemberModal ||
      showRoleModal ||
      showRemoveConfirm;
    document.body.classList.toggle("mobile-overlay-active", hasMobileOverlay);
    return () => {
      document.body.classList.remove("mobile-overlay-active");
    };
  }, [
    showSettings,
    showRenameModal,
    showAvatarModal,
    showAddMemberModal,
    showRoleModal,
    showRemoveConfirm,
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

  return (
    <div className="discord-topbar mobile-chat-header px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-white/5 text-base-content/70">
            {selectedConversation?.type === "GROUP" ? (
              <Hash className="size-4" />
            ) : (
              <img src={avatarUrl} alt={title} className="size-9 rounded-full object-cover" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{title}</h3>
              {selectedConversation?.type === "GROUP" && (
                <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-base-content/60">
                  text
                </span>
              )}
            </div>
            <p className="text-xs text-base-content/60">
              {selectedConversation?.type === "DM"
                ? online
                  ? "Online now"
                  : "Offline"
                : "Group conversation"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            className="discord-icon-button hidden size-9 items-center justify-center rounded-full md:flex disabled:opacity-40"
            title="Pinned messages"
            aria-label="Pinned messages"
          >
            <Pin className="size-4" />
          </button>
          <button
            type="button"
            disabled
            className="discord-icon-button hidden size-9 items-center justify-center rounded-full md:flex disabled:opacity-40"
            title="Search"
            aria-label="Search"
          >
            <Search className="size-4" />
          </button>
          <button
            type="button"
            onClick={onCall}
            disabled={callDisabled || !selectedConversation}
            className="btn btn-sm btn-circle bg-green-500 hover:bg-green-600 border-0 text-white disabled:opacity-50 disabled:bg-green-500 disabled:text-white"
            title={
              callDisabled
                ? "Chưa chọn hội thoại"
                : selectedConversation?.type === "GROUP"
                  ? "Gọi nhóm"
                  : "Gọi"
            }
            aria-label="Call"
          >
            <Phone className="w-4 h-4" />
          </button>

          {selectedConversation?.type === "GROUP" && (
            <button
              type="button"
              className="discord-icon-button flex size-9 items-center justify-center rounded-full bg-white/5"
              title="Members and settings"
              aria-label="Members and settings"
              onClick={() => setShowSettings((prev) => !prev)}
            >
              <Users className="size-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowSettings((prev) => !prev)}
            className={`discord-icon-button hidden size-9 items-center justify-center rounded-full bg-white/5 lg:flex ${
              showSettings ? "is-active" : ""
            }`}
            aria-label="Toggle details"
            title="Toggle details"
          >
            <Settings2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setSelectedConversation(null)}
            aria-label="Close"
            className="discord-icon-button flex size-9 items-center justify-center rounded-full bg-white/5"
          >
            <ArrowLeft className="size-4 md:hidden" />
            <X className="hidden size-4 md:block" />
          </button>
        </div>
      </div>

      {showSettings && selectedConversation?.type === "GROUP" && (
        <div className="fixed inset-0 z-[400] md:pointer-events-none" role="presentation">
          <div
            className="discord-modal-scrim absolute inset-0 md:hidden"
            onClick={() => setShowSettings(false)}
          />

          <div
            className="mobile-group-settings-drawer desktop-group-settings-drawer absolute right-0 top-0 h-full w-full max-w-md border-l border-white/10 bg-[var(--discord-sidebar)] shadow-2xl md:pointer-events-auto"
            role="dialog"
            aria-modal="true"
          >
            <div className="h-full flex flex-col">
              <div className="discord-topbar flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="discord-section-title mb-1">Members</div>
                  <h2 className="text-base-content font-semibold">Tuy chinh doan chat</h2>
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

                {/* Collapsible sections */}
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-lg border border-white/10 bg-black/10">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-3 hover:bg-white/5 transition"
                      onClick={() =>
                        setExpandedSection((s) => (s === "chatSettings" ? null : "chatSettings"))
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
                      <div className="px-3 pb-3 space-y-2">
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
                          Thay đổi ảnh
                        </button>

                        <div className="pt-2 border-t border-white/10" />

                        {myRole === "OWNER" ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-error w-full justify-start rounded-lg"
                            onClick={dissolveGroup}
                          >
                            Giải tán nhóm
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm w-full justify-start rounded-lg border-0 bg-white/5 hover:bg-white/10"
                            onClick={leaveGroup}
                          >
                            Thoát khỏi đoạn chat
                          </button>
                        )}

                        {/* no helper text; actions are disabled by permissions */}
                      </div>
                    )}
                  </div>

                  <div className="overflow-hidden rounded-lg border border-white/10 bg-black/10">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-3 hover:bg-white/5 transition"
                      onClick={async () => {
                        setExpandedSection((s) => (s === "members" ? null : "members"));
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
                              (isMe ? authUser?.profilePic : u?.profilePic) ||
                              "/avatar.png";
                            const isOnline = onlineUsers.includes(String(m.userId));
                            const targetRole = String(m.role || "MEMBER").toUpperCase();
                            const actorRole = String(myRole || "MEMBER").toUpperCase();
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
                                <div className="relative">
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

                                {(actorRole === "OWNER" || actorRole === "ADMIN") && (
                                  <div className="ml-auto relative">
                                    <button
                                      type="button"
                                      className="btn btn-xs rounded-md border-0 bg-white/5 hover:bg-white/10"
                                      disabled={!canManageTarget || isMemberActionLoading}
                                      onClick={(e) => {
                                        const r = e.currentTarget.getBoundingClientRect();
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
                            const actorRole = String(myRole || "MEMBER").toUpperCase();
                            const canAdd = actorRole === "OWNER" || actorRole === "ADMIN";
                            return (
                              <button
                                type="button"
                                className="btn btn-sm mt-2 w-full justify-start rounded-lg border-0 bg-primary/85 text-primary-content hover:bg-primary"
                                disabled={!canAdd || isMemberActionLoading}
                                onClick={() => setShowAddMemberModal(true)}
                              >
                                + Thêm thành viên
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

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
          className="discord-modal-scrim fixed inset-0 z-[420] flex items-center justify-center p-4"
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
              <h3 className="text-base-content font-semibold">Đổi tên đoạn chat</h3>
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
                        ? { ...s.selectedConversation, title: updated.title }
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
          className="discord-modal-scrim fixed inset-0 z-[420] flex items-center justify-center p-4"
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
              <h3 className="text-base-content font-semibold">Thay đổi ảnh</h3>
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
                  src={settingsAvatar?.trim() ? settingsAvatar : "/avatar.png"}
                  alt="preview"
                  className="size-12 rounded-full object-cover border border-white/10"
                  onError={(e) => {
                    e.currentTarget.src = "/avatar.png";
                  }}
                />
                <div className="text-xs text-base-content/60">
                  {settingsAvatar?.trim() ? "Ảnh hiện tại / đã chọn" : "Chưa có ảnh"}
                </div>
              </div>

              {canEdit && (
                <div>
                  <div className="text-sm text-base-content mb-1">Upload ảnh</div>
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
                      Đã chọn: <span className="font-medium">{avatarUploadFileName}</span>
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
                        ? { ...s.selectedConversation, avatar: updated.avatar }
                        : s.selectedConversation,
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

      {/* Fixed member menu (not clipped by overflow) */}
      {memberMenu && (
        <div
          className="fixed z-[430]"
          style={{
            left: memberMenu.x,
            top: memberMenu.y,
            transform: "translateX(-100%)",
          }}
          data-member-menu
        >
          {(() => {
            const m = members.find((x) => String(x.userId) === String(memberMenu.userId));
            const targetRole = String(m?.role || "MEMBER").toUpperCase();
            const actorRole = String(myRole || "MEMBER").toUpperCase();
            const canManageTarget = targetRole !== "OWNER" && (actorRole === "OWNER" || actorRole === "ADMIN");
            const canRemove =
              canManageTarget &&
              (actorRole === "OWNER" || (actorRole === "ADMIN" && targetRole === "MEMBER"));

            return (
              <div className="w-44 overflow-hidden rounded-lg border border-white/10 bg-[var(--discord-panel)] shadow-xl">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={!canManageTarget || isMemberActionLoading}
                  onClick={() => {
                    setRoleTargetUserId(memberMenu.userId);
                    setRoleSelected(targetRole === "ADMIN" ? "ADMIN" : "MEMBER");
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
          className="discord-modal-scrim fixed inset-0 z-[440] flex items-center justify-center p-4"
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
              const targetRole = String(roleTarget?.role || "MEMBER").toUpperCase();
              const isOwner = actorRole === "OWNER";
              const isAdmin = actorRole === "ADMIN";

              const canSetAdmin = (targetRole === "MEMBER") && (isOwner || isAdmin);
              const canSetMember = (targetRole === "ADMIN") && isOwner;

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
                        disabled={!canSetMember && targetRole !== "MEMBER"}
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
          className="discord-modal-scrim fixed inset-0 z-[440] flex items-center justify-center p-4"
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

      {/* Add member modal */}
      {showAddMemberModal && selectedConversation?.type === "GROUP" && (
        <div
          className="discord-modal-scrim fixed inset-0 z-[450] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddMemberModal(false);
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
              const existing = new Set(members.map((m) => String(m.userId)));

              const recentDmCandidates = (() => {
                const convs = useChatStore.getState().conversations || [];
                const sorted = convs
                  .filter((c) => c && c.type === "DM" && c.otherUserId)
                  .slice()
                  .sort((a, b) => {
                    const ta = String(a?.lastMessageAt || a?.lastMessage?.createdAt || "");
                    const tb = String(b?.lastMessageAt || b?.lastMessage?.createdAt || "");
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
                      <div className="text-sm font-medium mb-1">Thêm bằng email</div>
                      <div className="flex gap-2">
                        <input
                          className="input discord-input-reset w-full rounded-xl border border-white/10 bg-black/10 px-4"
                          placeholder="Nhập email"
                          value={addMemberEmail}
                          onChange={(e) => setAddMemberEmail(e.target.value)}
                          disabled={isMemberActionLoading}
                          inputMode="email"
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          className="btn btn-primary rounded-lg border-0"
                          disabled={!String(addMemberEmail || "").trim() || isMemberActionLoading}
                          onClick={async () => {
                            const email = String(addMemberEmail || "").trim().toLowerCase();
                            const u = users.find(
                              (x) =>
                                String(x?.email || "").trim().toLowerCase() === email,
                            );
                            if (!u?._id) {
                              toast.error("Không tìm thấy người dùng với email này");
                              return;
                            }
                            const uid = String(u._id);
                            if (existing.has(uid)) {
                              toast.error("Người dùng đã là thành viên trong nhóm");
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
                      <div className="text-sm font-medium mb-2">Gợi ý (5 cuộc trò chuyện gần nhất)</div>
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
    </div>
  );
};
export default ChatHeader;
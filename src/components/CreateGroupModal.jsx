import { useEffect, useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useChatStore } from "../store/useChatStore";
import {
  GROUP_TOPIC_OPTIONS,
  MAX_GROUP_DESCRIPTION_LENGTH,
} from "../constants/groupTopics";
import { uploadFileViaPresign } from "../lib/uploadMedia.js";

export default function CreateGroupModal({ open, onClose }) {
  const navigate = useNavigate();
  const {
    users,
    friends,
    getUsers,
    getFriends,
    createGroupConversation,
    isCreatingGroup,
  } = useChatStore();

  const [title, setTitle] = useState("");
  const [topicId, setTopicId] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [groupAvatar, setGroupAvatar] = useState("");
  const [groupCover, setGroupCover] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setTopicId("");
    setDescription("");
    setSearch("");
    setSelectedIds([]);
    setGroupAvatar("");
    setGroupCover("");
    getUsers();
    getFriends();
  }, [open, getUsers, getFriends]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => {
      if (e.key === "Escape" && !isCreatingGroup) onClose?.();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose, isCreatingGroup]);

  const friendCandidates = useMemo(() => {
    return (Array.isArray(friends) ? friends : [])
      .map((f) => {
        const uid = String(f.otherUserId || "");
        const u = users.find((x) => String(x._id) === uid);
        return {
          userId: uid,
          fullName: u?.fullName || "Bạn bè",
          email: u?.email || "",
          profilePic: u?.profilePic || "/avatar.png",
        };
      })
      .filter((f) => f.userId);
  }, [friends, users]);

  const filteredFriends = useMemo(() => {
    const q = String(search || "")
      .trim()
      .toLowerCase();
    if (!q) return friendCandidates;
    return friendCandidates.filter(
      (f) =>
        f.fullName.toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q),
    );
  }, [friendCandidates, search]);

  const toggleMember = (userId) => {
    setSelectedIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleCreate = async () => {
    const trimmedTitle = String(title || "").trim();
    if (!trimmedTitle) return;
    if (!topicId) return;
    if (selectedIds.length < 1) return;

    const conversation = await createGroupConversation({
      title: trimmedTitle,
      memberIds: selectedIds,
      topic: topicId,
      description,
      ...(groupAvatar ? { avatar: groupAvatar } : {}),
      ...(groupCover ? { cover: groupCover } : {}),
    });
    if (conversation) {
      onClose?.();
      navigate("/");
    }
  };

  if (!open) return null;

  const canCreate =
    String(title || "").trim().length > 0 &&
    Boolean(topicId) &&
    selectedIds.length >= 1 &&
    !isCreatingGroup &&
    !isUploadingAvatar &&
    !isUploadingCover;

  const descLen = String(description || "").length;

  return (
    <div
      className="discord-modal-scrim fixed inset-0 z-[2200] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isCreatingGroup) onClose?.();
      }}
      role="presentation"
    >
      <div
        className="discord-modal-card flex max-h-[min(92vh,720px)] w-full max-w-3xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-group-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
          <h3 id="create-group-title" className="text-lg font-semibold">
            Tạo nhóm mới
          </h3>
          <button
            type="button"
            className="discord-icon-button flex size-8 items-center justify-center rounded-full bg-white/5"
            onClick={() => onClose?.()}
            disabled={isCreatingGroup}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="discord-scroll shrink-0 space-y-5 overflow-y-auto border-b border-white/10 p-6 md:w-[min(42%,320px)] md:border-b-0 md:border-r">
          <div className="overflow-hidden rounded-xl border border-white/10">
            <div className="relative h-32 bg-gradient-to-r from-primary/30 via-purple-900/40 to-slate-900 sm:h-36">
              {groupCover ? (
                <img
                  src={groupCover}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
              <label className="absolute bottom-2 right-2 cursor-pointer rounded-full bg-black/50 px-2 py-1 text-xs text-white hover:bg-black/65">
                Ảnh bìa
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isCreatingGroup || isUploadingCover}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIsUploadingCover(true);
                    try {
                      const { publicUrl } = await uploadFileViaPresign(
                        file,
                        "cover",
                      );
                      setGroupCover(publicUrl);
                    } finally {
                      setIsUploadingCover(false);
                    }
                  }}
                />
              </label>
            </div>
            <div className="relative flex items-end gap-3 px-4 pb-4">
              <img
                src={groupAvatar || "/avatar.png"}
                alt=""
                className="-mt-8 size-16 shrink-0 rounded-full border-4 border-(--discord-panel) object-cover sm:size-[4.5rem]"
              />
              <label className="mb-1 inline-block cursor-pointer text-sm text-primary hover:underline">
                Ảnh đại diện
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isCreatingGroup || isUploadingAvatar}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIsUploadingAvatar(true);
                    try {
                      const { publicUrl } = await uploadFileViaPresign(
                        file,
                        "avatar",
                      );
                      setGroupAvatar(publicUrl);
                    } finally {
                      setIsUploadingAvatar(false);
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <div>
            <label
              htmlFor="group-name"
              className="mb-1.5 block text-sm font-medium"
            >
              Tên nhóm
            </label>
            <input
              id="group-name"
              className="input discord-input-reset w-full rounded-xl border border-white/10 bg-black/10 px-4"
              placeholder="Nhập tên nhóm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isCreatingGroup}
              maxLength={100}
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="group-topic"
              className="mb-1.5 block text-sm font-medium"
            >
              Chủ đề
            </label>
            <select
              id="group-topic"
              className="select discord-input-reset w-full rounded-xl border border-white/10 bg-black/10 px-4 py-2 text-sm"
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              disabled={isCreatingGroup}
              required
            >
              <option value="" disabled>
                — Chọn chủ đề —
              </option>
              {GROUP_TOPIC_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-base-content/50">
              Chỉ được chọn một trong các chủ đề có sẵn.
            </p>
          </div>

          <div>
            <label
              htmlFor="group-description"
              className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium"
            >
              <span>Mô tả nhóm</span>
              <span className="font-normal tabular-nums text-xs text-base-content/50">
                {descLen}/{MAX_GROUP_DESCRIPTION_LENGTH}
              </span>
            </label>
            <textarea
              id="group-description"
              className="textarea discord-input-reset min-h-[88px] w-full resize-y rounded-xl border border-white/10 bg-black/10 px-4 py-2 text-sm"
              placeholder="Giới thiệu ngắn về nhóm..."
              value={description}
              onChange={(e) =>
                setDescription(
                  String(e.target.value).slice(0, MAX_GROUP_DESCRIPTION_LENGTH),
                )
              }
              disabled={isCreatingGroup}
              maxLength={MAX_GROUP_DESCRIPTION_LENGTH}
              rows={3}
            />
          </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col p-6 md:min-h-[280px]">
            <div className="mb-3 shrink-0 text-sm font-medium">
              Thêm thành viên
              {selectedIds.length > 0 ? (
                <span className="ml-1 text-xs font-normal text-base-content/60">
                  ({selectedIds.length} đã chọn)
                </span>
              ) : null}
            </div>
            <div className="relative mb-3 shrink-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/50" />
              <input
                className="input discord-input-reset w-full rounded-xl border border-white/10 bg-black/10 py-2.5 pl-9 pr-4 text-sm"
                placeholder="Tìm bạn bè..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={isCreatingGroup}
              />
            </div>

            {selectedIds.length > 0 ? (
              <div className="mb-3 flex shrink-0 flex-wrap gap-1.5">
                {selectedIds.map((uid) => {
                  const f = friendCandidates.find((x) => x.userId === uid);
                  return (
                    <button
                      key={`sel_${uid}`}
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                      onClick={() => toggleMember(uid)}
                      disabled={isCreatingGroup}
                    >
                      {f?.fullName || "User"}
                      <X className="size-3" />
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="discord-scroll min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
              {filteredFriends.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-black/5 px-3 py-4 text-center text-sm text-base-content/60">
                  {friendCandidates.length === 0
                    ? "Chưa có bạn bè. Hãy kết bạn trước khi tạo nhóm."
                    : "Không tìm thấy bạn bè phù hợp."}
                </div>
              ) : (
                filteredFriends.map((f) => {
                  const selected = selectedIds.includes(f.userId);
                  return (
                    <button
                      key={f.userId}
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 transition ${
                        selected
                          ? "border-primary/40 bg-primary/10"
                          : "border-white/10 bg-black/5 hover:bg-white/5"
                      }`}
                      onClick={() => toggleMember(f.userId)}
                      disabled={isCreatingGroup}
                    >
                      <img
                        src={f.profilePic}
                        alt=""
                        className="size-9 rounded-full border border-white/10 object-cover"
                      />
                      <div className="min-w-0 flex-1 text-left">
                        <div className="truncate text-sm font-medium">
                          {f.fullName}
                        </div>
                        {f.email ? (
                          <div className="truncate text-xs text-base-content/60">
                            {f.email}
                          </div>
                        ) : null}
                      </div>
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                          selected
                            ? "border-primary bg-primary text-primary-content"
                            : "border-white/20"
                        }`}
                      >
                        {selected ? <Check className="size-3" /> : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-white/10 px-6 py-4">
          <button
            type="button"
            className="btn"
            onClick={() => onClose?.()}
            disabled={isCreatingGroup}
          >
            Hủy
          </button>
          <button
            type="button"
            className="btn btn-primary rounded-lg border-0"
            disabled={!canCreate}
            onClick={handleCreate}
          >
            {isCreatingGroup ? "Đang tạo..." : "Tạo nhóm"}
          </button>
        </div>
      </div>
    </div>
  );
}

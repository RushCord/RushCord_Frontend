import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users, Plus } from "lucide-react";
import { axiosInstance } from "../lib/axios";
import { formatMessageTime } from "../lib/utils";
import toast from "react-hot-toast";

const Sidebar = () => {
  const {
    getUsers,
    users,
    getConversations,
    conversations,
    friends,
    getFriends,
    selectedConversation,
    setSelectedConversation,
    isUsersLoading,
  } = useChatStore();

  const { onlineUsers, authUser } = useAuthStore();
  const [showCreate, setShowCreate] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [memberIds, setMemberIds] = useState([]);
  const [friendSearch, setFriendSearch] = useState("");
  const [memberEmail, setMemberEmail] = useState("");

  useEffect(() => {
    getUsers();
    getConversations();
    getFriends();
  }, [getUsers]);

  // recentConversations is managed elsewhere; sidebar uses `conversations` ordering for Recent list.

  const recentConversationsList = (() => {
    const items = Array.isArray(conversations) ? conversations : [];
    const sorted = items
      .slice()
      .sort((a, b) => {
        const ta = String(a?.lastMessageAt || a?.lastMessage?.createdAt || "");
        const tb = String(b?.lastMessageAt || b?.lastMessage?.createdAt || "");
        return tb.localeCompare(ta);
      });
    return sorted.slice(0, 10);
  })();

  const recentDmUserIds = (() => {
    const me = String(authUser?._id || "");
    const out = [];
    const seen = new Set();
    for (const c of recentConversationsList) {
      if (!c || c.type !== "DM") continue;
      const id = String(c.otherUserId || "");
      if (!id || id === me) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      if (out.length >= 10) break;
    }
    return out;
  })();

  const selectedMembers = (() => {
    const me = String(authUser?._id || "");
    const ids = Array.isArray(memberIds) ? memberIds : [];
    return ids
      .map((id) => {
        const uid = String(id || "");
        if (!uid || uid === me) return null;
        const u = users.find((x) => String(x._id) === uid);
        return {
          _id: uid,
          fullName: u?.fullName || "User",
          email: u?.email || "",
          profilePic: u?.profilePic || "/avatar.png",
        };
      })
      .filter(Boolean);
  })();

  const friendMatches = (() => {
    const q = String(friendSearch || "").trim().toLowerCase();
    if (!q) return [];
    const items = Array.isArray(friends) ? friends : [];
    const mapped = items
      .map((f) => {
        const otherId = f?.otherUserId;
        const u = users.find((x) => String(x._id) === String(otherId));
        const fullName = String(u?.fullName || "").trim();
        const email = String(u?.email || "").trim();
        const hay = `${fullName} ${email}`.toLowerCase();
        if (!hay.includes(q)) return null;
        return {
          otherUserId: otherId,
          fullName: fullName || "Friend",
          email,
          profilePic: u?.profilePic || "/avatar.png",
        };
      })
      .filter(Boolean);
    mapped.sort((a, b) => String(a.fullName).localeCompare(String(b.fullName)));
    return mapped.slice(0, 10);
  })();

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className="h-full w-full flex flex-col transition-all duration-200">
      <div className="border-b border-base-300 w-full p-5">
        <div className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-6" />
            <span className="font-medium hidden lg:block">Conversations</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-xs btn-circle"
              title="Create group"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-3 relative hidden lg:block">
          <input
            className="input input-bordered input-sm w-full"
            placeholder="Search friends by name or email..."
            value={friendSearch}
            onChange={(e) => setFriendSearch(e.target.value)}
          />

          {String(friendSearch || "").trim() && (
            <div className="absolute mt-2 w-full z-40">
              <div className="rounded-xl border border-base-300 bg-base-100 shadow-xl overflow-hidden">
                {friendMatches.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-base-content/60">
                    No matching friends
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {friendMatches.map((m) => {
                      const isOnline = onlineUsers.includes(String(m.otherUserId));
                      return (
                        <button
                          key={m.otherUserId}
                          type="button"
                          className="w-full px-3 py-2 flex items-center gap-3 hover:bg-base-200 text-left"
                          onClick={() => {
                            setSelectedConversation({
                              conversationId: `DM#${[String(useAuthStore.getState().authUser?._id || ""), String(m.otherUserId || "")].sort().join("#")}`,
                              type: "DM",
                              otherUserId: m.otherUserId,
                            });
                            setFriendSearch("");
                          }}
                        >
                          <div className="relative">
                            <img
                              src={m.profilePic}
                              alt={m.fullName}
                              className="size-9 rounded-full object-cover border border-base-300"
                            />
                            {isOnline && (
                              <span className="absolute bottom-0 right-0 size-2.5 bg-green-500 rounded-full ring-2 ring-base-100" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {m.fullName}
                            </div>
                            <div className="text-xs text-base-content/60 truncate">
                              {m.email || "—"}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-y-auto w-full py-3">
        <div className="hidden lg:block px-3 pb-3">
          <div className="text-xs text-base-content/60 mb-2">Recent</div>

          {recentConversationsList.length === 0 ? (
            <div className="text-sm text-base-content/60 py-2">
              No recent conversations
            </div>
          ) : (
            <div className="space-y-1">
              {recentConversationsList.map((c) => {
                const isSelected =
                  String(selectedConversation?.conversationId) ===
                  String(c.conversationId);
                const isGroup = c.type === "GROUP";
                const other =
                  !isGroup &&
                  users.find((u) => String(u._id) === String(c.otherUserId));
                const title = isGroup
                  ? c.title || "Group"
                  : other?.fullName || "Direct message";
                const avatar = isGroup
                  ? c.avatar || "/avatar.png"
                  : other?.profilePic || "/avatar.png";

                const last = c.lastMessage;
                const previewBody = (() => {
                  if (last?.isRecalled) return "Tin nhắn đã bị thu hồi";
                  if (last?.isDeletedForMe) return "Đã ẩn tin nhắn";
                  if (typeof last?.text === "string" && last.text.trim().length > 0)
                    return last.text;
                  if (last?.image || (Array.isArray(last?.images) && last.images.length > 0))
                    return "[Hình ảnh]";
                  if (last?.file) return "[Tệp]";
                  return "";
                })();

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
                    className={[
                      "w-full p-2 flex items-center gap-3 rounded-lg",
                      "hover:bg-base-200 transition-colors",
                      isSelected ? "bg-base-200 ring-1 ring-base-300" : "",
                    ].join(" ")}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={avatar}
                        alt={title}
                        className="size-9 object-cover rounded-full border border-base-300"
                      />
                      {!isGroup && other && onlineUsers.includes(other._id) && (
                        <span className="absolute bottom-0 right-0 size-2.5 bg-green-500 rounded-full ring-2 ring-base-100" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium truncate">{title}</div>
                        {timeLabel ? (
                          <div className="ml-auto text-[11px] text-base-content/50 tabular-nums">
                            {timeLabel}
                          </div>
                        ) : null}
                      </div>
                      <div className="text-xs text-base-content/60 truncate">
                        {previewText || (isGroup ? "Group" : "Direct message")}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreate(false);
          }}
          role="presentation"
        >
          <div
            className="bg-base-100 rounded-xl w-full max-w-lg border border-base-300 shadow-xl p-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Create group</h2>
              <button
                type="button"
                className="btn btn-xs"
                onClick={() => setShowCreate(false)}
              >
                Close
              </button>
            </div>

            <input
              className="input input-bordered w-full mb-3"
              placeholder="Group title"
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
            />

            <div className="space-y-3">
              {/* Add member by email */}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  className="input input-bordered flex-1"
                  placeholder="Add member by email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  inputMode="email"
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!String(memberEmail || "").trim()}
                  onClick={() => {
                    const email = String(memberEmail || "").trim().toLowerCase();
                    const u = users.find(
                      (x) => String(x?.email || "").trim().toLowerCase() === email,
                    );
                    if (!u?._id) {
                      toast.error("Không tìm thấy người dùng với email này");
                      return;
                    }
                    const me = String(authUser?._id || "");
                    if (String(u._id) === me) {
                      toast.error("Không thể thêm chính bạn");
                      return;
                    }
                    setMemberIds((prev) => {
                      const cur = Array.isArray(prev) ? prev : [];
                      if (cur.includes(u._id)) return cur;
                      return [...cur, u._id];
                    });
                    setMemberEmail("");
                  }}
                >
                  Add
                </button>
              </div>

              {/* Selected members preview */}
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedMembers.map((m) => (
                    <div
                      key={`sel_${m._id}`}
                      className="flex items-center gap-2 rounded-full border border-base-300 bg-base-200 px-2 py-1"
                      title={m.email || m.fullName}
                    >
                      <img
                        src={m.profilePic}
                        alt={m.fullName}
                        className="size-6 rounded-full object-cover border border-base-300"
                      />
                      <div className="max-w-44 truncate text-sm">
                        {m.fullName}
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() =>
                          setMemberIds((prev) =>
                            (Array.isArray(prev) ? prev : []).filter(
                              (x) => String(x) !== String(m._id),
                            ),
                          )
                        }
                        aria-label="Remove"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Top 10 recent DM suggestions */}
              <div>
                <div className="text-xs text-base-content/60 mb-2">
                  Recent conversations (top 10)
                </div>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {recentDmUserIds.length === 0 ? (
                    <div className="text-sm text-base-content/60">
                      No recent friends to suggest.
                    </div>
                  ) : (
                    recentDmUserIds.map((uid) => {
                      const u = users.find((x) => String(x._id) === String(uid));
                      const checked = memberIds.includes(uid);
                      const name = u?.fullName || "User";
                      const email = u?.email || "";
                      return (
                        <label
                          key={`recent_${uid}`}
                          className="flex items-center gap-3 cursor-pointer rounded-lg border border-base-300 bg-base-100 px-3 py-2 hover:bg-base-200/60"
                        >
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={checked}
                            onChange={(e) => {
                              const on = e.target.checked;
                              setMemberIds((prev) => {
                                const cur = Array.isArray(prev) ? prev : [];
                                return on
                                  ? cur.includes(uid)
                                    ? cur
                                    : [...cur, uid]
                                  : cur.filter((x) => String(x) !== String(uid));
                              });
                            }}
                          />
                          <img
                            src={u?.profilePic || "/avatar.png"}
                            alt={name}
                            className="size-8 rounded-full object-cover border border-base-300"
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate text-base-content">
                              {name}
                            </div>
                            <div className="text-xs text-base-content/60 truncate">
                              {email || "—"}
                            </div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    await axiosInstance.post("/conversations", {
                      title: groupTitle,
                      memberIds,
                    });
                    setShowCreate(false);
                    setGroupTitle("");
                    setMemberIds([]);
                    setMemberEmail("");
                    await getConversations();
                  } catch (err) {
                    console.error(err);
                  }
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
export default Sidebar;
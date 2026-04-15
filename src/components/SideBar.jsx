import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users } from "lucide-react";

const Sidebar = () => {
  const {
    getUsers,
    users,
    selectedUser,
    setSelectedUser,
    isUsersLoading,
    recentConversations,
  } = useChatStore();

  const { onlineUsers } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  const baseUsers = showOnlineOnly
    ? users.filter((user) => onlineUsers.includes(user._id))
    : users;

  // Sort contacts by recent conversations cache (top 10), keep others after.
  const recentItems = Array.isArray(recentConversations?.items)
    ? recentConversations.items
    : [];
  const rank = new Map(recentItems.map((it, idx) => [String(it.otherUserId), idx]));
  const filteredUsers = [...baseUsers].sort((a, b) => {
    const ra = rank.has(String(a._id)) ? rank.get(String(a._id)) : 9999;
    const rb = rank.has(String(b._id)) ? rank.get(String(b._id)) : 9999;
    return ra - rb;
  });

  const lastPreviewByUserId = new Map(
    recentItems
      .filter((it) => it && it.otherUserId)
      .map((it) => [String(it.otherUserId), it])
  );

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className="h-full w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200">
      <div className="border-b border-base-300 w-full p-5">
        <div className="flex items-center gap-2">
          <Users className="size-6" />
          <span className="font-medium hidden lg:block">Contacts</span>
        </div>
        {/* TODO: Online filter toggle */}
        <div className="mt-3 hidden lg:flex items-center gap-2">
          <label className="cursor-pointer flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(e) => setShowOnlineOnly(e.target.checked)}
              className="checkbox checkbox-sm"
            />
            <span className="text-sm">Show online only</span>
          </label>
          <span className="text-xs text-zinc-500">({onlineUsers.length - 1} online)</span>
        </div>
      </div>

      <div className="overflow-y-auto w-full py-3">
        {filteredUsers.map((user) => (
          (() => {
            const prev = lastPreviewByUserId.get(String(user._id));
            const last = prev?.lastMessage;
            const previewText =
              last?.isRecalled
                ? "Tin nhắn đã bị thu hồi"
                : last?.isDeletedForMe
                  ? "Đã ẩn tin nhắn"
                  : typeof last?.text === "string" && last.text.trim().length > 0
                    ? last.text
                    : last?.image || (Array.isArray(last?.images) && last.images.length > 0)
                      ? "[Hình ảnh]"
                      : last?.file
                        ? "[Tệp]"
                        : "";
            return (
          <button
            key={user._id}
            onClick={() => setSelectedUser(user)}
            className={`
              w-full p-3 flex items-center gap-3
              hover:bg-base-300 transition-colors
              ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
            `}
          >
            <div className="relative mx-auto lg:mx-0">
              <img
                src={user.profilePic || "/avatar.png"}
                alt={user.name}
                className="size-12 object-cover rounded-full"
              />
              {onlineUsers.includes(user._id) && (
                <span
                  className="absolute bottom-0 right-0 size-3 bg-green-500 
                  rounded-full ring-2 ring-zinc-900"
                />
              )}
            </div>

            {/* User info - only visible on larger screens */}
            <div className="hidden lg:block text-left min-w-0">
              <div className="font-medium truncate">{user.fullName}</div>
              <div className="text-sm text-zinc-400">
                {previewText ? (
                  <span className="truncate block">{previewText}</span>
                ) : (
                  <span>{onlineUsers.includes(user._id) ? "Online" : "Offline"}</span>
                )}
              </div>
            </div>
          </button>
            );
          })()
        ))}

        {filteredUsers.length === 0 && (
          <div className="text-center text-zinc-500 py-4">No online users</div>
        )}
      </div>
    </aside>
  );
};
export default Sidebar;
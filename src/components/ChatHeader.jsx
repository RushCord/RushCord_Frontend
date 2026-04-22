import { AlertCircle, Phone, X } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const ChatHeader = ({ onCall, callDisabled = false }) => {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
            </div>
          </div>

          {/* User info */}
          <div>
            <h3 className="font-medium">{selectedUser.fullName}</h3>
            <p className="text-sm text-base-content/70">
              {onlineUsers.includes(selectedUser._id) ? "Online" : "Offline"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCall}
            disabled={callDisabled}
            className="btn btn-sm btn-circle bg-green-500 hover:bg-green-600 border-0 text-white disabled:opacity-50 disabled:bg-green-500 disabled:text-white"
            title={callDisabled ? "Chưa chọn người" : `Gọi ${selectedUser.fullName}`}
            aria-label="Call"
          >
            <Phone className="w-4 h-4" />
          </button>

          <button
            type="button"
            disabled
            className="btn btn-sm btn-circle bg-base-200 hover:bg-base-300 border border-base-300 text-base-content opacity-50 cursor-not-allowed"
            title="Xem chi tiết (tạm thời tắt)"
            aria-label="Details (disabled)"
          >
            <AlertCircle className="w-4 h-4" />
          </button>

          {/* Close button */}
          <button type="button" onClick={() => setSelectedUser(null)} aria-label="Close">
            <X />
          </button>
        </div>
      </div>
    </div>
  );
};
export default ChatHeader;
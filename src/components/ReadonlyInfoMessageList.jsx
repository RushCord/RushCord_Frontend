import { formatMessageTime } from "../lib/utils";
import {
  AI_BOT_SENDER_ID,
  RUSHCORD_AI_AVATAR_URL,
  RUSHCORD_AI_DISPLAY_NAME,
} from "../lib/aiChatUtils";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

function senderLabel(message, authUser, users) {
  const sid = String(message?.senderId || "");
  if (sid === String(authUser?._id || "")) return authUser?.fullName || "Bạn";
  if (sid === AI_BOT_SENDER_ID) return RUSHCORD_AI_DISPLAY_NAME;
  const u = users.find((x) => String(x._id) === sid);
  return u?.fullName || sid || "Người dùng";
}

function senderAvatar(message, authUser, users) {
  const sid = String(message?.senderId || "");
  if (sid === String(authUser?._id || "")) {
    return authUser?.profilePic || "/avatar.png";
  }
  if (sid === AI_BOT_SENDER_ID) {
    return RUSHCORD_AI_AVATAR_URL;
  }
  const u = users.find((x) => String(x._id) === sid);
  return u?.profilePic || "/avatar.png";
}

export default function ReadonlyInfoMessageList({ messages = [] }) {
  const authUser = useAuthStore((s) => s.authUser);
  const users = useChatStore((s) => s.users);

  if (!messages.length) {
    return (
      <p className="py-6 text-center text-sm italic text-base-content/50">
        Chưa có thông báo trong kênh này.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <article
          key={message._id}
          className="flex gap-3 rounded-lg border border-white/5 bg-black/10 px-3 py-3"
        >
          <img
            src={senderAvatar(message, authUser, users)}
            alt=""
            className="size-10 shrink-0 rounded-full border border-white/10 object-cover"
            onError={(e) => {
              e.currentTarget.src = "/avatar.png";
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-semibold">
                {senderLabel(message, authUser, users)}
              </span>
              <time className="text-[11px] text-base-content/50">
                {formatMessageTime(message.createdAt)}
              </time>
            </div>
            {message.isRecalled ? (
              <p className="text-sm italic text-base-content/50">Tin đã thu hồi</p>
            ) : message.isDeletedForMe ? (
              <p className="text-sm italic text-base-content/50">Tin đã xóa</p>
            ) : (
              <div className="space-y-2 text-sm text-base-content/90">
                {Array.isArray(message.images) && message.images.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {message.images.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block max-w-xs overflow-hidden rounded-lg border border-white/10"
                      >
                        <img src={url} alt="" className="max-h-48 object-cover" />
                      </a>
                    ))}
                  </div>
                ) : null}
                {message.image ? (
                  <a
                    href={message.image}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block max-w-xs overflow-hidden rounded-lg border border-white/10"
                  >
                    <img src={message.image} alt="" className="max-h-48 object-cover" />
                  </a>
                ) : null}
                {message.file ? (
                  <a
                    href={message.file}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    {message.fileName || "Tệp đính kèm"}
                  </a>
                ) : null}
                {message.text ? <p className="whitespace-pre-wrap">{message.text}</p> : null}
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

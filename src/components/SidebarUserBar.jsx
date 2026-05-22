import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Headphones,
  HeadphoneOff,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Settings,
  Video,
  VideoOff,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import UserSettingsModal from "./UserSettingsModal";

export default function SidebarUserBar() {
  const navigate = useNavigate();
  const { authUser, onlineUsers } = useAuthStore();
  const [showUserSettings, setShowUserSettings] = useState(false);

  const voiceSession = useChatStore((s) => s.voiceSession);
  const dmCallActive = useChatStore((s) => s.dmCallActive);
  const voiceMicMuted = useChatStore((s) => s.voiceMicMuted);
  const voiceOutputMuted = useChatStore((s) => s.voiceOutputMuted);
  const voiceVideoEnabled = useChatStore((s) => s.voiceVideoEnabled);
  const toggleVoiceMic = useChatStore((s) => s.toggleVoiceMic);
  const toggleVoiceOutput = useChatStore((s) => s.toggleVoiceOutput);
  const toggleVoiceVideo = useChatStore((s) => s.toggleVoiceVideo);
  const voiceScreenShareEnabled = useChatStore((s) => s.voiceScreenShareEnabled);
  const toggleVoiceScreenShare = useChatStore((s) => s.toggleVoiceScreenShare);
  const requestLeaveVoice = useChatStore((s) => s.requestLeaveVoice);

  const screenShareSupported =
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function";

  const inVoice = Boolean(voiceSession) || dmCallActive;
  const inGroupVoice = Boolean(voiceSession);
  const isOnline = onlineUsers.includes(String(authUser?._id));

  const statusLabel = voiceSession
    ? "Trong kênh thoại"
    : dmCallActive
      ? "Trong cuộc gọi"
      : isOnline
        ? "Online"
        : "Offline";

  const controlBtnClass = (active, disabled = false) =>
    [
      "flex size-8 items-center justify-center rounded transition",
      active
        ? "bg-red-500/25 text-red-400 hover:bg-red-500/35"
        : "text-(--discord-text-muted) hover:bg-(--discord-hover) hover:text-(--discord-text)",
      disabled || !inVoice ? "cursor-not-allowed opacity-40" : "",
    ].join(" ");

  const voiceControlBtnClass = (active, disabled = false) =>
    [
      "flex size-9 items-center justify-center rounded-md transition",
      active
        ? "bg-red-500/25 text-red-400 hover:bg-red-500/35"
        : "bg-(--discord-hover) text-(--discord-text-muted) hover:text-(--discord-text)",
      disabled ? "cursor-not-allowed opacity-40" : "",
    ].join(" ");

  return (
    <>
      <div className="fixed bottom-0 left-0 z-50 hidden w-[312px] md:block">
        {inGroupVoice ? (
          <div className="border-t border-(--discord-border) bg-(--discord-sidebar) px-3 py-2.5">
            <div className="flex items-center justify-center gap-2.5">
              <button
                type="button"
                className={voiceControlBtnClass(!voiceVideoEnabled)}
                title={voiceVideoEnabled ? "Tắt camera" : "Bật camera"}
                aria-label={voiceVideoEnabled ? "Tắt camera" : "Bật camera"}
                aria-pressed={!voiceVideoEnabled}
                onClick={() => toggleVoiceVideo()}
              >
                {voiceVideoEnabled ? (
                  <Video className="size-[18px]" />
                ) : (
                  <VideoOff className="size-[18px]" />
                )}
              </button>
              <button
                type="button"
                className={voiceControlBtnClass(
                  voiceScreenShareEnabled,
                  !screenShareSupported,
                )}
                title={
                  !screenShareSupported
                    ? "Trình duyệt không hỗ trợ chia sẻ màn hình"
                    : voiceScreenShareEnabled
                      ? "Dừng chia sẻ màn hình"
                      : "Chia sẻ màn hình"
                }
                aria-label={
                  voiceScreenShareEnabled
                    ? "Dừng chia sẻ màn hình"
                    : "Chia sẻ màn hình"
                }
                aria-pressed={voiceScreenShareEnabled}
                disabled={!screenShareSupported}
                onClick={() => screenShareSupported && toggleVoiceScreenShare()}
              >
                <MonitorUp className="size-[18px]" />
              </button>
              <button
                type="button"
                className="flex size-9 items-center justify-center rounded-md bg-red-500/20 text-red-400 transition hover:bg-red-500/35"
                title="Rời kênh thoại"
                aria-label="Rời kênh thoại"
                onClick={() => requestLeaveVoice()}
              >
                <PhoneOff className="size-[18px]" />
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex h-[52px] border-t border-(--discord-border) bg-(--discord-rail)">
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2 px-2 py-1.5">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                className="relative shrink-0 rounded-full transition hover:opacity-85"
                title="Profile"
                onClick={() => navigate("/profile")}
              >
                <img
                  src={authUser?.profilePic || "/avatar.png"}
                  alt={authUser?.fullName || "Profile"}
                  className="size-8 rounded-full object-cover"
                />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-(--discord-rail) ${
                    isOnline || inVoice
                      ? "bg-(--discord-success)"
                      : "bg-(--discord-text-muted)"
                  }`}
                />
              </button>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold leading-tight text-(--discord-text)">
                  {authUser?.fullName || "RushCord User"}
                </div>
                <div className="truncate text-xs leading-tight text-(--discord-text-muted)">
                  {statusLabel}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                className={controlBtnClass(voiceMicMuted)}
                title={voiceMicMuted ? "Bật mic" : "Tắt mic"}
                aria-label={voiceMicMuted ? "Bật mic" : "Tắt mic"}
                aria-pressed={voiceMicMuted}
                onClick={() => inVoice && toggleVoiceMic()}
                disabled={!inVoice}
              >
                {voiceMicMuted ? (
                  <MicOff className="size-[18px]" />
                ) : (
                  <Mic className="size-[18px]" />
                )}
              </button>
              <button
                type="button"
                className={controlBtnClass(voiceOutputMuted)}
                title={voiceOutputMuted ? "Bật tai nghe" : "Tắt tai nghe"}
                aria-label={voiceOutputMuted ? "Bật tai nghe" : "Tắt tai nghe"}
                aria-pressed={voiceOutputMuted}
                onClick={() => inVoice && toggleVoiceOutput()}
                disabled={!inVoice}
              >
                {voiceOutputMuted ? (
                  <HeadphoneOff className="size-[18px]" />
                ) : (
                  <Headphones className="size-[18px]" />
                )}
              </button>
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded text-(--discord-text-muted) transition hover:bg-(--discord-hover) hover:text-(--discord-text)"
                title="Cài đặt"
                aria-label="Cài đặt"
                onClick={() => setShowUserSettings(true)}
              >
                <Settings className="size-[18px]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <UserSettingsModal
        open={showUserSettings}
        onClose={() => setShowUserSettings(false)}
      />
    </>
  );
}

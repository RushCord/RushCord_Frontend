import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Loader2,
  MessageCircle,
  UserPlus,
  Users,
} from "lucide-react";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import toast from "react-hot-toast";
import { dmConversationId } from "../lib/dmConversationId";

function formatDobDisplay(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "—";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

function genderLabel(code) {
  const c = String(code || "").toUpperCase();
  if (c === "MALE") return "Nam";
  if (c === "FEMALE") return "Nữ";
  if (c === "OTHER") return "Khác";
  return "—";
}

export const ExploreUserPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { authUser } = useAuthStore();
  const {
    friends,
    incomingFriendRequests,
    outgoingFriendRequests,
    getFriends,
    getFriendRequests,
    sendFriendRequest,
    acceptFriendRequest,
    deleteFriendRequest,
    setSelectedConversation,
    getUsers,
  } = useChatStore();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFriends();
    getFriendRequests();
    getUsers();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userId) return;
      setLoading(true);
      try {
        const res = await axiosInstance.get(`/users/${encodeURIComponent(userId)}`);
        if (!cancelled) setProfile(res.data);
      } catch (e) {
        if (!cancelled) {
          setProfile(null);
          toast.error(e.response?.data?.error || "Không tìm thấy người dùng");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const relation = useMemo(() => {
    const id = String(userId || "");
    const me = String(authUser?._id || "");
    if (!id || !me || id === me) return "self";
    if (friends.some((f) => String(f.otherUserId) === id)) return "friend";
    if (incomingFriendRequests.some((r) => String(r.otherUserId) === id)) return "incoming";
    if (outgoingFriendRequests.some((r) => String(r.otherUserId) === id)) return "outgoing";
    return "none";
  }, [userId, authUser?._id, friends, incomingFriendRequests, outgoingFriendRequests]);

  const openDm = () => {
    const cid = dmConversationId(authUser?._id, userId);
    setSelectedConversation({
      conversationId: cid,
      type: "DM",
      otherUserId: userId,
    });
    navigate("/");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--discord-app)]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[var(--discord-app)] px-6 py-8">
        <div className="mx-auto max-w-lg text-center">
          <p className="text-base-content/70">Không có hồ sơ.</p>
          <button type="button" className="btn btn-ghost mt-4" onClick={() => navigate(-1)}>
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  const coverSrc = profile.coverPic;
  const isSelf = profile.isSelf === true;

  return (
    <div className="min-h-screen bg-[var(--discord-app)] px-6 py-8">
      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="discord-icon-button mb-4 flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-sm"
        >
          <ArrowLeft className="size-4" />
          Quay lại
        </button>

        <div className="discord-card overflow-hidden">
          <div className="relative h-36 md:h-44">
            {coverSrc ? (
              <img src={coverSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-r from-primary/35 via-purple-900/40 to-slate-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>

          <div className="relative px-6 pb-6 pt-0">
            <div className="-mt-14 flex flex-col items-center sm:flex-row sm:items-end sm:gap-5">
              <img
                src={profile.profilePic || "/avatar.png"}
                alt=""
                className="size-28 shrink-0 rounded-full border-4 border-[var(--discord-panel)] object-cover"
              />
              <div className="mt-3 flex flex-1 flex-col items-center text-center sm:mt-0 sm:items-start sm:pb-2 sm:text-left">
                <h1 className="text-2xl font-semibold">{profile.fullName || "User"}</h1>
                <p className="text-sm text-base-content/60">
                  Thành viên từ {profile.createdAt?.split("T")[0] || "—"}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 border-t border-white/10 pt-6 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs text-base-content/50">Ngày sinh</div>
                <div className="mt-1 flex items-center gap-2 font-medium">
                  <Calendar className="size-4 text-primary" />
                  {formatDobDisplay(profile.dateOfBirth)}
                </div>
              </div>
              <div>
                <div className="text-xs text-base-content/50">Giới tính</div>
                <div className="mt-1 font-medium">{genderLabel(profile.gender)}</div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {isSelf && (
                <button type="button" className="btn btn-primary" onClick={() => navigate("/profile")}>
                  Chỉnh sửa hồ sơ
                </button>
              )}

              {!isSelf && relation === "friend" && (
                <>
                  <span className="btn btn-outline pointer-events-none border-emerald-500/40 text-emerald-300">
                    <Users className="size-4" />
                    Đã là bạn
                  </span>
                  <button type="button" className="btn btn-primary gap-2" onClick={openDm}>
                    <MessageCircle className="size-4" />
                    Nhắn tin
                  </button>
                </>
              )}

              {!isSelf && relation === "none" && (
                <button
                  type="button"
                  className="btn btn-primary gap-2"
                  onClick={async () => {
                    try {
                      await sendFriendRequest(userId);
                    } catch {
                      /* toast in store */
                    }
                  }}
                >
                  <UserPlus className="size-4" />
                  Kết bạn
                </button>
              )}

              {!isSelf && relation === "outgoing" && (
                <span className="btn btn-outline pointer-events-none">Đã gửi lời mời</span>
              )}

              {!isSelf && relation === "incoming" && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => acceptFriendRequest(userId)}
                  >
                    Chấp nhận
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => deleteFriendRequest(userId)}
                  >
                    Từ chối
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

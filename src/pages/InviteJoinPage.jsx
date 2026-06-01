import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Loader2, Users } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import logoImg from "../assets/logo.png";

export const InviteJoinPage = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { authUser, isCheckingAuth } = useAuthStore();
  const { fetchInvitePreview, acceptInvite } = useChatStore();

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  const inviteCode = String(code || "").trim();

  useEffect(() => {
    if (!inviteCode) {
      setError("Mã mời không hợp lệ");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      const data = await fetchInvitePreview(inviteCode, { silent: true });
      if (cancelled) return;
      if (!data) {
        setError("Lời mời không tồn tại hoặc đã hết hiệu lực");
      } else {
        setPreview(data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteCode, fetchInvitePreview]);

  if (!inviteCode) {
    return <Navigate to="/" replace />;
  }

  const handleJoin = async () => {
    if (!authUser) {
      navigate(
        `/login?redirect=${encodeURIComponent(`/invite/${inviteCode}`)}`,
      );
      return;
    }
    setJoining(true);
    const conv = await acceptInvite(inviteCode);
    setJoining(false);
    if (conv) navigate("/", { replace: true });
  };

  const statusLabel = (() => {
    if (!preview) return "";
    if (preview.status === "revoked") return "Lời mời đã bị thu hồi";
    if (preview.status === "expired") return "Lời mời đã hết hạn";
    if (preview.status === "max_uses") return "Lời mời đã đạt giới hạn lượt dùng";
    return "";
  })();

  const canJoin = preview?.canJoin;
  const joinLabel = !authUser
    ? "Đăng nhập để tham gia"
    : joining
      ? "Đang tham gia..."
      : "Tham gia nhóm";

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--discord-app)]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-0px)] flex items-center justify-center p-6 bg-[var(--discord-app)]">
      <div className="discord-card w-full max-w-md p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <img src={logoImg} alt="RushCord" className="h-10 w-10 rounded-lg mb-3" />
          <h1 className="text-xl font-bold">Tham gia nhóm</h1>
          <p className="text-sm text-base-content/60 mt-1">
            Bạn được mời vào một nhóm trên RushCord
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <p className="text-center text-sm text-error py-6">{error}</p>
        ) : preview ? (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-3">
              <img
                src={preview.avatar?.trim() ? preview.avatar : "/avatar.png"}
                alt=""
                className="size-20 rounded-full border border-white/10 object-cover"
                onError={(e) => {
                  e.currentTarget.src = "/avatar.png";
                }}
              />
              <div>
                <h2 className="text-lg font-semibold">{preview.title || "Nhóm"}</h2>
                <p className="text-sm text-base-content/60 flex items-center justify-center gap-1 mt-1">
                  <Users className="size-4" />
                  {preview.memberCount ?? 0} thành viên
                </p>
              </div>
            </div>

            {statusLabel ? (
              <p className="text-center text-sm text-warning">{statusLabel}</p>
            ) : null}

            {preview.joinPolicy === "INVITE_ONLY" ? (
              <p className="text-xs text-center text-base-content/50">
                Nhóm riêng — chỉ tham gia qua lời mời
              </p>
            ) : null}

            <button
              type="button"
              className="btn btn-primary w-full rounded-lg border-0"
              disabled={!canJoin || joining}
              onClick={handleJoin}
            >
              {joining ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Đang tham gia...
                </>
              ) : (
                joinLabel
              )}
            </button>
          </div>
        ) : null}

        <p className="text-center mt-6 text-sm">
          <Link to="/" className="link link-primary">
            Về trang chủ
          </Link>
        </p>
      </div>
    </div>
  );
};

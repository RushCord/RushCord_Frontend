import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, Mail, XCircle } from "lucide-react";
import AuthImagePattern from "../components/AuthImagePattern";
import { useAuthStore } from "../store/useAuthStore";
import logoImg from "../assets/logo.png";

export const ConfirmEmailChangePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token")?.trim() || "";
  const { confirmEmailChange, isConfirmingEmailChange, logout, checkAuth } =
    useAuthStore();

  const [status, setStatus] = useState("idle");
  const [newEmail, setNewEmail] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    let cancelled = false;
    (async () => {
      setStatus("loading");
      try {
        const data = await confirmEmailChange({ token });
        if (cancelled) return;
        setNewEmail(data?.email || "");
        setStatus("success");
        try {
          await checkAuth();
        } catch {
          /* ok */
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per token in URL
  }, [token]);

  const handleGoLogin = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[var(--discord-app)] lg:grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="discord-card w-full max-w-md p-8 text-center">
          <div className="mb-6 flex flex-col items-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-primary/15">
              <img src={logoImg} alt="RushCord logo" className="h-8 w-8 rounded-lg object-cover" />
            </div>
            <h1 className="text-2xl font-bold">Xác nhận đổi email</h1>
          </div>

          {status === "invalid" && (
            <div className="space-y-4">
              <XCircle className="mx-auto h-12 w-12 text-error" />
              <p className="text-base-content/60">Link không hợp lệ hoặc thiếu mã xác nhận.</p>
              <Link to="/profile" className="btn btn-primary w-full">
                Về trang cá nhân
              </Link>
            </div>
          )}

          {(status === "idle" || status === "loading" || isConfirmingEmailChange) && token && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-base-content/60">Đang xác nhận đổi email...</p>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-4">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
              <p className="text-base-content/80">
                Email của bạn đã được đổi thành{" "}
                <span className="font-semibold text-primary">{newEmail}</span>.
              </p>
              <p className="text-sm text-base-content/60">
                Từ giờ hãy đăng nhập bằng email mới.
              </p>
              <button type="button" className="btn btn-primary w-full" onClick={handleGoLogin}>
                Đăng nhập
              </button>
              <Link to="/" className="link link-primary text-sm">
                Về trang chủ
              </Link>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <Mail className="mx-auto h-12 w-12 text-base-content/40" />
              <p className="text-base-content/60">
                Không thể xác nhận. Link có thể đã hết hạn hoặc đã được dùng.
              </p>
              <Link to="/profile" className="btn btn-primary w-full">
                Thử lại từ trang cá nhân
              </Link>
            </div>
          )}
        </div>
      </div>

      <AuthImagePattern
        title="Email updated"
        subtitle="Your account email has been changed securely."
      />
    </div>
  );
};

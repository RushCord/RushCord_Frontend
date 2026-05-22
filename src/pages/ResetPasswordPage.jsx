import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { AuthFooter } from "../components/auth/AuthFooter";
import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthPasswordField } from "../components/auth/AuthPasswordField";
import { useAuthStore } from "../store/useAuthStore";

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get("email")?.trim() || "";
  const code = searchParams.get("code")?.trim() || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { resetPassword, isResettingPassword } = useAuthStore();

  const linkInvalid = !email || !code;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (linkInvalid) return;
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      await resetPassword({ email, otpCode: code, newPassword });
      navigate("/login", { replace: true });
    } catch {
      /* toast in store */
    }
  };

  return (
    <AuthLayout
      title="Set new password"
      subtitle={
        linkInvalid
          ? "This reset link is invalid or incomplete"
          : "Choose a strong password for your account"
      }
      patternTitle="Almost done"
      patternSubtitle="Set a new password to regain access to your account."
    >
      {linkInvalid ? (
        <div className="space-y-6 text-center">
          <p className="text-sm text-base-content/60">
            Request a new link from the forgot password page.
          </p>
          <Link to="/forgot-password" className="btn btn-primary h-12 w-full rounded-lg border-0">
            Request new link
          </Link>
          <AuthFooter
            lines={[
              {
                text: "Back to",
                linkTo: "/login",
                linkLabel: "sign in",
              },
            ]}
          />
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-6">
            <AuthPasswordField
              label="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <AuthPasswordField
              label="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            <button
              type="submit"
              className="btn btn-primary h-12 w-full rounded-lg border-0"
              disabled={isResettingPassword}
            >
              {isResettingPassword ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update password"
              )}
            </button>
          </form>

          <AuthFooter
            lines={[
              {
                text: "Back to",
                linkTo: "/login",
                linkLabel: "sign in",
              },
            ]}
          />
        </>
      )}
    </AuthLayout>
  );
};

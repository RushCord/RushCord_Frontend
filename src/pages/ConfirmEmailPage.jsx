import { Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { AuthField } from "../components/auth/AuthField";
import { AuthFooter } from "../components/auth/AuthFooter";
import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthOtpField } from "../components/auth/AuthOtpField";
import { useAuthStore } from "../store/useAuthStore";

export const ConfirmEmailPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const emailFromState = location.state?.email || "";
  const [email, setEmail] = useState(emailFromState);
  const [otpCode, setOtpCode] = useState("");
  const { confirmSignup, resendConfirmation, isConfirming } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }
    if (!/^\d{6}$/.test(otpCode.trim())) {
      toast.error("Enter the 6-digit code from your email");
      return;
    }
    try {
      await confirmSignup({ email: email.trim(), otpCode: otpCode.trim() });
      navigate("/login", { replace: true });
    } catch {
      /* toast in store */
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      toast.error("Enter your email first");
      return;
    }
    try {
      await resendConfirmation({ email: email.trim() });
    } catch {
      /* toast in store */
    }
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle="Enter the 6-digit code we sent to your inbox"
      patternTitle="Almost there"
      patternSubtitle="Confirm your email to start using RushCord."
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <AuthField
          label="Email"
          type="email"
          placeholder="you@example.com"
          icon={Mail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={!!emailFromState}
        />

        <AuthOtpField
          label="Verification code"
          value={otpCode}
          onChange={setOtpCode}
        />

        <button
          type="submit"
          className="btn btn-primary h-12 w-full rounded-lg border-0"
          disabled={isConfirming}
        >
          {isConfirming ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify and continue"
          )}
        </button>

        <button
          type="button"
          className="btn btn-ghost h-12 w-full rounded-lg border-0 bg-white/5 hover:bg-white/10"
          onClick={handleResend}
        >
          Resend code
        </button>
      </form>

      <AuthFooter
        lines={[
          {
            text: "Back to",
            linkTo: "/login",
            linkLabel: "sign in",
          },
          {
            text: "Don't have an account?",
            linkTo: "/signup",
            linkLabel: "Create account",
            muted: true,
          },
        ]}
      />
    </AuthLayout>
  );
};

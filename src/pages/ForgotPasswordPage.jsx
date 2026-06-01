import { Loader2, Mail } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { AuthField } from "../components/auth/AuthField";
import { AuthFooter } from "../components/auth/AuthFooter";
import { AuthLayout } from "../components/auth/AuthLayout";
import { useAuthStore } from "../store/useAuthStore";

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { forgotPassword, isRequestingReset } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Email is required");
      return;
    }
    try {
      await forgotPassword({ email: trimmed });
      setSent(true);
    } catch {
      /* toast in store */
    }
  };

  return (
    <AuthLayout
      title="Forgot password"
      subtitle={
        sent
          ? "Check your inbox for a reset link"
          : "Enter your email and we will send you a reset link"
      }
      patternTitle="Reset your password"
      patternSubtitle="We will email you a secure link to choose a new password."
      banner={
        sent ? (
          <div className="mb-6 rounded-lg bg-primary/10 p-3 text-center text-sm text-success">
            If an account exists for this email, a reset link has been sent.
          </div>
        ) : null
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <AuthField
          label="Email"
          type="email"
          placeholder="you@example.com"
          icon={Mail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button
          type="submit"
          className="btn btn-primary h-12 w-full rounded-lg border-0"
          disabled={isRequestingReset}
        >
          {isRequestingReset ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              Sending...
            </>
          ) : sent ? (
            "Resend reset link"
          ) : (
            "Send reset link"
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
    </AuthLayout>
  );
};

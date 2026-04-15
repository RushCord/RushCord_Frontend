import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Loader2, Mail, MessageSquare } from "lucide-react";
import AuthImagePattern from "../components/AuthImagePattern";
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
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex flex-col justify-center items-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center mb-8">
            <div className="flex flex-col items-center gap-2 group">
              <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <MessageSquare className="size-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold mt-2">Verify your email</h1>
              <p className="text-base-content/60">
                Enter the 6-digit code we sent to your inbox
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Email</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="size-5 text-base-content/40" />
                </div>
                <input
                  type="email"
                  className="input input-bordered w-full pl-10"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!!emailFromState}
                />
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Verification code</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                className="input input-bordered w-full tracking-widest text-center text-lg"
                placeholder="000000"
                value={otpCode}
                onChange={(e) =>
                  setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
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
              className="btn btn-ghost w-full"
              onClick={handleResend}
            >
              Resend code
            </button>
          </form>

          <div className="text-center">
            <Link to="/login" className="link link-primary">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>

      <AuthImagePattern
        title="Almost there"
        subtitle="Confirm your email to start using RushCord."
      />
    </div>
  );
};

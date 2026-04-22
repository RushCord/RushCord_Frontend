import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Loader2, Mail } from "lucide-react";
import AuthImagePattern from "../components/AuthImagePattern";
import { useAuthStore } from "../store/useAuthStore";
import logoImg from "../assets/logo.png";

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
    <div className="min-h-screen bg-[var(--discord-app)] lg:grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="discord-card w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="flex flex-col items-center gap-2 group">
              <div className="flex size-14 items-center justify-center rounded-[18px] bg-primary/15 transition-colors group-hover:bg-primary/25">
                <img src={logoImg} alt="RushCord logo" className="size-8 rounded-lg object-cover" />
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
                  className="input discord-input-reset h-12 w-full rounded-xl border border-white/10 bg-black/10 pl-10"
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
                  className="input discord-input-reset h-12 w-full rounded-xl border border-white/10 bg-black/10 text-center text-lg tracking-widest"
                placeholder="000000"
                value={otpCode}
                onChange={(e) =>
                  setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </div>

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

import { Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthField } from "../components/auth/AuthField";
import { AuthFooter } from "../components/auth/AuthFooter";
import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthPasswordField } from "../components/auth/AuthPasswordField";
import { useAuthStore } from "../store/useAuthStore";

export const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const { login, isLoggingIn } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect")?.trim() || "";

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await login(formData);
    if (ok) {
      if (redirectTo && redirectTo.startsWith("/")) {
        navigate(redirectTo, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  };

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Sign in to your account"
      patternTitle="Welcome back!"
      patternSubtitle="Sign in to continue your conversations and catch up with your messages."
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <AuthField
          label="Email"
          type="email"
          placeholder="you@example.com"
          icon={Mail}
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />

        <AuthPasswordField
          label="Password"
          value={formData.password}
          onChange={(e) =>
            setFormData({ ...formData, password: e.target.value })
          }
          footer={
            <Link to="/forgot-password" className="label-text-alt link link-primary">
              Forgot password?
            </Link>
          }
        />

        <button
          type="submit"
          className="btn btn-primary h-12 w-full rounded-lg border-0"
          disabled={isLoggingIn}
        >
          {isLoggingIn ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              Loading...
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <AuthFooter
        lines={[
          {
            text: "Don't have an account?",
            linkTo: "/signup",
            linkLabel: "Create account",
          },
          {
            text: "Need to enter your email code?",
            linkTo: "/confirm-email",
            linkLabel: "Verify email",
            muted: true,
          },
        ]}
      />
    </AuthLayout>
  );
};

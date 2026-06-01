import { Loader2, Mail, User } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { AuthField } from "../components/auth/AuthField";
import { AuthFooter } from "../components/auth/AuthFooter";
import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthPasswordField } from "../components/auth/AuthPasswordField";
import { useAuthStore } from "../store/useAuthStore";

export const SignUpPage = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  const navigate = useNavigate();
  const { register, isSigningUp } = useAuthStore();

  const validateForm = () => {
    if (!formData.fullName.trim()) {
      toast.error("Full name is required");
      return false;
    }
    if (!formData.email.trim()) {
      toast.error("Email is required");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error("Please enter a valid email address");
      return false;
    }
    if (!formData.password) {
      toast.error("Password is required");
      return false;
    }
    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters (Cognito policy)");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      await register({
        email: formData.email.trim(),
        password: formData.password,
        displayName: formData.fullName.trim(),
      });
      navigate("/confirm-email", {
        replace: false,
        state: { email: formData.email.trim() },
      });
    } catch {
      /* toast in store */
    }
  };

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Get started with your free account"
      patternTitle="Join our community"
      patternSubtitle="Connect with friends, share moments, and stay in touch with your loved ones."
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <AuthField
          label="Full Name"
          type="text"
          placeholder="John Doe"
          icon={User}
          value={formData.fullName}
          onChange={(e) =>
            setFormData({ ...formData, fullName: e.target.value })
          }
        />

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
          hint="Use at least 8 characters with uppercase, lowercase, number, and symbol (Cognito)."
        />

        <button
          type="submit"
          className="btn btn-primary h-12 w-full rounded-lg border-0"
          disabled={isSigningUp}
        >
          {isSigningUp ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              Loading...
            </>
          ) : (
            "Create Account"
          )}
        </button>
      </form>

      <AuthFooter
        lines={[
          {
            text: "Already have an account?",
            linkTo: "/login",
            linkLabel: "Sign in",
          },
        ]}
      />
    </AuthLayout>
  );
};

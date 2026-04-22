import { Navbar } from "./components/Navbar";
import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { SignUpPage } from "./pages/SignUpPage";
import { ConfirmEmailPage } from "./pages/ConfirmEmailPage";
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { FriendsPage } from "./pages/FriendsPage";
import { useEffect } from "react";
import { useAuthStore } from "./store/useAuthStore";
import { Loader } from "lucide-react";
import { Toaster } from "react-hot-toast";
import { useThemeStore } from "./store/useThemeStore";

const App = () => {
  const { authUser, checkAuth, isCheckingAuth } = useAuthStore();
  const { theme } = useThemeStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isCheckingAuth && !authUser)
    return (
      <div data-theme={theme} className="discord-app-shell flex h-screen items-center justify-center">
        <div className="discord-card flex items-center gap-3 px-5 py-4">
          <Loader className="size-6 animate-spin text-primary" />
          <span className="text-sm font-medium">Syncing your workspace...</span>
        </div>
      </div>
    );

  return (
    <div data-theme={theme} className="discord-app-shell">
      <Navbar />
      <main className={`discord-main-shell ${authUser ? "md:pl-[72px]" : ""}`}>
        <Routes>
          <Route path="/" element={authUser ? <HomePage /> : <Navigate to="/login" />} />
          <Route path="/signup" element={!authUser ? <SignUpPage /> : <Navigate to="/" />} />
        <Route path="/confirm-email" element={!authUser ? <ConfirmEmailPage /> : <Navigate to="/" />} />
          <Route path="/login" element={!authUser ? <LoginPage /> : <Navigate to="/" />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={authUser ? <ProfilePage /> : <Navigate to="/login" />} />
        <Route path="/friends" element={authUser ? <FriendsPage /> : <Navigate to="/login" />} />
        </Routes>
      </main>

      <Toaster
        position="top-right"
        toastOptions={{
          className:
            "!rounded-lg !border !border-white/10 !bg-[var(--discord-panel)] !text-[var(--discord-text)] !shadow-2xl",
        }}
      />
    </div>
  );
};

export default App;

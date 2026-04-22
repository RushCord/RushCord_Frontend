import React from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logoImg from "../assets/logo.png";
import {
  CirclePlus,
  Home,
  LogOut,
  Settings,
  User,
  Users,
} from "lucide-react";

export const Navbar = () => {
  const { logout, authUser } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const isAuthPage =
    location.pathname === "/login" ||
    location.pathname === "/signup" ||
    location.pathname === "/confirm-email";

  const railItems = [
    { to: "/", label: "Home", icon: Home },
    { to: "/friends", label: "Friends", icon: Users },
    { to: "/settings", label: "Settings", icon: Settings },
    { to: "/profile", label: "Profile", icon: User },
  ];

  if (!authUser) {
    if (isAuthPage) return null;

    return (
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-[var(--discord-rail)]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-content shadow-lg">
              <img src={logoImg} alt="RushCord logo" className="size-7 rounded-lg object-cover" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide">RushCord</div>
              <div className="text-xs text-base-content/60">Discord-inspired workspace</div>
            </div>
          </Link>

          <Link to="/settings" className="discord-icon-button flex size-11 items-center justify-center">
            <Settings className="size-5" />
          </Link>
        </div>
      </header>
    );
  }

  return (
    <aside className="discord-rail fixed inset-y-0 left-0 z-50 hidden w-[72px] flex-col items-center px-3 py-4 md:flex">
      <Link
        to="/"
        className="relative mb-4 flex size-12 items-center justify-center rounded-[16px] bg-primary text-primary-content shadow-lg transition-[border-radius,transform] duration-150 hover:scale-105 hover:rounded-[18px]"
        title="RushCord"
      >
        <img src={logoImg} alt="RushCord logo" className="size-8 rounded-lg object-cover" />
      </Link>

      <div className="h-px w-10 bg-white/10" />

      <nav className="mt-4 flex flex-1 flex-col items-center gap-3">
        {railItems.map((item) => {
          const active =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname === item.to || location.pathname.startsWith(`${item.to}?`);

          return (
            <Link
              key={item.to}
              to={item.to}
              title={item.label}
              className="group relative"
            >
              <span
                className={`absolute -left-3 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-white transition-all ${
                  active ? "opacity-100" : "h-5 opacity-0 group-hover:opacity-100"
                }`}
              />
              <span
                className={`discord-icon-button flex size-12 items-center justify-center rounded-[16px] ${
                  active
                    ? "is-active bg-primary text-primary-content"
                    : "bg-[var(--discord-sidebar)] hover:bg-primary hover:text-primary-content"
                }`}
              >
                <item.icon className="size-5" />
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mb-3 flex size-12 items-center justify-center rounded-[16px] bg-[var(--discord-sidebar)] text-base-content/70">
        <CirclePlus className="size-5" />
      </div>

      <div className="flex flex-col items-center gap-3">
        <Link to="/profile" title={authUser?.fullName || "Profile"} className="group relative">
          <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white opacity-0 transition-opacity group-hover:opacity-100" />
          <img
            src={authUser?.profilePic || "/avatar.png"}
            alt="Profile"
            className="size-12 rounded-[16px] border border-white/10 object-cover transition-all duration-150 group-hover:scale-105 group-hover:rounded-[18px]"
          />
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          title="Logout"
          className="discord-icon-button flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-base-content/70 hover:bg-red-500 hover:text-white"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  );
};

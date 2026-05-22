import React, { useMemo, useState } from "react";
import CreateGroupModal from "./CreateGroupModal";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logoImg from "../assets/logo.png";
import {
  CirclePlus,
  Home,
  MessageCircle,
  Settings,
} from "lucide-react";
import { isAuthPath } from "./auth/authRoutes";

export const Navbar = () => {
  const { authUser } = useAuthStore();
  const {
    conversations,
    selectedConversation,
    setSelectedConversation,
    sidebarRailMode,
  } = useChatStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const openCreateGroup = () => {
    if (location.pathname !== "/") navigate("/");
    setShowCreateGroup(true);
  };

  const openDirectMessages = () => {
    if (location.pathname !== "/") navigate("/");
    setSelectedConversation(null);
  };

  const railGroups = useMemo(() => {
    const items = Array.isArray(conversations) ? conversations : [];
    return items
      .filter((c) => c?.type === "GROUP")
      .slice()
      .sort((a, b) => {
        const ta = String(a?.lastMessageAt || a?.lastMessage?.createdAt || "");
        const tb = String(b?.lastMessageAt || b?.lastMessage?.createdAt || "");
        return tb.localeCompare(ta);
      })
      .slice(0, 50);
  }, [conversations]);

  const isAuthPage = isAuthPath(location.pathname);

  const railItems = [{ to: "/", label: "Home", icon: Home }];

  const isProfileRoute =
    location.pathname === "/profile" || location.pathname.startsWith("/profile/");
  const usesFullChatRail = location.pathname === "/" || isProfileRoute;
  const railBottomPad = location.pathname === "/" ? "pb-[52px]" : "pb-4";

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

  if (usesFullChatRail) {
    const dmActive = sidebarRailMode === "dms";

    return (
      <aside
        className={`discord-rail fixed inset-y-0 left-0 z-50 hidden w-[72px] flex-col items-center px-3 pt-4 md:flex ${railBottomPad}`}
      >
        <button
          type="button"
          onClick={openDirectMessages}
          className="relative mb-3 flex size-12 shrink-0 items-center justify-center rounded-[16px] bg-primary text-primary-content shadow-lg transition-[border-radius,transform] duration-150 hover:scale-105 hover:rounded-[18px]"
          title="Tin nhắn trực tiếp"
        >
          <img src={logoImg} alt="RushCord logo" className="size-8 rounded-lg object-cover" />
        </button>

        <div className="h-px w-10 shrink-0 bg-white/10" />

        <nav className="mt-3 flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-hidden">
          <div className="flex shrink-0 flex-col items-center">
            <button
              type="button"
              title="Tin nhắn trực tiếp"
              onClick={openDirectMessages}
              className="group relative"
            >
              <span
                className={`absolute -left-3 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-white transition-all ${
                  dmActive ? "opacity-100" : "h-5 opacity-0 group-hover:opacity-100"
                }`}
              />
              <span
                className={`discord-icon-button flex size-12 items-center justify-center rounded-[16px] ${
                  dmActive
                    ? "is-active bg-primary text-primary-content"
                    : "bg-[var(--discord-sidebar)] hover:bg-primary hover:text-primary-content"
                }`}
              >
                <MessageCircle className="size-5" />
              </span>
            </button>
          </div>

          <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-x-hidden overflow-y-auto py-1 [scrollbar-width:thin]">
            {railGroups.map((g, idx) => {
              const gid = String(g?.conversationId ?? "");
              const active =
                sidebarRailMode === "group" &&
                String(selectedConversation?.conversationId) === gid;
              return (
                <button
                  key={gid || `group-rail-${idx}`}
                  type="button"
                  title={g?.title || "Nhóm"}
                  onClick={() => {
                    if (location.pathname !== "/") navigate("/");
                    setSelectedConversation(g);
                  }}
                  className="group relative flex w-full shrink-0 justify-center"
                >
                  <span
                    className={`absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-white transition-all ${
                      active ? "opacity-100" : "h-5 opacity-0 group-hover:opacity-100"
                    }`}
                  />
                  <span
                    className={`flex size-12 items-center justify-center overflow-hidden rounded-[16px] border border-white/10 transition-[border-radius,transform] duration-150 ${
                      active
                        ? "rounded-[18px] ring-2 ring-primary ring-offset-2 ring-offset-[var(--discord-rail)]"
                        : "hover:scale-105 hover:rounded-[18px]"
                    }`}
                  >
                    <img
                      src={g?.avatar || "/avatar.png"}
                      alt=""
                      className="size-12 object-cover"
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <button
          type="button"
          title="Tạo nhóm mới"
          onClick={openCreateGroup}
          className="discord-icon-button flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-[var(--discord-sidebar)] text-base-content/70 hover:bg-primary hover:text-primary-content"
        >
          <CirclePlus className="size-[18px]" />
        </button>

        <CreateGroupModal
          open={showCreateGroup}
          onClose={() => setShowCreateGroup(false)}
        />

      </aside>
    );
  }

  return (
    <aside className="discord-rail fixed inset-y-0 left-0 z-50 hidden w-[72px] flex-col items-center px-3 py-4 md:flex">
      <button
        type="button"
        onClick={openDirectMessages}
        className="relative mb-4 flex size-12 items-center justify-center rounded-[16px] bg-primary text-primary-content shadow-lg transition-[border-radius,transform] duration-150 hover:scale-105 hover:rounded-[18px]"
        title="Tin nhắn trực tiếp"
      >
        <img src={logoImg} alt="RushCord logo" className="size-8 rounded-lg object-cover" />
      </button>

      <div className="h-px w-10 bg-white/10" />

      <nav className="mt-4 flex flex-1 flex-col items-center gap-3">
        {railItems.map((item) => {
          const active =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname === item.to ||
                location.pathname.startsWith(`${item.to}?`);

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

      <button
        type="button"
        title="Tạo nhóm mới"
        onClick={openCreateGroup}
        className="discord-icon-button mb-3 flex size-12 items-center justify-center rounded-[16px] bg-[var(--discord-sidebar)] text-base-content/70 hover:bg-primary hover:text-primary-content"
      >
        <CirclePlus className="size-5" />
      </button>

      <CreateGroupModal
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
      />

    </aside>
  );
};

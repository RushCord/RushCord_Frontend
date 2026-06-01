import Sidebar from "./SideBar";
import SidebarUserBar from "./SidebarUserBar";
import { useChatStore } from "../store/useChatStore";

export default function AppChatLayout({ children }) {
  const voiceSession = useChatStore((s) => s.voiceSession);

  return (
    <div className="h-screen overflow-hidden bg-(--discord-app) text-(--discord-text)">
      <SidebarUserBar />
      <div className="flex h-full min-h-0 w-full overflow-hidden">
        <section
          className={`hidden h-full w-[240px] min-w-[240px] flex-col bg-(--discord-sidebar) md:flex ${
            voiceSession ? "pb-[100px]" : "pb-[52px]"
          }`}
        >
          <Sidebar />
        </section>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-white/10 md:border-l">
          {children}
        </div>
      </div>
    </div>
  );
}

import { Hash, Users } from "lucide-react";
import logoImg from "../assets/logo.png";

const NoChatSelected = () => {
  return (
    <div className="flex w-full flex-1 items-center justify-center bg-[var(--discord-chat)] p-10">
      <div className="discord-card max-w-2xl px-10 py-12 text-center">
        <div className="mb-6 flex justify-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-[18px] bg-primary/15 text-primary shadow-lg">
            <img src={logoImg} alt="RushCord logo" className="size-10 rounded-xl object-cover" />
          </div>
          <div className="flex size-16 items-center justify-center rounded-[18px] bg-white/5 text-base-content/70">
            <Hash className="size-7" />
          </div>
          <div className="flex size-16 items-center justify-center rounded-[18px] bg-white/5 text-base-content/70">
            <Users className="size-7" />
          </div>
        </div>

        <div className="discord-section-title mb-2">RushCord Workspace</div>
        <h2 className="text-3xl font-bold">Pick a channel to start the conversation</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-base-content/60">
          Your server rail, conversation list, and chat tools are ready. Select a direct
          message or group from the sidebar to jump into a Discord-style workspace.
        </p>
      </div>
    </div>
  );
};

export default NoChatSelected;
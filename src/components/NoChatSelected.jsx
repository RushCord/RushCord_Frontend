import logoImg from "../assets/logo.png";

const TEAM_MEMBERS = [
  { name: "Võ Thái Duy", id: "22701371" },
  { name: "Trần Nhật Duy", id: "22699741" },
  { name: "Trương Gia Huy", id: "22698251" },
  { name: "Nguyễn Gia Bảo", id: "22691861" },
  { name: "Nguyễn Tuấn Huy", id: "22699431" },
];

const NoChatSelected = () => {
  return (
    <div className="flex w-full flex-1 items-center justify-center overflow-y-auto bg-(--discord-chat) p-6 md:p-10">
      <div className="w-full max-w-xl px-4 py-6 text-left md:px-8 md:py-10">
        <img
          src={logoImg}
          alt="RushCord"
          className="mb-5 size-16 rounded-2xl object-cover shadow-lg ring-2 ring-white/10"
        />

        <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
          RushCord
        </h1>

        <p className="mt-3 text-[15px] leading-relaxed text-(--discord-text-muted)">
          Dự án{" "}
          <span className="font-medium text-(--discord-text)">
            OTT for Community &amp; Social Groups
          </span>{" "}
          – OTT cho Cộng đồng.
        </p>

        <div className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-(--discord-text-muted)">
            Nhóm thực hiện
          </h2>
          <ul className="mt-3 space-y-2">
            {TEAM_MEMBERS.map((member, index) => (
              <li
                key={member.id}
                className="flex items-center gap-3 rounded-lg border border-white/5 bg-(--discord-panel)/60 px-3 py-2.5 text-sm transition-colors hover:border-white/10 hover:bg-(--discord-panel)"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 font-medium text-(--discord-text)">
                  {member.name}
                </span>
                <span className="shrink-0 font-mono text-xs text-(--discord-text-muted)">
                  {member.id}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default NoChatSelected;

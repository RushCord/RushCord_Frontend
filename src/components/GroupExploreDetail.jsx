import { useEffect, useState } from "react";
import { ArrowLeft, Hash, Loader2, Users } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { getTopicLabel } from "../constants/groupTopics";
import ReadonlyInfoMessageList from "./ReadonlyInfoMessageList";

export default function GroupExploreDetail({ group, onBack, onJoin, joining }) {
  const { fetchGroupExplorePreview } = useChatStore();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cid = group?.conversationId;
  const isMember = preview?.isMember ?? group?.isMember;

  useEffect(() => {
    if (!cid) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      const data = await fetchGroupExplorePreview(cid, { silent: true });
      if (cancelled) return;
      if (!data) {
        setError("Không tải được thông tin nhóm");
        setPreview(null);
      } else {
        setPreview(data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [cid, fetchGroupExplorePreview]);

  const title = preview?.title || group?.title || "Nhóm";
  const description = preview?.description ?? group?.description;
  const topic = preview?.topic ?? group?.topic;
  const avatar = preview?.avatar || group?.avatar;
  const cover = preview?.cover || group?.cover;
  const memberCount = preview?.memberCount ?? group?.memberCount ?? 0;
  const infoChannels = preview?.infoChannels || [];
  const hasAnyMessages = infoChannels.some(
    (ch) => Array.isArray(ch.messages) && ch.messages.length > 0,
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="discord-card shrink-0 overflow-hidden">
        {cover ? (
          <div className="relative h-32 w-full">
            <img src={cover} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          </div>
        ) : (
          <div className="h-20 w-full bg-gradient-to-r from-primary/25 via-purple-900/30 to-slate-900" />
        )}
        <div className="px-5 pb-4 pt-3">
          <button
            type="button"
            onClick={onBack}
            className="discord-icon-button mb-3 flex size-9 items-center justify-center rounded-full bg-white/5"
            aria-label="Quay lại danh sách"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex gap-3">
            <img
              src={avatar || "/avatar.png"}
              alt=""
              className={`size-16 shrink-0 rounded-xl border border-white/10 object-cover ${
                cover ? "-mt-12 relative z-10" : ""
              }`}
              onError={(e) => {
                e.currentTarget.src = "/avatar.png";
              }}
            />
            <div className="min-w-0 flex-1 pt-1">
              <h2 className="truncate text-xl font-semibold">{title}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {topic ? (
                  <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    {getTopicLabel(topic)}
                  </span>
                ) : null}
                {isMember ? (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    Đã tham gia
                  </span>
                ) : null}
              </div>
              <p className="mt-2 flex items-center gap-1 text-xs text-base-content/55">
                <Users className="size-3.5" />
                {memberCount} thành viên
              </p>
            </div>
          </div>
          {description ? (
            <p className="mt-3 text-sm text-base-content/70">{description}</p>
          ) : (
            <p className="mt-3 text-sm italic text-base-content/40">Chưa có mô tả</p>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-4">
        <div className="discord-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-base-content/80">
            Kênh thông tin
          </h3>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-error">{error}</p>
          ) : infoChannels.length === 0 ? (
            <p className="py-8 text-center text-sm italic text-base-content/50">
              Nhóm chưa có kênh thông tin.
            </p>
          ) : !hasAnyMessages ? (
            <p className="py-8 text-center text-sm italic text-base-content/50">
              Chưa có thông báo.
            </p>
          ) : (
            <div className="space-y-6">
              {infoChannels.map((ch) => (
                <section key={ch.channelId}>
                  {infoChannels.length > 1 ? (
                    <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-base-content/55">
                      <Hash className="size-3.5" />
                      {ch.name || "thông-tin"}
                    </div>
                  ) : null}
                  <ReadonlyInfoMessageList messages={ch.messages || []} />
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="discord-card shrink-0 border-t border-white/10 p-4">
        <p className="mb-3 text-center text-xs text-base-content/55">
          Tham gia để chat và vào kênh thoại
        </p>
        <button
          type="button"
          disabled={joining}
          onClick={() => onJoin({ ...group, isMember })}
          className={`btn w-full ${isMember ? "btn-outline" : "btn-primary"}`}
        >
          {joining ? (
            <Loader2 className="size-5 animate-spin" />
          ) : isMember ? (
            "Mở nhóm"
          ) : (
            "Tham gia nhóm"
          )}
        </button>
      </div>
    </div>
  );
}

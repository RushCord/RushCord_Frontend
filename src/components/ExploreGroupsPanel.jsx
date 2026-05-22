import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, Loader2, Search, Users } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import {
  GROUP_TOPIC_OPTIONS,
  getTopicLabel,
} from "../constants/groupTopics";
import GroupExploreDetail from "./GroupExploreDetail";

export default function ExploreGroupsPanel({
  showPageHeader = true,
  onAfterJoin,
  className = "",
}) {
  const navigate = useNavigate();
  const { exploreGroups, joinGroupConversation, setSelectedConversation } =
    useChatStore();

  const [groupQ, setGroupQ] = useState("");
  const [groupDebounced, setGroupDebounced] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [groupResults, setGroupResults] = useState([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [joiningId, setJoiningId] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setGroupDebounced(groupQ.trim()), 350);
    return () => clearTimeout(t);
  }, [groupQ]);

  const fetchGroupSearch = useCallback(async () => {
    setGroupLoading(true);
    try {
      const items = await exploreGroups({
        q: groupDebounced,
        topic: topicFilter,
        limit: 40,
      });
      setGroupResults(items);
    } finally {
      setGroupLoading(false);
    }
  }, [groupDebounced, topicFilter, exploreGroups]);

  useEffect(() => {
    fetchGroupSearch();
  }, [fetchGroupSearch]);

  const goAfterJoin = onAfterJoin || (() => navigate("/"));

  const handleJoinGroup = async (group) => {
    const cid = group?.conversationId;
    if (!cid) return;
    if (group.isMember) {
      setSelectedConversation({
        conversationId: cid,
        type: "GROUP",
        title: group.title,
        topic: group.topic,
        description: group.description,
        avatar: group.avatar,
        cover: group.cover,
      });
      goAfterJoin();
      return;
    }

    setJoiningId(cid);
    const conv = await joinGroupConversation(cid);
    setJoiningId(null);
    if (conv) {
      setGroupResults((prev) =>
        prev.map((g) =>
          String(g.conversationId) === String(cid)
            ? { ...g, isMember: true }
            : g,
        ),
      );
      if (selectedGroup && String(selectedGroup.conversationId) === String(cid)) {
        setSelectedGroup((g) => (g ? { ...g, isMember: true } : g));
      }
      goAfterJoin();
    }
  };

  if (selectedGroup) {
    return (
      <div
        className={`h-full min-h-0 overflow-hidden bg-[var(--discord-app)] px-6 py-6 ${className}`}
      >
        <div className="mx-auto flex h-full max-h-full max-w-3xl flex-col">
          <GroupExploreDetail
            group={selectedGroup}
            onBack={() => setSelectedGroup(null)}
            onJoin={handleJoinGroup}
            joining={joiningId === selectedGroup.conversationId}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`h-full min-h-0 overflow-y-auto bg-[var(--discord-app)] px-6 py-6 ${className}`}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {showPageHeader ? (
          <div className="discord-card overflow-hidden">
            <div className="discord-topbar px-5 py-4">
              <div className="discord-section-title mb-1">Khám phá</div>
              <h1 className="flex items-center gap-2 text-xl font-semibold">
                <Compass className="size-5 text-primary" />
                Discover Groups
              </h1>
              <p className="mt-1 text-sm text-base-content/70">
                Khám phá nhóm công khai theo chủ đề và tham gia cộng đồng phù hợp.
              </p>
            </div>
          </div>
        ) : null}

        <div className="discord-card space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTopicFilter("")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                !topicFilter
                  ? "bg-primary text-primary-content"
                  : "border border-white/10 bg-black/10 text-base-content/80 hover:bg-white/5"
              }`}
            >
              Tất cả
            </button>
            {GROUP_TOPIC_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTopicFilter(opt.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  topicFilter === opt.id
                    ? "bg-primary text-primary-content"
                    : "border border-white/10 bg-black/10 text-base-content/80 hover:bg-white/5"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/40" />
            <input
              type="search"
              className="input discord-input-reset h-12 w-full rounded-xl border border-white/10 bg-black/10 py-2 pl-10 pr-4"
              placeholder="Tìm nhóm theo tên..."
              value={groupQ}
              onChange={(e) => setGroupQ(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="discord-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-base-content/80">
              Nhóm
              {topicFilter ? ` · ${getTopicLabel(topicFilter)}` : ""}
            </h2>
            {groupLoading && (
              <Loader2 className="size-4 animate-spin text-primary" />
            )}
          </div>
          <div className="space-y-3">
            {groupResults.map((g) => (
              <article
                key={g.conversationId}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedGroup(g)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedGroup(g);
                  }
                }}
                className="cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-black/10 transition hover:border-primary/30"
              >
                {g.cover ? (
                  <div className="relative h-24 w-full">
                    <img
                      src={g.cover}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  </div>
                ) : (
                  <div className="h-16 w-full bg-gradient-to-r from-primary/25 via-purple-900/30 to-slate-900" />
                )}
                <div className="flex gap-3 p-4">
                  <img
                    src={g.avatar || "/avatar.png"}
                    alt=""
                    className={`size-14 shrink-0 rounded-xl border border-white/10 object-cover ${
                      g.cover ? "relative z-10 -mt-10" : ""
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">
                        {g.title || "Nhóm"}
                      </h3>
                      {g.topic ? (
                        <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          {getTopicLabel(g.topic)}
                        </span>
                      ) : null}
                      {g.isMember ? (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                          Đã tham gia
                        </span>
                      ) : null}
                    </div>
                    {g.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-base-content/65">
                        {g.description}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm italic text-base-content/40">
                        Chưa có mô tả
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-base-content/50">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3.5" />
                        {g.memberCount ?? 0} thành viên
                      </span>
                      {g.createdAt ? (
                        <span>
                          Tạo {new Date(g.createdAt).toLocaleDateString("vi-VN")}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-primary/80">
                      Bấm để xem kênh thông tin
                    </p>
                  </div>
                </div>
              </article>
            ))}
            {!groupLoading && groupResults.length === 0 && (
              <div className="py-8 text-center text-sm text-base-content/60">
                Không có nhóm phù hợp.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Hash, Loader2, Search, User, Users, Volume2, X } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { axiosInstance } from "../lib/axios";
import { dmConversationId } from "../lib/dmConversationId";

function matchesNeedle(text, needle) {
  if (!needle) return true;
  return String(text || "")
    .toLowerCase()
    .includes(needle);
}

function channelTypeLabel(type) {
  if (type === "VOICE") return "Kênh thoại";
  if (type === "INFO") return "Thông tin";
  return "Kênh chat";
}

function ResultRow({ icon: Icon, title, subtitle, avatar, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-(--discord-hover)"
    >
      {avatar ? (
        <img
          src={avatar}
          alt=""
          className="size-9 shrink-0 rounded-full object-cover ring-1 ring-white/10"
          onError={(e) => {
            e.currentTarget.src = "/avatar.png";
          }}
        />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-(--discord-hover) text-(--discord-text-muted)">
          <Icon className="size-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-(--discord-text)">
          {title}
        </span>
        {subtitle ? (
          <span className="block truncate text-xs text-(--discord-text-muted)">
            {subtitle}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function Section({ title, children }) {
  if (!children) return null;
  return (
    <div>
      <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-(--discord-text-muted)">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export default function FindConversationModal({ open, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const { authUser } = useAuthStore();
  const {
    users,
    friends,
    conversations,
    setSelectedConversation,
    openGroupAtChannel,
  } = useChatStore();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [channelIndex, setChannelIndex] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setDebouncedQuery("");
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const groups = (Array.isArray(conversations) ? conversations : []).filter(
      (c) => c?.type === "GROUP" && c?.conversationId,
    );

    if (groups.length === 0) {
      setChannelIndex([]);
      setLoadingChannels(false);
      return;
    }

    setLoadingChannels(true);
    Promise.all(
      groups.map(async (g) => {
        try {
          const res = await axiosInstance.get(
            `/conversations/${encodeURIComponent(g.conversationId)}/channels`,
          );
          const channels = Array.isArray(res.data) ? res.data : [];
          return channels.map((ch) => ({
            conversationId: g.conversationId,
            groupTitle: g.title || "Group",
            groupAvatar: g.avatar || "/avatar.png",
            channelId: ch.channelId,
            channelType: ch.channelType,
            name: ch.name || "",
            groupConversation: g,
          }));
        } catch {
          return [];
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      setChannelIndex(results.flat());
      setLoadingChannels(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, conversations]);

  const sortedConversations = useMemo(() => {
    const items = Array.isArray(conversations) ? conversations.slice() : [];
    return items.sort((a, b) => {
      const ta = String(a?.lastMessageAt || a?.lastMessage?.createdAt || "");
      const tb = String(b?.lastMessageAt || b?.lastMessage?.createdAt || "");
      return tb.localeCompare(ta);
    });
  }, [conversations]);

  const userCandidates = useMemo(() => {
    const map = new Map();
    for (const f of Array.isArray(friends) ? friends : []) {
      const uid = String(f.otherUserId || "");
      if (!uid) continue;
      const u = users.find((x) => String(x._id) === uid);
      map.set(uid, {
        userId: uid,
        fullName: u?.fullName || "Bạn bè",
        email: u?.email || "",
        profilePic: u?.profilePic || "/avatar.png",
        lastMessageAt: "",
      });
    }
    for (const c of sortedConversations) {
      if (c?.type !== "DM") continue;
      const uid = String(c.otherUserId || "");
      if (!uid) continue;
      const u = users.find((x) => String(x._id) === uid);
      const existing = map.get(uid);
      map.set(uid, {
        userId: uid,
        fullName: u?.fullName || existing?.fullName || "Direct message",
        email: u?.email || existing?.email || "",
        profilePic: u?.profilePic || existing?.profilePic || "/avatar.png",
        lastMessageAt: String(
          c?.lastMessageAt || c?.lastMessage?.createdAt || existing?.lastMessageAt || "",
        ),
      });
    }
    return Array.from(map.values()).sort((a, b) =>
      String(b.lastMessageAt).localeCompare(String(a.lastMessageAt)),
    );
  }, [friends, sortedConversations, users]);

  const groupConversations = useMemo(
    () => sortedConversations.filter((c) => c?.type === "GROUP"),
    [sortedConversations],
  );

  const needle = debouncedQuery;

  const filteredUsers = useMemo(() => {
    const list = userCandidates.filter(
      (u) =>
        matchesNeedle(u.fullName, needle) || matchesNeedle(u.email, needle),
    );
    return needle ? list : list.slice(0, 5);
  }, [userCandidates, needle]);

  const filteredGroups = useMemo(() => {
    const list = groupConversations.filter((g) =>
      matchesNeedle(g.title, needle),
    );
    return needle ? list : list.slice(0, 5);
  }, [groupConversations, needle]);

  const filteredChannels = useMemo(() => {
    if (!needle) return [];
    return channelIndex.filter((row) => matchesNeedle(row.name, needle));
  }, [channelIndex, needle]);

  const hasResults =
    filteredUsers.length > 0 ||
    filteredGroups.length > 0 ||
    filteredChannels.length > 0;

  const goHome = useCallback(() => {
    if (window.location.pathname !== "/") navigate("/");
  }, [navigate]);

  const handleSelectUser = (userId) => {
    if (!authUser?._id || !userId) return;
    setSelectedConversation({
      conversationId: dmConversationId(authUser._id, userId),
      type: "DM",
      otherUserId: userId,
    });
    goHome();
    onClose?.();
  };

  const handleSelectGroup = (group) => {
    setSelectedConversation(group);
    goHome();
    onClose?.();
  };

  const handleSelectChannel = async (row) => {
    const group = row.groupConversation;
    if (!group) return;
    await openGroupAtChannel(group, {
      channelId: row.channelId,
      channelType: row.channelType,
      name: row.name,
    });
    goHome();
    onClose?.();
  };

  if (!open) return null;

  return (
    <div
      className="discord-modal-scrim fixed inset-0 z-[2200] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="presentation"
    >
      <div
        className="discord-modal-card flex w-full max-w-lg flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="find-conversation-title"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 id="find-conversation-title" className="font-semibold">
            Find a conversation
          </h3>
          <button
            type="button"
            className="discord-icon-button flex size-8 items-center justify-center rounded-full bg-white/5"
            onClick={() => onClose?.()}
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="border-b border-white/10 px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/50" />
            <input
              ref={inputRef}
              type="search"
              className="input discord-input-reset w-full rounded-xl border border-white/10 bg-black/10 py-2.5 pl-9 pr-4 text-sm"
              placeholder="Search people, groups, channels..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </div>
          {loadingChannels ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-(--discord-text-muted)">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Loading channels...</span>
            </div>
          ) : null}
        </div>

        <div className="discord-scroll max-h-[min(60vh,420px)] space-y-4 overflow-y-auto p-3">
          {!hasResults ? (
            <p className="px-2 py-6 text-center text-sm text-(--discord-text-muted)">
              {needle
                ? "No results found."
                : "No recent conversations. Try searching by name."}
            </p>
          ) : null}

          {filteredUsers.length > 0 ? (
            <Section title="Users">
              {filteredUsers.map((u) => (
                <ResultRow
                  key={`user_${u.userId}`}
                  icon={User}
                  title={u.fullName}
                  subtitle={u.email}
                  avatar={u.profilePic}
                  onClick={() => handleSelectUser(u.userId)}
                />
              ))}
            </Section>
          ) : null}

          {filteredGroups.length > 0 ? (
            <Section title="Groups">
              {filteredGroups.map((g) => (
                <ResultRow
                  key={`group_${g.conversationId}`}
                  icon={Users}
                  title={g.title || "Group"}
                  subtitle="Group chat"
                  avatar={g.avatar || "/avatar.png"}
                  onClick={() => handleSelectGroup(g)}
                />
              ))}
            </Section>
          ) : null}

          {filteredChannels.length > 0 ? (
            <Section title="Channels">
              {filteredChannels.map((row) => {
                const ChannelIcon =
                  row.channelType === "VOICE" ? Volume2 : Hash;
                return (
                  <ResultRow
                    key={`ch_${row.conversationId}_${row.channelId}`}
                    icon={ChannelIcon}
                    title={row.name}
                    subtitle={`${row.groupTitle} · ${channelTypeLabel(row.channelType)}`}
                    avatar={row.groupAvatar}
                    onClick={() => handleSelectChannel(row)}
                  />
                );
              })}
            </Section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

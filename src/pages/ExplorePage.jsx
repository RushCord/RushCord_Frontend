import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Compass,
  Loader2,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import ExploreGroupsPanel from "../components/ExploreGroupsPanel";

const EXPLORE_TABS = [
  { id: "users", label: "Người dùng", icon: UserRound },
  { id: "groups", label: "Nhóm", icon: Users },
];

export const ExplorePage = () => {
  const navigate = useNavigate();

  const [tab, setTab] = useState("users");

  const [userQ, setUserQ] = useState("");
  const [userDebounced, setUserDebounced] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [userLoading, setUserLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setUserDebounced(userQ.trim()), 350);
    return () => clearTimeout(t);
  }, [userQ]);

  const fetchUserSearch = useCallback(async () => {
    setUserLoading(true);
    try {
      const res = await axiosInstance.get("/users/search", {
        params: { q: userDebounced, limit: 40 },
      });
      setUserResults(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error(
        e.response?.data?.error ||
          e.response?.data?.message ||
          "Không tải được danh sách",
      );
      setUserResults([]);
    } finally {
      setUserLoading(false);
    }
  }, [userDebounced]);

  useEffect(() => {
    if (tab !== "users") return;
    fetchUserSearch();
  }, [tab, fetchUserSearch]);

  return (
    <div className="min-h-screen w-full bg-[var(--discord-app)] px-6 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="discord-card overflow-hidden">
          <div className="discord-topbar px-5 py-4">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="discord-icon-button mb-3 flex size-10 items-center justify-center rounded-full bg-white/5 md:hidden"
              aria-label="Về trang chủ"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="discord-section-title mb-1">Khám phá</div>
            <h1 className="flex items-center gap-2 text-xl font-semibold">
              <Compass className="size-5 text-primary" />
              Explore
            </h1>
            <p className="mt-1 text-sm text-base-content/70">
              Tìm người dùng hoặc khám phá nhóm công khai theo chủ đề.
            </p>
          </div>
        </div>

        <div className="flex gap-2 rounded-xl border border-white/10 bg-black/10 p-1">
          {EXPLORE_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                tab === id
                  ? "bg-primary text-primary-content shadow"
                  : "text-base-content/70 hover:bg-white/5 hover:text-base-content"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>

        {tab === "users" && (
          <>
            <div className="discord-card p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/40" />
                <input
                  type="search"
                  className="input discord-input-reset h-12 w-full rounded-xl border border-white/10 bg-black/10 py-2 pl-10 pr-4"
                  placeholder="Tìm theo tên, email hoặc ID..."
                  value={userQ}
                  onChange={(e) => setUserQ(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="discord-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-base-content/80">
                  Người dùng
                </h2>
                {userLoading && (
                  <Loader2 className="size-4 animate-spin text-primary" />
                )}
              </div>
              <div className="space-y-2">
                {userResults.map((u) => (
                  <Link
                    key={u._id}
                    to={`/profile/${encodeURIComponent(String(u._id))}`}
                    className="discord-list-item flex items-center gap-3 rounded-xl border border-white/10 bg-black/10 px-3 py-3 transition hover:border-primary/30 hover:bg-white/5"
                  >
                    <img
                      src={u.profilePic || "/avatar.png"}
                      alt=""
                      className="size-11 shrink-0 rounded-full border border-white/10 object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {u.fullName || "User"}
                      </div>
                      <div className="truncate text-xs text-base-content/60">
                        {u.email || ""}
                      </div>
                    </div>
                  </Link>
                ))}
                {!userLoading && userResults.length === 0 && (
                  <div className="py-8 text-center text-sm text-base-content/60">
                    Không có người dùng phù hợp.
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {tab === "groups" && (
          <ExploreGroupsPanel
            showPageHeader={false}
            onAfterJoin={() => navigate("/")}
            className="!px-0 !py-0"
          />
        )}
      </div>
    </div>
  );
};

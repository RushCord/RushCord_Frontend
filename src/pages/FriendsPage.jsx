import { useEffect, useMemo, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useNavigate, useSearchParams } from "react-router-dom";
import { UserPlus, Users } from "lucide-react";
import toast from "react-hot-toast";

function dmConversationId(a, b) {
  const [x, y] = [String(a || ""), String(b || "")].sort();
  return `DM#${x}#${y}`;
}

export const FriendsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const {
    users,
    friends,
    incomingFriendRequests,
    outgoingFriendRequests,
    getUsers,
    getFriends,
    getFriendRequests,
    sendFriendRequest,
    acceptFriendRequest,
    deleteFriendRequest,
    setSelectedConversation,
  } = useChatStore();

  const { authUser } = useAuthStore();

  const [addFriendEmail, setAddFriendEmail] = useState("");

  useEffect(() => {
    getUsers();
    getFriends();
    getFriendRequests();
  }, [getUsers]);

  useEffect(() => {
    const shouldFocus = searchParams.get("add") === "1";
    if (!shouldFocus) return;
    const el = document.getElementById("add-friend-section");
    el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [searchParams]);

  const knownIds = useMemo(() => {
    const s = new Set();
    for (const f of friends) s.add(String(f.otherUserId));
    for (const r of incomingFriendRequests) s.add(String(r.otherUserId));
    for (const r of outgoingFriendRequests) s.add(String(r.otherUserId));
    s.add(String(authUser?._id || ""));
    return s;
  }, [friends, incomingFriendRequests, outgoingFriendRequests, authUser?._id]);

  const addableUsers = useMemo(() => {
    return users.filter((u) => !knownIds.has(String(u._id)));
  }, [users, knownIds]);

  const addableEmails = useMemo(() => {
    return addableUsers
      .map((u) => String(u?.email || "").trim().toLowerCase())
      .filter(Boolean)
      .sort();
  }, [addableUsers]);

  return (
    <div className="min-h-screen w-full bg-[var(--discord-app)] px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="discord-card overflow-hidden">
          <div className="discord-topbar flex items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <div className="discord-section-title mb-1">Social</div>
              <h1 className="flex items-center gap-2 text-xl font-semibold">
                <Users className="w-5 h-5 text-primary" />
                Friends
              </h1>
              <p className="text-sm text-base-content/70">
                Manage friends, requests, and quick-start direct messages.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="discord-section-title mb-1">Quick Add</div>
            <h2 className="text-lg font-semibold">Add a friend by email</h2>
          </div>
        </div>

        <div
          id="add-friend-section"
          className="discord-card p-5"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-medium flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Add friend
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <input
                className="input discord-input-reset h-11 w-full rounded-xl border border-white/10 bg-black/10 px-4"
                placeholder="Enter friend's email (e.g. name@gmail.com)"
                value={addFriendEmail}
                onChange={(e) => setAddFriendEmail(e.target.value)}
                list="addable-emails"
                inputMode="email"
                autoComplete="off"
              />
              <datalist id="addable-emails">
                {addableEmails.map((em) => (
                  <option key={em} value={em} />
                ))}
              </datalist>
            </div>
            <button
              type="button"
              className="btn btn-primary rounded-lg border-0"
              disabled={!String(addFriendEmail || "").trim()}
              onClick={async () => {
                const email = String(addFriendEmail || "").trim().toLowerCase();
                const u = users.find(
                  (x) => String(x?.email || "").trim().toLowerCase() === email,
                );
                if (!u?._id) {
                  toast.error("Không tìm thấy người dùng với email này");
                  return;
                }
                if (knownIds.has(String(u._id))) {
                  toast.error("Bạn đã là bạn bè / đã gửi lời mời với email này");
                  return;
                }
                await sendFriendRequest(u._id);
                setAddFriendEmail("");
              }}
            >
              Send request
            </button>
          </div>

          <div className="mt-2 text-xs text-base-content/60">
            Add friend by email. Suggestions show only users not already friends / requested.
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="discord-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium">Friends ({friends.length})</h2>
            </div>

            <div className="space-y-2">
              {friends.map((f) => {
                const u = users.find((x) => String(x._id) === String(f.otherUserId));
                const name = u?.fullName || "Friend";
                const email = u?.email || "";
                const avatar = u?.profilePic || "/avatar.png";
                return (
                  <div
                    key={f.otherUserId}
                    className="discord-list-item justify-between rounded-lg border border-white/10 bg-black/10"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={avatar}
                        alt={name}
                        className="size-9 rounded-full border border-white/10 object-cover"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{name}</div>
                        <div className="text-xs text-base-content/60 truncate">
                          {email || "—"}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-xs rounded-md border-0 bg-primary/85 text-primary-content hover:bg-primary"
                      onClick={() => {
                        const cid = dmConversationId(authUser?._id, f.otherUserId);
                        setSelectedConversation({
                          conversationId: cid,
                          type: "DM",
                          otherUserId: f.otherUserId,
                        });
                        navigate("/");
                      }}
                    >
                      Chat
                    </button>
                  </div>
                );
              })}
              {friends.length === 0 && (
                <div className="text-sm text-base-content/60">No friends yet.</div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="discord-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-medium">
                  Incoming requests ({incomingFriendRequests.length})
                </h2>
              </div>
              <div className="space-y-2">
                {incomingFriendRequests.map((r) => {
                  const u = users.find((x) => String(x._id) === String(r.otherUserId));
                  const name = u?.fullName || "User";
                  const email = u?.email || "";
                  return (
                    <div
                      key={`in_${r.otherUserId}`}
                      className="discord-list-item justify-between rounded-lg border border-white/10 bg-black/10"
                    >
                      <div className="min-w-0">
                        <div className="text-sm truncate">{name}</div>
                        <div className="text-xs text-base-content/60 truncate">
                          {email || "—"}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          className="btn btn-xs btn-primary rounded-md border-0"
                          onClick={() => acceptFriendRequest(r.otherUserId)}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs rounded-md border-0 bg-white/5 hover:bg-white/10"
                          onClick={() => deleteFriendRequest(r.otherUserId)}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
                {incomingFriendRequests.length === 0 && (
                  <div className="text-sm text-base-content/60">No incoming requests.</div>
                )}
              </div>
            </div>
            </div>

            <div>
              <div className="discord-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-medium">
                  Outgoing requests ({outgoingFriendRequests.length})
                </h2>
              </div>
              <div className="space-y-2">
                {outgoingFriendRequests.map((r) => {
                  const u = users.find((x) => String(x._id) === String(r.otherUserId));
                  const name = u?.fullName || "User";
                  const email = u?.email || "";
                  return (
                    <div
                      key={`out_${r.otherUserId}`}
                      className="discord-list-item justify-between rounded-lg border border-white/10 bg-black/10"
                    >
                      <div className="min-w-0">
                        <div className="text-sm truncate">{name}</div>
                        <div className="text-xs text-base-content/60 truncate">
                          {email || "—"}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-xs rounded-md border-0 bg-white/5 hover:bg-white/10"
                        onClick={() => deleteFriendRequest(r.otherUserId)}
                      >
                        Cancel
                      </button>
                    </div>
                  );
                })}
                {outgoingFriendRequests.length === 0 && (
                  <div className="text-sm text-base-content/60">No outgoing requests.</div>
                )}
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


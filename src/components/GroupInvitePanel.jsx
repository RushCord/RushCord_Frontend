import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Loader2, QrCode, Trash2, X } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { buildInviteUrl } from "../lib/appBaseUrl";
import toast from "react-hot-toast";

const QUICK_EXPIRY = [
  { label: "1 giờ", hours: 1 },
  { label: "6 giờ", hours: 6 },
  { label: "24 giờ", hours: 24 },
  { label: "3 ngày", hours: 72 },
  { label: "7 ngày", hours: 168 },
  { label: "30 ngày", hours: 720 },
];

function toDatetimeLocalValue(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatExpiry(iso) {
  if (!iso) return "Không hết hạn";
  try {
    return new Date(iso).toLocaleString("vi-VN");
  } catch {
    return iso;
  }
}

function inviteStatusLabel(inv) {
  if (inv.revoked) return "Đã thu hồi";
  if (inv.expiresAt && new Date(inv.expiresAt).getTime() <= Date.now()) {
    return "Hết hạn";
  }
  if (
    inv.maxUses != null &&
    Number(inv.usesCount || 0) >= Number(inv.maxUses)
  ) {
    return "Hết lượt";
  }
  return "Đang hoạt động";
}

function inviteUrl(inv) {
  return inv.url || (inv.code ? buildInviteUrl(inv.code) : "");
}

export function GroupInvitePanel({
  conversationId,
  myRole,
  joinPolicy: joinPolicyProp,
}) {
  const {
    listGroupInvites,
    createGroupInvite,
    revokeGroupInvite,
    updateGroupJoinPolicy,
  } = useChatStore();

  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expiryMode, setExpiryMode] = useState("never");
  const [customExpiresAt, setCustomExpiresAt] = useState("");
  const [durationValue, setDurationValue] = useState("7");
  const [durationUnit, setDurationUnit] = useState("days");
  const [maxUses, setMaxUses] = useState("");
  const [qrCode, setQrCode] = useState(null);
  const [joinPolicy, setJoinPolicy] = useState(
    joinPolicyProp === "INVITE_ONLY" ? "INVITE_ONLY" : "OPEN",
  );
  const [policySaving, setPolicySaving] = useState(false);

  const minDatetimeLocal = useMemo(
    () => toDatetimeLocalValue(new Date(Date.now() + 5 * 60 * 1000)),
    [],
  );

  const canManage = myRole === "OWNER" || myRole === "ADMIN";
  const isOwner = myRole === "OWNER";

  const loadInvites = useCallback(async () => {
    if (!conversationId || !canManage) return;
    setLoading(true);
    const items = await listGroupInvites(conversationId);
    setInvites(items);
    setLoading(false);
  }, [conversationId, canManage, listGroupInvites]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  useEffect(() => {
    setJoinPolicy(joinPolicyProp === "INVITE_ONLY" ? "INVITE_ONLY" : "OPEN");
  }, [joinPolicyProp, conversationId]);

  if (!canManage) return null;

  const buildExpiryPayload = () => {
    if (expiryMode === "never") {
      return { expiresAt: null };
    }
    if (expiryMode === "custom") {
      if (!customExpiresAt) {
        toast.error("Chọn thời điểm hết hạn");
        return null;
      }
      const t = new Date(customExpiresAt).getTime();
      if (!Number.isFinite(t) || t <= Date.now()) {
        toast.error("Thời điểm hết hạn phải ở tương lai");
        return null;
      }
      return { expiresAt: new Date(t).toISOString() };
    }
    const n = Number(durationValue);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Nhập thời hạn hợp lệ");
      return null;
    }
    const hours = durationUnit === "hours" ? n : n * 24;
    return { expiresInHours: hours };
  };

  const handleCreate = async () => {
    const expiry = buildExpiryPayload();
    if (!expiry) return;

    setCreating(true);
    const created = await createGroupInvite(conversationId, {
      ...expiry,
      maxUses: maxUses === "" ? undefined : Number(maxUses),
    });
    setCreating(false);
    if (created) {
      setInvites((prev) => [
        created,
        ...prev.filter((x) => x.inviteId !== created.inviteId),
      ]);
    }
  };

  const applyQuickExpiry = (hours) => {
    setExpiryMode("custom");
    setCustomExpiresAt(
      toDatetimeLocalValue(Date.now() + hours * 60 * 60 * 1000),
    );
  };

  const handleCopy = async (url) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Đã sao chép link");
    } catch {
      toast.error("Không sao chép được link");
    }
  };

  const handleRevoke = async (inviteId) => {
    const ok = await revokeGroupInvite(conversationId, inviteId);
    if (ok) await loadInvites();
  };

  const handlePolicyToggle = async () => {
    const next = joinPolicy === "INVITE_ONLY" ? "OPEN" : "INVITE_ONLY";
    setPolicySaving(true);
    const out = await updateGroupJoinPolicy(conversationId, next);
    setPolicySaving(false);
    if (out) setJoinPolicy(next);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-black/10">
      <div className="px-3 py-3 border-b border-white/10">
        <div className="text-sm font-medium">Lời mời tham gia</div>
        <p className="text-[11px] text-base-content/50 mt-1">
          Chia sẻ link hoặc mã QR để mời người khác vào nhóm
        </p>
      </div>

      <div className="px-3 py-3 space-y-3">
        {isOwner ? (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-sm checkbox-primary mt-0.5"
              checked={joinPolicy === "INVITE_ONLY"}
              disabled={policySaving}
              onChange={handlePolicyToggle}
            />
            <span className="text-xs">
              <span className="font-medium">Chỉ mời</span>
              <span className="block text-base-content/50 mt-0.5">
                Ẩn khỏi Khám phá; chỉ vào nhóm bằng link mời
              </span>
            </span>
          </label>
        ) : null}

        <div className="space-y-2">
          <label className="text-[11px] text-base-content/60">Thời hạn</label>
          <select
            className="select select-sm w-full rounded-lg border border-white/10 bg-black/20"
            value={expiryMode}
            onChange={(e) => setExpiryMode(e.target.value)}
          >
            <option value="never">Không hết hạn</option>
            <option value="duration">Số giờ / ngày</option>
            <option value="custom">Chọn ngày giờ cụ thể</option>
          </select>

          {expiryMode === "duration" ? (
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                className="input input-sm flex-1 rounded-lg border border-white/10 bg-black/20"
                value={durationValue}
                onChange={(e) => setDurationValue(e.target.value)}
              />
              <select
                className="select select-sm rounded-lg border border-white/10 bg-black/20"
                value={durationUnit}
                onChange={(e) => setDurationUnit(e.target.value)}
              >
                <option value="hours">Giờ</option>
                <option value="days">Ngày</option>
              </select>
            </div>
          ) : null}

          {expiryMode === "custom" ? (
            <>
              <input
                type="datetime-local"
                min={minDatetimeLocal}
                className="input input-sm w-full rounded-lg border border-white/10 bg-black/20"
                value={customExpiresAt}
                onChange={(e) => setCustomExpiresAt(e.target.value)}
              />
              <div className="flex flex-wrap gap-1">
                {QUICK_EXPIRY.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    className="btn btn-xs rounded-md border-0 bg-white/10"
                    onClick={() => applyQuickExpiry(q.hours)}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div>
          <label className="text-[11px] text-base-content/60">
            Số lượt tối đa
          </label>
          <input
            type="number"
            min={1}
            placeholder="Không giới hạn"
            className="input input-sm w-full mt-1 rounded-lg border border-white/10 bg-black/20"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="btn btn-sm btn-primary w-full rounded-lg border-0"
          disabled={creating}
          onClick={handleCreate}
        >
          {creating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Đang tạo...
            </>
          ) : (
            "Tạo lời mời mới"
          )}
        </button>

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : invites.length === 0 ? (
          <p className="text-xs text-center text-base-content/50 py-2">
            Chưa có lời mời nào
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {invites.map((inv) => {
              const url = inviteUrl(inv);
              const status = inviteStatusLabel(inv);
              const active = status === "Đang hoạt động";
              const showActions = !inv.revoked;

              return (
                <div
                  key={inv.inviteId}
                  className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={
                        active ? "text-success" : "text-base-content/50"
                      }
                    >
                      {status}
                    </span>
                    <span className="text-base-content/60">
                      {inv.usesCount ?? 0}
                      {inv.maxUses != null ? ` / ${inv.maxUses}` : ""} lượt
                    </span>
                  </div>
                  <p className="text-base-content/50 mt-1">
                    Hết hạn: {formatExpiry(inv.expiresAt)}
                  </p>
                  {!active && showActions ? (
                    <p className="text-[10px] text-warning/80 mt-1">
                      Không thể dùng để tham gia mới, vẫn xem được link/QR
                    </p>
                  ) : null}

                  {showActions && url ? (
                    <div className="flex gap-1 mt-2">
                      <button
                        type="button"
                        className="btn btn-xs flex-1 rounded-md border-0 bg-white/10"
                        onClick={() => handleCopy(url)}
                      >
                        <Copy className="size-3" />
                        Link
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs rounded-md border-0 bg-white/10"
                        onClick={() => setQrCode(url)}
                        title="Mã QR"
                      >
                        <QrCode className="size-3" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs rounded-md border-0 bg-error/20 text-error"
                        onClick={() => handleRevoke(inv.inviteId)}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ) : showActions && !url ? (
                    <p className="text-[10px] text-base-content/45 mt-2">
                      Lời mời tạo trước khi cập nhật — tạo lời mời mới để có
                      link
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {qrCode ? (
        <div className="fixed inset-0 z-3000 flex items-center justify-center p-4 bg-black/60">
          <div className="discord-card p-6 max-w-sm w-full text-center">
            <div className="flex justify-end mb-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-circle"
                onClick={() => setQrCode(null)}
              >
                <X className="size-4" />
              </button>
            </div>
            <QRCodeSVG value={qrCode} size={200} className="mx-auto" />
            <p className="text-xs text-base-content/60 mt-4 break-all">
              {qrCode}
            </p>
            <button
              type="button"
              className="btn btn-sm btn-primary mt-4 rounded-lg border-0"
              onClick={() => handleCopy(qrCode)}
            >
              Sao chép link
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

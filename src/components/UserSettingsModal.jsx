import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronRight,
  CircleUserRound,
  Gamepad2,
  Gift,
  Headphones,
  Link as LinkIcon,
  Mic,
  Monitor,
  Search,
  Shield,
  User,
  X,
} from "lucide-react";
import { THEMES } from "../constants";
import { useThemeStore } from "../store/useThemeStore";
import { useAuthStore } from "../store/useAuthStore";
import { uploadFileViaPresign } from "../lib/uploadMedia";
import toast from "react-hot-toast";

const THEME_PRESETS = ["light", "dark", "night", "dim", "coffee"];

const SIDEBAR_GROUPS = [
  {
    title: "Cài đặt người dùng",
    items: [
      { key: "account", label: "Tài Khoản Của Tôi", icon: User },
      { key: "profile", label: "Nội Dung & Cộng Đồng", icon: CircleUserRound, disabled: true },
      { key: "security", label: "Dữ Liệu & Bảo Mật", icon: Shield, disabled: true },
      { key: "family", label: "Trung Tâm Gia Đình", icon: Gamepad2, disabled: true },
      { key: "apps", label: "Ứng Dụng Được Cho Phép", icon: ChevronRight, disabled: true },
      { key: "devices", label: "Thiết bị", icon: Monitor, disabled: true },
      { key: "connections", label: "Kết Nối", icon: LinkIcon, disabled: true },
      { key: "notifications", label: "Các Thông Báo", icon: Bell, disabled: true },
    ],
  },
  {
    title: "Cài Đặt Thanh Toán",
    items: [
      { key: "nitro", label: "Nitro", icon: Gift, disabled: true },
      { key: "boosts", label: "Nâng Cấp Máy Chủ", icon: Shield, disabled: true },
      { key: "subs", label: "Đăng Ký", icon: ChevronRight, disabled: true },
      { key: "gift", label: "Kho Quà Tặng", icon: Gift, disabled: true },
      { key: "billing", label: "Thanh toán", icon: ChevronRight, disabled: true },
    ],
  },
  {
    title: "Cài Đặt Ứng Dụng",
    items: [
      { key: "voice", label: "Giọng nói và Video", icon: Mic, disabled: true },
      { key: "display", label: "Hiển thị", icon: Monitor },
      { key: "audio", label: "Âm thanh", icon: Headphones, disabled: true },
    ],
  },
];

export default function UserSettingsModal({ open, onClose }) {
  const { theme, setTheme } = useThemeStore();
  const { authUser, updateProfile, isUpdatingProfile, logout } = useAuthStore();
  const [activeSection, setActiveSection] = useState("account");
  const [previewTheme, setPreviewTheme] = useState(theme);
  const [fullName, setFullName] = useState("");
  const [emailDisplay, setEmailDisplay] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");

  useEffect(() => {
    if (!open) return;
    setActiveSection("account");
    setPreviewTheme(theme);
    setFullName(authUser?.fullName || "");
    setEmailDisplay(authUser?.email || "");
    setAvatarPreview(authUser?.profilePic || "/avatar.png");
  }, [open, authUser, theme]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  const displayThemeOptions = useMemo(() => {
    const preferred = THEME_PRESETS.filter((x) => THEMES.includes(x)).map((id) => ({ id }));
    const fallback = THEMES
      .filter((x) => !preferred.some((p) => p.id === x))
      .slice(0, 8)
      .map((id) => ({ id }));
    return [...preferred, ...fallback];
  }, []);

  if (!open) return null;

  const handleSaveProfile = async () => {
    const nextName = String(fullName || "").trim();
    if (!nextName) {
      toast.error("Tên hiển thị không được để trống");
      return;
    }
    await updateProfile({ fullName: nextName });
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const temp = URL.createObjectURL(file);
    setAvatarPreview(temp);
    try {
      const { publicUrl } = await uploadFileViaPresign(file, "avatar");
      await updateProfile({ profilePic: publicUrl });
      setAvatarPreview(publicUrl);
    } catch (error) {
      toast.error(error?.message || "Không thể cập nhật ảnh đại diện");
      setAvatarPreview(authUser?.profilePic || "/avatar.png");
    } finally {
      URL.revokeObjectURL(temp);
      event.target.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-2500 flex items-stretch justify-center bg-black/70" role="dialog" aria-modal="true">
      <div className="flex h-full w-full max-w-[1220px] overflow-hidden border border-(--discord-border) bg-(--discord-panel) shadow-2xl">
        <aside className="w-[320px] min-w-[320px] overflow-y-auto border-r border-(--discord-border) bg-(--discord-sidebar) px-4 py-4">
          <div className="mb-3 flex items-center gap-2 rounded-md border border-(--discord-border) bg-(--discord-rail) px-3 py-2 text-(--discord-text-muted)">
            <Search className="size-4" />
            <input
              type="text"
              value=""
              readOnly
              placeholder="Tìm kiếm"
              className="w-full bg-transparent text-sm outline-none placeholder:text-(--discord-text-muted)"
            />
          </div>

          {SIDEBAR_GROUPS.map((group) => (
            <div key={group.title} className="mb-4">
              <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-(--discord-text-muted)">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeSection === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      disabled={item.disabled}
                      onClick={() => setActiveSection(item.key)}
                      className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[15px] ${
                        active
                          ? "bg-(--discord-active) text-white"
                          : item.disabled
                            ? "cursor-not-allowed text-[#6b6f78]"
                            : "text-(--discord-text) hover:bg-(--discord-hover)"
                      }`}
                    >
                      <Icon className="size-4" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="mt-4 border-t border-(--discord-border) pt-4">
            <button
              type="button"
              onClick={async () => {
                await logout();
                onClose?.();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[15px] text-red-400 hover:bg-red-500/15 hover:text-red-300"
            >
              <ChevronRight className="size-4 rotate-180" />
              <span>Đăng Xuất</span>
            </button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-(--discord-panel)">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">
              {activeSection === "display" ? "Hiển thị" : "Tài Khoản Của Tôi"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-md text-(--discord-text-muted) hover:bg-(--discord-hover) hover:text-(--discord-text)"
              aria-label="Đóng"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            {activeSection === "display" ? (
              <div className="max-w-3xl space-y-6">
                <div>
                  <h3 className="mb-2 text-2xl font-semibold text-(--discord-text)">Nền</h3>
                  <div className="text-sm text-(--discord-text-muted)">Nền Chủ Đề Mặc Định</div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {displayThemeOptions.map((option) => {
                    const active = previewTheme === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setPreviewTheme(option.id)}
                        className={`relative size-11 rounded-lg border transition ${
                          active
                            ? "border-(--discord-accent) ring-2 ring-(--discord-accent)"
                            : "border-white/20 hover:border-white/40"
                        }`}
                        title={option.id}
                      >
                        <div
                          data-theme={option.id}
                          className="flex h-full w-full overflow-hidden rounded-md"
                        >
                          <div
                            className="w-2/5"
                            style={{ backgroundColor: "var(--discord-sidebar)" }}
                          />
                          <div
                            className="w-3/5"
                            style={{ backgroundColor: "var(--discord-chat)" }}
                          />
                        </div>
                        {active ? (
                          <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-(--discord-accent) text-[10px] text-white">
                            ✓
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-xl border border-(--discord-border) bg-(--discord-rail) p-4">
                  <div className="mb-2 text-sm font-semibold text-(--discord-text)">Màu sắc chủ đề</div>
                  <p className="text-sm text-(--discord-text-muted)">
                    Chọn một chủ đề để áp dụng cho toàn bộ giao diện ứng dụng.
                  </p>
                </div>

                <div
                  data-theme={previewTheme}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: "var(--discord-border)",
                    backgroundColor: "var(--discord-app)",
                  }}
                >
                  <div className="mb-3 text-sm font-semibold" style={{ color: "var(--discord-text)" }}>
                    Preview trước khi đổi màu
                  </div>
                  <div
                    className="flex items-stretch overflow-hidden rounded-lg border"
                    style={{ borderColor: "var(--discord-border)" }}
                  >
                    <div className="w-16 p-2" style={{ backgroundColor: "var(--discord-rail)" }}>
                      <div className="mb-2 size-8 rounded-xl" style={{ backgroundColor: "var(--discord-accent)" }} />
                      <div className="size-8 rounded-xl" style={{ backgroundColor: "var(--discord-sidebar)" }} />
                    </div>
                    <div className="w-40 p-3" style={{ backgroundColor: "var(--discord-sidebar)" }}>
                      <div className="mb-2 h-3 w-20 rounded" style={{ backgroundColor: "var(--discord-hover)" }} />
                      <div className="mb-1 h-2.5 w-24 rounded" style={{ backgroundColor: "var(--discord-active)" }} />
                      <div className="h-2.5 w-16 rounded" style={{ backgroundColor: "var(--discord-hover)" }} />
                    </div>
                    <div className="flex-1 p-3" style={{ backgroundColor: "var(--discord-chat)" }}>
                      <div className="mb-2 h-3 w-24 rounded" style={{ backgroundColor: "var(--discord-hover)" }} />
                      <div className="h-16 rounded" style={{ backgroundColor: "var(--discord-panel-strong)" }} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTheme(previewTheme)}
                    className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-content"
                  >
                    Áp dụng màu
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTheme(theme)}
                    className="rounded-md border border-(--discord-border) px-3 py-2 text-sm text-(--discord-text-muted) hover:bg-(--discord-hover)"
                  >
                    Hoàn tác preview
                  </button>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl space-y-6">
                <div className="rounded-xl border border-(--discord-border) bg-(--discord-rail) p-4">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={avatarPreview || "/avatar.png"}
                        alt={authUser?.fullName || "Profile"}
                        className="size-18 rounded-full border border-white/10 object-cover"
                      />
                      <label className="absolute -bottom-1 -right-1 flex size-7 cursor-pointer items-center justify-center rounded-full bg-(--discord-accent) text-white">
                        <span className="text-xs">+</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarUpload}
                        />
                      </label>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-white">{authUser?.fullName || "User"}</div>
                      <div className="text-sm text-(--discord-text-muted)">{authUser?.email || ""}</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={isUpdatingProfile}
                    className="rounded-md bg-(--discord-accent) px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {isUpdatingProfile ? "Đang lưu..." : "Chỉnh Sửa Hồ Sơ Người Dùng"}
                  </button>
                </div>

                <div className="space-y-3 rounded-xl border border-(--discord-border) bg-(--discord-rail) p-4">
                  <label className="block">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-(--discord-text-muted)">
                      Tên hiển thị
                    </div>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full rounded-md border border-(--discord-border) bg-(--discord-sidebar) px-3 py-2 text-sm text-(--discord-text) outline-none focus:border-(--discord-accent)"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-(--discord-text-muted)">
                      Email
                    </div>
                    <input
                      type="text"
                      value={emailDisplay}
                      readOnly
                      className="w-full rounded-md border border-(--discord-border) bg-(--discord-sidebar) px-3 py-2 text-sm text-(--discord-text-muted)"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

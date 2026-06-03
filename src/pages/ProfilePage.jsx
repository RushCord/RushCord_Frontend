import { useState, useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { uploadFileViaPresign } from "../lib/uploadMedia.js";
import {
  ArrowLeft,
  Calendar,
  Camera,
  Eye,
  EyeOff,
  Images,
  Lock,
  Mail,
  Pencil,
  Shield,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
function formatDobDisplay(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "—";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

function genderLabel(code) {
  const c = String(code || "").toUpperCase();
  if (c === "MALE") return "Nam";
  if (c === "FEMALE") return "Nữ";
  if (c === "OTHER") return "Khác";
  return "—";
}

function splitFullName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return { lastName: "", firstName: "" };
  if (parts.length === 1) return { lastName: "", firstName: parts[0] };
  return { lastName: parts[0], firstName: parts.slice(1).join(" ") };
}

function buildFullName(lastName, firstName) {
  return [String(lastName || "").trim(), String(firstName || "").trim()]
    .filter(Boolean)
    .join(" ");
}

const PROFILE_SECTIONS = [
  { key: "personal", label: "Thông tin cá nhân", icon: User },
  { key: "security", label: "Thông tin bảo mật", icon: Shield },
];

export const ProfilePage = () => {
  const navigate = useNavigate();
  const {
    authUser,
    isUpdatingProfile,
    updateProfile,
    changePassword,
    isChangingPassword,
    requestEmailChange,
    isRequestingEmailChange,
  } = useAuthStore();
  const [selectedImg, setSelectedImg] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailChangePassword, setEmailChangePassword] = useState("");
  const [showEmailChangePassword, setShowEmailChangePassword] = useState(false);
  const [emailChangeSent, setEmailChangeSent] = useState(false);
  const [activeSection, setActiveSection] = useState("personal");
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [isEditingSecurity, setIsEditingSecurity] = useState(false);

  const resetPersonalForm = () => {
    if (!authUser) return;
    const { lastName: ln, firstName: fn } = splitFullName(authUser.fullName);
    setLastName(ln);
    setFirstName(fn);
    setBirthDate(authUser.dateOfBirth || "");
    setGender(authUser.gender || "");
    setCoverPreview(null);
    setSelectedImg(null);
  };

  const resetSecurityForm = () => {
    setNewEmail("");
    setEmailChangePassword("");
    setEmailChangeSent(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setShowEmailChangePassword(false);
  };

  useEffect(() => {
    resetPersonalForm();
  }, [authUser?._id, authUser?.fullName, authUser?.dateOfBirth, authUser?.gender]);

  const switchSection = (key) => {
    if (key !== activeSection) {
      if (isEditingPersonal) {
        resetPersonalForm();
        setIsEditingPersonal(false);
      }
      if (isEditingSecurity) {
        resetSecurityForm();
        setIsEditingSecurity(false);
      }
    }
    setActiveSection(key);
  };

  const handleImageUpload = async (e) => {
    if (!isEditingPersonal) return;
    const file = e.target.files[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setSelectedImg(previewUrl);

    try {
      const { publicUrl } = await uploadFileViaPresign(file, "avatar");
      await updateProfile({ profilePic: publicUrl });
    } catch (err) {
      toast.error(err?.message || "Upload failed");
    } finally {
      URL.revokeObjectURL(previewUrl);
      setSelectedImg(null);
      e.target.value = "";
    }
  };

  const handleCoverUpload = async (e) => {
    if (!isEditingPersonal) return;
    const file = e.target.files[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setCoverPreview(previewUrl);

    try {
      const { publicUrl } = await uploadFileViaPresign(file, "cover");
      await updateProfile({ coverPic: publicUrl });
    } catch (err) {
      toast.error(err?.message || "Upload failed");
    } finally {
      URL.revokeObjectURL(previewUrl);
      setCoverPreview(null);
      e.target.value = "";
    }
  };

  const handleSaveDetails = async () => {
    const fullName = buildFullName(lastName, firstName);
    if (!fullName) {
      toast.error("Họ và tên không được để trống");
      return;
    }
    try {
      await updateProfile({ fullName, dateOfBirth: birthDate, gender });
      setIsEditingPersonal(false);
      setCoverPreview(null);
      setSelectedImg(null);
    } catch {
      /* toast in store */
    }
  };

  const handleCancelPersonal = () => {
    resetPersonalForm();
    setIsEditingPersonal(false);
  };

  const handleCancelSecurity = () => {
    resetSecurityForm();
    setIsEditingSecurity(false);
  };

  const handleRequestEmailChange = async () => {
    const trimmed = newEmail.trim();
    if (!trimmed) {
      toast.error("Vui lòng nhập email mới");
      return;
    }
    if (!emailChangePassword) {
      toast.error("Vui lòng nhập mật khẩu để xác nhận");
      return;
    }
    if (trimmed.toLowerCase() === (authUser?.email || "").toLowerCase()) {
      toast.error("Email mới phải khác email hiện tại");
      return;
    }
    try {
      await requestEmailChange({ newEmail: trimmed, password: emailChangePassword });
      setEmailChangeSent(true);
      setEmailChangePassword("");
      setNewEmail("");
    } catch {
      /* toast in store */
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Vui lòng điền đầy đủ các trường mật khẩu");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Mật khẩu mới phải có ít nhất 8 ký tự");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }
    if (currentPassword === newPassword) {
      toast.error("Mật khẩu mới phải khác mật khẩu hiện tại");
      return;
    }
    try {
      await changePassword({ currentPassword, newPassword });
      resetSecurityForm();
      setIsEditingSecurity(false);
    } catch {
      /* toast in store */
    }
  };

  const displayName = buildFullName(lastName, firstName) || authUser?.fullName || "User";

  if (!authUser) return null;

  const coverSrc = coverPreview || authUser.coverPic;

  const renderSectionNav = (section) => {
    const Icon = section.icon;
    const active = activeSection === section.key;
    return (
      <button
        key={section.key}
        type="button"
        onClick={() => switchSection(section.key)}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${
          active
            ? "bg-primary/15 font-medium text-primary"
            : "text-base-content/70 hover:bg-white/5 hover:text-base-content"
        }`}
      >
        <Icon className="size-4 shrink-0" />
        <span>{section.label}</span>
      </button>
    );
  };

  return (
    <div className="h-screen overflow-hidden bg-(--discord-app) text-(--discord-text)">
      <div className="h-full min-h-0 overflow-y-auto px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto max-w-4xl">
          <div className="discord-card overflow-hidden">
            <div className="discord-topbar border-b border-white/10 px-4 py-4 md:px-6 md:py-5">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="discord-icon-button mb-3 flex size-10 items-center justify-center rounded-full bg-white/5"
                aria-label="Quay lại tin nhắn"
                title="Quay lại"
              >
                <ArrowLeft className="size-5" />
              </button>
              <div className="discord-section-title mb-1">Cài đặt tài khoản</div>
              <h1 className="text-xl font-semibold md:text-2xl">Tài khoản của tôi</h1>
              <p className="mt-1 text-sm text-base-content/70">
                Quản lý hồ sơ và bảo mật đăng nhập.
              </p>
              <div className="mt-4 flex flex-col gap-1 sm:hidden">
                {PROFILE_SECTIONS.map(renderSectionNav)}
              </div>
            </div>

            <div className="flex min-h-[480px] flex-col md:flex-row">
              <aside className="hidden w-[220px] shrink-0 border-r border-white/10 bg-black/5 p-4 md:block">
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-base-content/50">
                  Danh mục
                </p>
                <nav className="space-y-1">{PROFILE_SECTIONS.map(renderSectionNav)}</nav>
              </aside>

              <div className="min-w-0 flex-1 p-4 md:p-6">
                {activeSection === "personal" && (
                  <div className="space-y-6">
                    <div className="overflow-hidden rounded-xl border border-white/10">
                      <div className="relative h-36 md:h-40">
                        {coverSrc ? (
                          <img src={coverSrc} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-r from-primary/35 via-purple-900/40 to-slate-900" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                        {isEditingPersonal && (
                          <label
                            htmlFor="cover-upload"
                            className={`absolute right-3 top-3 flex cursor-pointer items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-black/55 ${
                              isUpdatingProfile ? "pointer-events-none opacity-60" : ""
                            }`}
                          >
                            <Images className="size-4" />
                            Ảnh bìa
                            <input
                              type="file"
                              id="cover-upload"
                              className="hidden"
                              accept="image/*"
                              onChange={handleCoverUpload}
                              disabled={isUpdatingProfile}
                            />
                          </label>
                        )}
                        <div className="absolute inset-x-0 bottom-0 px-4 pb-3">
                          <div className="flex items-end gap-4">
                            <div className="relative shrink-0">
                              <img
                                src={selectedImg || authUser.profilePic || "/avatar.png"}
                                alt="Profile"
                                className="size-20 rounded-full border-4 border-[var(--discord-panel)] object-cover shadow-lg md:size-24"
                              />
                              {isEditingPersonal && (
                                <label
                                  htmlFor="avatar-upload"
                                  className={`absolute bottom-0 right-0 flex size-9 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-content shadow-lg transition hover:scale-105 ${
                                    isUpdatingProfile ? "animate-pulse pointer-events-none" : ""
                                  }`}
                                >
                                  <Camera className="size-4" />
                                  <input
                                    type="file"
                                    id="avatar-upload"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    disabled={isUpdatingProfile}
                                  />
                                </label>
                              )}
                            </div>
                            <h2 className="pb-1 text-lg font-semibold text-white drop-shadow-sm md:text-xl">
                              {displayName}
                            </h2>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-medium">Thông tin cá nhân</h2>
                        {!isEditingPersonal ? (
                          <button
                            type="button"
                            onClick={() => setIsEditingPersonal(true)}
                            className="btn btn-ghost btn-sm gap-2"
                          >
                            <Pencil className="size-4" />
                            Chỉnh sửa
                          </button>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={handleCancelPersonal}
                              disabled={isUpdatingProfile}
                              className="btn btn-ghost btn-sm"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveDetails}
                              disabled={isUpdatingProfile}
                              className="btn btn-primary btn-sm"
                            >
                              {isUpdatingProfile ? "Đang lưu..." : "Lưu"}
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-2 text-sm text-base-content/60">
                            <User className="size-4" />
                            Họ
                          </label>
                          {isEditingPersonal ? (
                            <input
                              type="text"
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              placeholder="Nguyễn"
                              className="w-full rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm"
                              autoComplete="family-name"
                            />
                          ) : (
                            <p className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm">
                              {lastName || "—"}
                            </p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-2 text-sm text-base-content/60">
                            <User className="size-4" />
                            Tên
                          </label>
                          {isEditingPersonal ? (
                            <input
                              type="text"
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              placeholder="Văn An"
                              className="w-full rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm"
                              autoComplete="given-name"
                            />
                          ) : (
                            <p className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm">
                              {firstName || "—"}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-2 text-sm text-base-content/60">
                            <Calendar className="size-4" />
                            Ngày sinh
                          </label>
                          {isEditingPersonal ? (
                            <input
                              type="date"
                              value={birthDate}
                              onChange={(e) => setBirthDate(e.target.value)}
                              className="w-full rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm"
                            />
                          ) : (
                            <p className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm">
                              {formatDobDisplay(birthDate)}
                            </p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-2 text-sm text-base-content/60">
                            <User className="size-4" />
                            Giới tính
                          </label>
                          {isEditingPersonal ? (
                            <select
                              value={gender}
                              onChange={(e) => setGender(e.target.value)}
                              className="discord-select w-full rounded-xl px-4 py-3 text-sm"
                            >
                              <option value="">Chưa chọn</option>
                              <option value="MALE">Nam</option>
                              <option value="FEMALE">Nữ</option>
                              <option value="OTHER">Khác</option>
                            </select>
                          ) : (
                            <p className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm">
                              {genderLabel(gender)}
                            </p>
                          )}
                        </div>
                      </div>

                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/5 p-5">
                      <h3 className="mb-3 text-sm font-medium text-base-content/80">
                        Tổng quan tài khoản
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center justify-between border-b border-white/10 py-2">
                          <span className="text-base-content/60">Ngày tham gia</span>
                          <span>{authUser.createdAt?.split("T")[0] ?? "—"}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-white/10 py-2">
                          <span className="text-base-content/60">Ngày sinh</span>
                          <span>{formatDobDisplay(authUser.dateOfBirth)}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-white/10 py-2">
                          <span className="text-base-content/60">Giới tính</span>
                          <span>{genderLabel(authUser.gender)}</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                          <span className="text-base-content/60">Trạng thái</span>
                          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                            Hoạt động
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === "security" && (
                  <div className="space-y-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-medium">Thông tin bảo mật</h2>
                        <p className="mt-1 text-sm text-base-content/60">
                          Quản lý email đăng nhập và mật khẩu.
                        </p>
                      </div>
                      {!isEditingSecurity ? (
                        <button
                          type="button"
                          onClick={() => setIsEditingSecurity(true)}
                          className="btn btn-ghost btn-sm gap-2"
                        >
                          <Pencil className="size-4" />
                          Chỉnh sửa
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleCancelSecurity}
                          disabled={isChangingPassword || isRequestingEmailChange}
                          className="btn btn-ghost btn-sm"
                        >
                          Hủy
                        </button>
                      )}
                    </div>

                    {!isEditingSecurity ? (
                      <div className="space-y-4 rounded-xl border border-white/10 bg-black/5 p-5">
                        <div className="flex items-center gap-2">
                          <Mail className="size-4 text-primary" />
                          <h3 className="font-medium">Email</h3>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm text-base-content/60">Email đăng nhập</label>
                          <p className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm">
                            {authUser?.email}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Lock className="size-4 text-base-content/50" />
                          <p className="text-sm text-base-content/60">
                            Bấm &quot;Chỉnh sửa&quot; để đổi email hoặc mật khẩu.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                    <div className="space-y-4 rounded-xl border border-white/10 bg-black/5 p-5">
                      <div className="flex items-center gap-2">
                        <Mail className="size-4 text-primary" />
                        <h3 className="font-medium">Email</h3>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm text-base-content/60">Email hiện tại</label>
                        <p className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm">
                          {authUser?.email}
                        </p>
                      </div>
                      <p className="text-sm text-base-content/60">
                        Đổi email: nhập email mới và mật khẩu. Chúng tôi gửi link xác nhận tới{" "}
                        <span className="font-medium text-base-content">{authUser?.email}</span>.
                      </p>
                      {emailChangeSent && (
                        <p className="text-sm text-emerald-400">
                          Đã gửi link — kiểm tra hộp thư email hiện tại (có hiệu lực 24 giờ).
                        </p>
                      )}
                      <div className="space-y-1.5">
                        <label className="text-sm text-base-content/60">Email mới</label>
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="email.moi@example.com"
                          className="w-full rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm"
                          autoComplete="email"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm text-base-content/60">
                          Mật khẩu (xác nhận đổi email)
                        </label>
                        <div className="relative">
                          <input
                            type={showEmailChangePassword ? "text" : "password"}
                            value={emailChangePassword}
                            onChange={(e) => setEmailChangePassword(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-black/10 py-3 pl-4 pr-10 text-sm"
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 flex items-center pr-3"
                            onClick={() => setShowEmailChangePassword(!showEmailChangePassword)}
                          >
                            {showEmailChangePassword ? (
                              <EyeOff className="size-4 text-base-content/40" />
                            ) : (
                              <Eye className="size-4 text-base-content/40" />
                            )}
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRequestEmailChange}
                        disabled={isRequestingEmailChange}
                        className="btn btn-primary w-full sm:w-auto"
                      >
                        {isRequestingEmailChange ? "Đang gửi..." : "Gửi link xác nhận"}
                      </button>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/5 p-5">
                      <div className="mb-4 flex items-center gap-2">
                        <Lock className="size-4 text-primary" />
                        <h3 className="font-medium">Đổi mật khẩu</h3>
                      </div>
                      <p className="mb-4 text-sm text-base-content/60">
                        Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.
                      </p>
                      <div className="space-y-4">
                        <PasswordField
                          label="Mật khẩu hiện tại"
                          value={currentPassword}
                          onChange={setCurrentPassword}
                          show={showCurrentPassword}
                          onToggleShow={() => setShowCurrentPassword(!showCurrentPassword)}
                          autoComplete="current-password"
                        />
                        <PasswordField
                          label="Mật khẩu mới"
                          value={newPassword}
                          onChange={setNewPassword}
                          show={showNewPassword}
                          onToggleShow={() => setShowNewPassword(!showNewPassword)}
                          autoComplete="new-password"
                        />
                        <PasswordField
                          label="Xác nhận mật khẩu mới"
                          value={confirmPassword}
                          onChange={setConfirmPassword}
                          show={showConfirmPassword}
                          onToggleShow={() => setShowConfirmPassword(!showConfirmPassword)}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={handleChangePassword}
                          disabled={isChangingPassword}
                          className="btn btn-primary w-full sm:w-auto"
                        >
                          {isChangingPassword ? "Đang đổi..." : "Đổi mật khẩu"}
                        </button>
                      </div>
                    </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function PasswordField({ label, value, onChange, show, onToggleShow, autoComplete }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm text-base-content/60">{label}</label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Lock className="size-4 text-base-content/40" />
        </div>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/10 py-3 pl-10 pr-10 text-sm"
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex items-center pr-3"
          onClick={onToggleShow}
        >
          {show ? (
            <EyeOff className="size-4 text-base-content/40" />
          ) : (
            <Eye className="size-4 text-base-content/40" />
          )}
        </button>
      </div>
    </div>
  );
}

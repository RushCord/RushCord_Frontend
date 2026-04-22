import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { uploadFileViaPresign } from "../lib/uploadMedia.js";
import { ArrowLeft, Camera, Mail, Shield, User } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

export const ProfilePage = () => {
  const navigate = useNavigate();
  const { authUser, isUpdatingProfile, updateProfile } = useAuthStore();
  const [selectedImg, setSelectedImg] = useState(null);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setSelectedImg(previewUrl);

    try {
      const { publicUrl } = await uploadFileViaPresign(file, "avatar");
      await updateProfile({ profilePic: publicUrl });
    } catch (e) {
      toast.error(e?.message || "Upload failed");
    } finally {
      URL.revokeObjectURL(previewUrl);
      setSelectedImg(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--discord-app)] px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="discord-card overflow-hidden">
          <div className="discord-topbar px-6 py-5">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="discord-icon-button mb-3 flex size-10 items-center justify-center rounded-full bg-white/5 md:hidden"
              aria-label="Back to messages"
              title="Back"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="discord-section-title mb-1">User Settings</div>
            <h1 className="text-2xl font-semibold">My Account</h1>
            <p className="mt-1 text-sm text-base-content/70">Manage your Discord-style profile card.</p>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-[240px_1fr]">
            <div className="discord-panel-strong rounded-2xl p-5 text-center">
              <div className="relative mx-auto w-fit">
                <img
                  src={selectedImg || authUser.profilePic || "/avatar.png"}
                  alt="Profile"
                  className="size-32 rounded-full border-4 border-white/10 object-cover"
                />
                <label
                  htmlFor="avatar-upload"
                  className={`
                    absolute bottom-1 right-1 flex size-10 items-center justify-center rounded-full
                    bg-primary text-primary-content shadow-lg transition-all duration-200 hover:scale-105
                    ${isUpdatingProfile ? "animate-pulse pointer-events-none" : ""}
                  `}
                >
                  <Camera className="w-5 h-5" />
                  <input
                    type="file"
                    id="avatar-upload"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isUpdatingProfile}
                  />
                </label>
              </div>
              <h2 className="mt-4 text-lg font-semibold">{authUser?.fullName}</h2>
              <p className="mt-1 text-sm text-base-content/60">{authUser?.email}</p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Active
              </div>
              <p className="mt-4 text-sm text-base-content/50">
                {isUpdatingProfile ? "Uploading..." : "Click the camera icon to update your photo"}
              </p>
            </div>

            <div className="space-y-6">
              <div className="discord-card p-5">
                <div className="discord-section-title mb-3">Profile</div>
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm text-base-content/60">
                      <User className="w-4 h-4" />
                      Full Name
                    </div>
                    <p className="rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                      {authUser?.fullName}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm text-base-content/60">
                      <Mail className="w-4 h-4" />
                      Email Address
                    </div>
                    <p className="rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                      {authUser?.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="discord-card p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Shield className="size-4 text-primary" />
                  <h2 className="text-lg font-medium">Account Information</h2>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between border-b border-white/10 py-2">
                    <span className="text-base-content/60">Member Since</span>
                    <span>{authUser.createdAt?.split("T")[0]}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-base-content/60">Account Status</span>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                      Active
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
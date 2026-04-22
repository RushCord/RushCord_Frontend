import React from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, MessageSquare, Settings, User, UserPlus, Users } from "lucide-react";

export const Navbar = () => {
  const { logout, authUser } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <header
      className="bg-base-100/80 border-b border-base-300 fixed w-full top-0 z-40 
    backdrop-blur-lg"
    >
      <div className="w-full px-4 h-16">
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center gap-8">
            <Link
              to="/"
              className="flex items-center gap-2.5 hover:opacity-80 transition-all"
            >
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-lg font-bold">RushCord</h1>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {!authUser ? (
              <Link to="/settings" className="btn btn-sm gap-2 transition-colors">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </Link>
            ) : (
              <div className="dropdown dropdown-end">
                <button type="button" tabIndex={0} className="btn btn-sm gap-2">
                  <img
                    src={authUser?.profilePic || "/avatar.png"}
                    alt="Profile"
                    className="size-7 rounded-full object-cover"
                  />
                  <span className="hidden sm:inline max-w-40 truncate">
                    {authUser?.fullName || "Profile"}
                  </span>
                </button>

                <ul
                  tabIndex={0}
                  className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52"
                >
                  <li>
                    <Link to="/profile" className="gap-2">
                      <User className="w-4 h-4" />
                      Me
                    </Link>
                  </li>
                  <li>
                    <Link to="/friends?add=1" className="gap-2">
                      <UserPlus className="w-4 h-4" />
                      Add friend
                    </Link>
                  </li>
                  <li>
                    <Link to="/friends" className="gap-2">
                      <Users className="w-4 h-4" />
                      Friends
                    </Link>
                  </li>
                  <li>
                    <Link to="/settings" className="gap-2">
                      <Settings className="w-4 h-4" />
                      Setting
                    </Link>
                  </li>
                  <li>
                    <button type="button" className="gap-2" onClick={handleLogout}>
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

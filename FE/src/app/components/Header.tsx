import { useState } from "react";
import { Bell, Search, ChevronDown, LogOut, Shield, User as UserIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { UserRole } from "@/types/rbac";

interface HeaderProps {
  pageTitle: string;
}

export function Header({ pageTitle }: HeaderProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  const userName = user?.app_user_name || "User";
  const userEmail = user?.email || "user@example.com";
  const userRole = user?.role || UserRole.USER;
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const isAdmin = userRole === UserRole.ADMIN;

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Page Title */}
      <div>
        <h1 className="text-slate-800" style={{ fontWeight: 700, fontSize: "1.125rem" }}>
          {pageTitle}
        </h1>
        <p className="text-slate-400" style={{ fontSize: "0.75rem" }}>
          Thursday, March 12, 2026 — Factory Line A
        </p>
      </div>

      {/* Right: Search + Notif + User */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:flex items-center">
          <Search size={15} className="absolute left-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search machines, logs..."
            className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all"
            style={{ fontSize: "0.8125rem", width: "220px" }}
          />
        </div>

        {/* Notification Bell */}
        <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-all">
          <Bell size={20} className="text-slate-500" />
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center" style={{ fontSize: "0.6rem", fontWeight: 700 }}>
            2
          </span>
        </button>

        {/* User Avatar with Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-100 transition-all"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              isAdmin ? "bg-gradient-to-br from-purple-400 to-purple-600" : "bg-gradient-to-br from-emerald-400 to-teal-600"
            }`}>
              <span className="text-white" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                {userInitials}
              </span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-slate-800" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                {userName}
              </p>
              <div className="flex items-center gap-1">
                <span className={`px-1.5 py-0.5 rounded text-xs font-700 inline-flex items-center gap-0.5 ${
                  isAdmin ? "bg-purple-100 text-purple-700" : "bg-emerald-100 text-emerald-700"
                }`}>
                  {isAdmin ? <Shield size={11} /> : <UserIcon size={11} />}
                  {isAdmin ? "Admin" : "User"}
                </span>
              </div>
            </div>
            <ChevronDown
              size={14}
              className="text-slate-400 hidden md:block"
              style={{
                transform: showDropdown ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            />
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
              {/* User Info Section */}
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-slate-600 text-xs font-600">Logged in as:</p>
                <p className="text-slate-900 font-600 mt-1">{userName}</p>
                <p className="text-slate-400 text-xs">{userEmail}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-700 inline-flex items-center gap-1 ${
                    isAdmin ? "bg-purple-100 text-purple-700" : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {isAdmin ? <Shield size={12} /> : <UserIcon size={12} />}
                    {isAdmin ? "Administrator" : "Operator"}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-all"
              >
                <LogOut size={16} />
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

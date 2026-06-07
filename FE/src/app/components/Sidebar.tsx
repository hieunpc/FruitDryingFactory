import { useState } from "react";
import {
  LayoutDashboard,
  Cpu,
  Zap,
  BarChart3,
  Flame,
  Boxes,
  Settings,
  Leaf,
  ChevronLeft,
  ChevronRight,
  Shield,
  Users,
  Lock,
} from "lucide-react";
import { useIsAdmin } from "@/hooks/usePermission";

interface NavItem {
  icon: React.ReactNode;
  label: string;
  id: string;
  badge?: number;
  adminOnly?: boolean;
}

interface SidebarProps {
  activeNav: string;
  onNavChange: (id: string) => void;
}

const navItems: NavItem[] = [
  { icon: <LayoutDashboard size={20} />, label: "Dashboard", id: "dashboard" },
  { icon: <Cpu size={20} />, label: "Device Management", id: "devices" },
  { icon: <BarChart3 size={20} />, label: "Reports & Analytics", id: "reports" },
  { icon: <Shield size={20} />, label: "Automation Rules", id: "automation", adminOnly: true },
  { icon: <Settings size={20} />, label: "Settings", id: "settings", adminOnly: true },
  { icon: <Users size={20} />, label: "User Management", id: "user-management", adminOnly: true },
  { icon: <Lock size={20} />, label: "Role Management", id: "role-management", adminOnly: true },
];

export function Sidebar({ activeNav, onNavChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = useIsAdmin();

  // Filter nav items based on admin status
  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <aside
      className={`flex flex-col bg-slate-900 text-white transition-all duration-300 ${
        collapsed ? "w-16" : "w-60"
      } min-h-screen relative shrink-0`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500 shrink-0">
          <Leaf size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-white truncate" style={{ fontWeight: 700, fontSize: "0.875rem" }}>
              FruitDry IMS
            </p>
            <p className="text-slate-400 truncate" style={{ fontSize: "0.7rem" }}>
              Industrial IoT
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {visibleItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavChange(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group
              ${
                activeNav === item.id
                  ? "bg-emerald-500 text-white shadow-lg"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
          >
            <span className="shrink-0">{item.icon}</span>
            {!collapsed && (
              <span
                className="truncate text-left"
                style={{ fontSize: "0.875rem", fontWeight: activeNav === item.id ? 600 : 400 }}
              >
                {item.label}
              </span>
            )}
            {!collapsed && item.badge && (
              <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Version & Collapse */}
      <div className="border-t border-slate-700 p-3">
        {!collapsed && (
          <p className="text-slate-500 mb-2 px-1" style={{ fontSize: "0.7rem" }}>
            v2.4.1 — Factory OS
          </p>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && <span className="ml-2" style={{ fontSize: "0.75rem" }}>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

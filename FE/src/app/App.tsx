import { useNavigate, useLocation } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { DevicesManagement } from "./components/DevicesManagement";
import { DeviceDetail } from "./components/DeviceDetail";
import { AutomationRules } from "./components/AutomationRules";
import { ReportsAnalytics } from "./components/ReportsAnalytics";
import { Settings } from "./components/Settings";
import { UserManagement } from "./components/admin/UserManagement";
import { RoleManagement } from "./components/admin/RoleManagement";

const pageTitles: Record<string, string> = {
  dashboard: "Dashboard",
  devices: "Device Management",
  automation: "Automation Rules",
  reports: "Reports & Analytics",
  drying: "Drying Management",
  batch: "Batch Management",
  settings: "Settings",
  "user-management": "User Management",
  "role-management": "Role Management",
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Resolve current nav by pathname prefixes
  const resolveNavFromPath = (path: string) => {
    if (path.startsWith("/settings")) return "settings";
    if (path.startsWith("/user-management")) return "user-management";
    if (path.startsWith("/role-management")) return "role-management";
    if (path.startsWith("/devices")) return "devices";
    if (path.startsWith("/automation")) return "automation";
    if (path.startsWith("/reports")) return "reports";
    if (path.startsWith("/dashboard")) return "dashboard";
    return "dashboard";
  };

  const currentNav = resolveNavFromPath(location.pathname);

  const handleNavChange = (nav: string) => {
    const routes: Record<string, string> = {
      dashboard: "/dashboard",
      devices: "/devices",
      automation: "/automation",
      reports: "/reports",
      settings: "/settings",
      drying: "/drying",
      batch: "/batch",
      "user-management": "/user-management",
      "role-management": "/role-management",
    };
    navigate(routes[nav]);
  };

  return (
    <Layout
      pageTitle={pageTitles[currentNav] ?? "Dashboard"}
      activeNav={currentNav}
      onNavChange={handleNavChange}
    >
      {currentNav === "dashboard" && <Dashboard />}
      {currentNav === "devices" && (location.pathname.startsWith("/devices/") && location.pathname !== "/devices" ? <DeviceDetail /> : <DevicesManagement />)}
      {currentNav === "automation" && <AutomationRules />}
      {currentNav === "reports" && <ReportsAnalytics />}
      {currentNav === "settings" && <Settings />}
      {currentNav === "user-management" && <UserManagement />}
      {currentNav === "role-management" && <RoleManagement />}
    </Layout>
  );
}
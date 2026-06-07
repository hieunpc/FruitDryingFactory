import { useState, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { AdminOnly } from "@/components/permission/PermissionGuards";
import { Checkbox } from "@/app/components/ui/checkbox";
import { UserRole, Permission, rolePermissions } from "@/types/rbac";
import { Badge } from "@/app/components/ui/badge";
import { toast } from "sonner";
import { 
  LayoutDashboard, 
  Package, 
  Flame, 
  FileText, 
  Users, 
  Settings, 
  Sliders,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
  Check,
  Zap
} from "lucide-react";

interface RolePermissionSet {
  role: UserRole;
  permissions: Permission[];
}

const ALL_PERMISSIONS: Permission[] = Object.values(Permission);

const PERMISSION_CATEGORIES = {
  "Dashboard & Monitoring": [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_DRYING_STATUS,
    Permission.VIEW_SENSOR_DATA,
    Permission.VIEW_DEVICE_STATUS,
  ],
  "Batch Management": [
    Permission.CREATE_BATCH,
    Permission.RUN_BATCH,
    Permission.STOP_BATCH,
    Permission.EDIT_BATCH,
  ],
  "Drying Control": [
    Permission.MANUAL_CONTROL,
    Permission.SCHEDULED_CONTROL,
    Permission.ADJUST_PARAMETERS,
    Permission.TOGGLE_THRESHOLD,
  ],
  "Reporting & Logs": [
    Permission.VIEW_EVENT_LOGS,
    Permission.VIEW_REPORTS,
    Permission.EXPORT_DATA,
  ],
  "User Management": [
    Permission.MANAGE_USERS,
    Permission.MANAGE_ROLES,
    Permission.MANAGE_PERMISSIONS,
  ],
  "System Configuration": [
    Permission.MANAGE_DEVICES,
    Permission.CONFIGURE_SENSORS,
    Permission.MANAGE_RECIPES,
    Permission.ADD_RECIPE_PHASE,
    Permission.DELETE_RECIPE_PHASE,
    Permission.MANAGE_POLICIES,
    Permission.SET_THRESHOLDS,
    Permission.MANAGE_AUTOMATION_RULES,
  ],
  Settings: [
    Permission.ACCESS_SETTINGS,
    Permission.CONFIGURE_MQTT,
    Permission.MANAGE_NOTIFICATIONS,
  ],
};

const CATEGORY_META: Record<string, { icon: any; color: string; bg: string; barColor: string; accentBorder: string }> = {
  "Dashboard & Monitoring": {
    icon: LayoutDashboard,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    barColor: "bg-blue-600",
    accentBorder: "hover:border-blue-200 focus-within:border-blue-400 checked-card-blue",
  },
  "Batch Management": {
    icon: Package,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    barColor: "bg-purple-600",
    accentBorder: "hover:border-purple-200 focus-within:border-purple-400 checked-card-purple",
  },
  "Drying Control": {
    icon: Flame,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    barColor: "bg-orange-600",
    accentBorder: "hover:border-orange-200 focus-within:border-orange-400 checked-card-orange",
  },
  "Reporting & Logs": {
    icon: FileText,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    barColor: "bg-emerald-600",
    accentBorder: "hover:border-emerald-200 focus-within:border-emerald-400 checked-card-emerald",
  },
  "User Management": {
    icon: Users,
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-50 dark:bg-pink-950/30",
    barColor: "bg-pink-600",
    accentBorder: "hover:border-pink-200 focus-within:border-pink-400 checked-card-pink",
  },
  "System Configuration": {
    icon: Settings,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    barColor: "bg-indigo-600",
    accentBorder: "hover:border-indigo-200 focus-within:border-indigo-400 checked-card-indigo",
  },
  Settings: {
    icon: Sliders,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
    barColor: "bg-cyan-600",
    accentBorder: "hover:border-cyan-200 focus-within:border-cyan-400 checked-card-cyan",
  },
};

const PERMISSION_LABELS: Record<Permission, string> = {
  [Permission.VIEW_DASHBOARD]: "Xem bảng điều khiển",
  [Permission.VIEW_DRYING_STATUS]: "Xem trạng thái sấy",
  [Permission.VIEW_SENSOR_DATA]: "Xem dữ liệu cảm biến",
  [Permission.VIEW_DEVICE_STATUS]: "Xem trạng thái thiết bị",
  [Permission.CREATE_BATCH]: "Tạo mẻ sấy mới",
  [Permission.RUN_BATCH]: "Vận hành mẻ sấy",
  [Permission.STOP_BATCH]: "Dừng mẻ sấy",
  [Permission.EDIT_BATCH]: "Chỉnh sửa mẻ sấy",
  [Permission.MANUAL_CONTROL]: "Điều khiển thủ công",
  [Permission.SCHEDULED_CONTROL]: "Điều khiển tự động",
  [Permission.ADJUST_PARAMETERS]: "Điều chỉnh thông số sấy",
  [Permission.TOGGLE_THRESHOLD]: "Bật/tắt ngưỡng sấy",
  [Permission.VIEW_EVENT_LOGS]: "Xem nhật ký sự kiện",
  [Permission.VIEW_REPORTS]: "Xem báo cáo chi tiết",
  [Permission.EXPORT_DATA]: "Xuất dữ liệu máy",
  [Permission.MANAGE_USERS]: "Quản lý tài khoản",
  [Permission.MANAGE_ROLES]: "Quản lý vai trò nhóm",
  [Permission.MANAGE_PERMISSIONS]: "Thiết lập quyền hạn",
  [Permission.MANAGE_DEVICES]: "Quản lý thiết bị máy",
  [Permission.CONFIGURE_SENSORS]: "Cấu hình hệ cảm biến",
  [Permission.MANAGE_RECIPES]: "Quản lý công thức sấy",
  [Permission.ADD_RECIPE_PHASE]: "Thêm giai đoạn sấy",
  [Permission.DELETE_RECIPE_PHASE]: "Xóa giai đoạn sấy",
  [Permission.MANAGE_POLICIES]: "Quản lý chính sách sấy",
  [Permission.SET_THRESHOLDS]: "Thiết lập ngưỡng cảnh báo",
  [Permission.MANAGE_AUTOMATION_RULES]: "Thiết lập luật tự động",
  [Permission.ACCESS_SETTINGS]: "Truy cập cài đặt chung",
  [Permission.CONFIGURE_MQTT]: "Cấu hình mạng MQTT",
  [Permission.MANAGE_NOTIFICATIONS]: "Quản lý nhận thông báo",
};

export function RoleManagement() {
  const [customRoles, setCustomRoles] = useState<RolePermissionSet[]>([]);

  // Load role permissions on mount
  useEffect(() => {
    let initialRoles: RolePermissionSet[] = [
      {
        role: UserRole.USER,
        permissions: rolePermissions[UserRole.USER],
      },
      {
        role: UserRole.ADMIN,
        permissions: rolePermissions[UserRole.ADMIN],
      },
    ];

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("role_permissions");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          initialRoles = [
            {
              role: UserRole.USER,
              permissions: parsed[UserRole.USER] || rolePermissions[UserRole.USER],
            },
            {
              role: UserRole.ADMIN,
              permissions: parsed[UserRole.ADMIN] || rolePermissions[UserRole.ADMIN],
            },
          ];
        } catch (e) {
          console.error("Failed to parse stored permissions, using defaults:", e);
        }
      }
    }
    setCustomRoles(initialRoles);
  }, []);

  const handleSave = () => {
    try {
      const payload = {
        [UserRole.USER]: customRoles.find((r) => r.role === UserRole.USER)?.permissions || [],
        [UserRole.ADMIN]: customRoles.find((r) => r.role === UserRole.ADMIN)?.permissions || [],
      };
      localStorage.setItem("role_permissions", JSON.stringify(payload));
      toast.success("Cấu hình vai trò đã được lưu thành công!");
    } catch (e) {
      toast.error("Không thể lưu cấu hình vai trò");
      console.error(e);
    }
  };

  const handleCancel = () => {
    let initialRoles: RolePermissionSet[] = [
      {
        role: UserRole.USER,
        permissions: rolePermissions[UserRole.USER],
      },
      {
        role: UserRole.ADMIN,
        permissions: rolePermissions[UserRole.ADMIN],
      },
    ];

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("role_permissions");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          initialRoles = [
            {
              role: UserRole.USER,
              permissions: parsed[UserRole.USER] || rolePermissions[UserRole.USER],
            },
            {
              role: UserRole.ADMIN,
              permissions: parsed[UserRole.ADMIN] || rolePermissions[UserRole.ADMIN],
            },
          ];
        } catch (e) {
          console.error(e);
        }
      }
    }
    setCustomRoles(initialRoles);
    toast.success("Đã khôi phục cấu hình trước đó");
  };

  const togglePermission = (roleIndex: number, permission: Permission) => {
    setCustomRoles(
      customRoles.map((role, idx) => {
        if (idx === roleIndex) {
          const hasPermission = role.permissions.includes(permission);
          return {
            ...role,
            permissions: hasPermission
              ? role.permissions.filter((p) => p !== permission)
              : [...role.permissions, permission],
          };
        }
        return role;
      })
    );
  };

  const hasAllPermissions = (roleIndex: number, permissions: Permission[]) => {
    if (customRoles.length <= roleIndex) return false;
    return permissions.every((p) =>
      customRoles[roleIndex].permissions.includes(p)
    );
  };

  const hasSomePermissions = (roleIndex: number, permissions: Permission[]) => {
    if (customRoles.length <= roleIndex) return false;
    return permissions.some((p) =>
      customRoles[roleIndex].permissions.includes(p)
    );
  };

  const toggleCategoryPermissions = (
    roleIndex: number,
    permissions: Permission[]
  ) => {
    if (hasAllPermissions(roleIndex, permissions)) {
      // Remove all
      setCustomRoles(
        customRoles.map((role, idx) => {
          if (idx === roleIndex) {
            return {
              ...role,
              permissions: role.permissions.filter(
                (p) => !permissions.includes(p)
              ),
            };
          }
          return role;
          })
      );
    } else {
      // Add all
      setCustomRoles(
        customRoles.map((role, idx) => {
          if (idx === roleIndex) {
            const newPerms = new Set([...role.permissions, ...permissions]);
            return {
              ...role,
              permissions: Array.from(newPerms),
            };
          }
          return role;
        })
      );
    }
  };

  return (
    <AdminOnly
      fallback={
        <div className="p-8 text-center bg-red-50/50 border border-red-100 rounded-2xl max-w-md mx-auto my-12">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-red-800">Quyền truy cập bị từ chối</h3>
          <p className="text-sm text-red-650 mt-1">
            Chỉ Quản trị viên (Admin) mới được phép thiết lập và quản lý vai trò trong hệ thống.
          </p>
        </div>
      }
    >
      <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6">
        <div className="space-y-8 max-w-7xl mx-auto py-6">
        
        {/* Dynamic Header */}
        <div className="relative p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl text-white overflow-hidden shadow-xl shadow-slate-950/20">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold tracking-wide uppercase rounded-full mb-3">
                <Zap className="w-3.5 h-3.5" /> Vai trò & Quyền hạn
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight">
                Quản lý Vai trò & Phân quyền
              </h2>
              <p className="text-slate-300 mt-2 max-w-2xl text-sm">
                Cấu hình chi tiết quyền hạn truy cập chức năng cho từng nhóm tài khoản người dùng hoạt động trong nhà máy sấy.
              </p>
            </div>
            <div className="flex gap-3 mt-4 md:mt-0 self-start md:self-center">
              <Button 
                variant="ghost" 
                onClick={handleCancel}
                className="bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:text-white"
              >
                Khôi phục
              </Button>
              <Button 
                onClick={handleSave}
                className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold shadow-lg shadow-indigo-500/25 border-none"
              >
                Lưu cấu hình
              </Button>
            </div>
          </div>
        </div>

        {/* Roles Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {customRoles.map((roleSet, roleIndex) => {
            const isAdminRole = roleSet.role === UserRole.ADMIN;
            
            return (
              <div 
                key={roleSet.role} 
                className={`relative flex flex-col bg-white dark:bg-slate-900 border rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-xl ${
                  isAdminRole 
                    ? "border-violet-100 dark:border-violet-950 hover:border-violet-200 shadow-violet-500/5" 
                    : "border-slate-100 dark:border-slate-800 hover:border-slate-200 shadow-slate-500/5"
                }`}
              >
                {/* Role Header Banner */}
                <div className={`p-6 border-b flex items-start gap-4 ${
                  isAdminRole 
                    ? "bg-gradient-to-br from-violet-50/70 to-fuchsia-50/30 dark:from-violet-950/20 dark:to-transparent border-violet-100/50" 
                    : "bg-gradient-to-br from-slate-50/70 to-blue-50/20 dark:from-slate-800/40 dark:to-transparent border-slate-100/50"
                }`}>
                  <div className={`p-3 rounded-2xl ${
                    isAdminRole ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-700"
                  }`}>
                    {isAdminRole ? <ShieldCheck className="w-7 h-7" /> : <UserIcon className="w-7 h-7" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                        {isAdminRole ? "Quản trị viên (Admin)" : "Vận hành viên (User)"}
                      </h3>
                      <Badge className={
                        isAdminRole 
                          ? "bg-violet-100 hover:bg-violet-100 text-violet-700 font-semibold border-none" 
                          : "bg-slate-100 hover:bg-slate-100 text-slate-700 font-semibold border-none"
                      }>
                        {roleSet.permissions.length} / {ALL_PERMISSIONS.length} Quyền
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {isAdminRole 
                        ? "Có toàn quyền cấu hình thiết bị, quản lý danh mục và phân quyền truy cập hệ thống." 
                        : "Vận hành máy sấy, theo dõi dữ liệu telemetry và quản lý mẻ sấy được ủy quyền."}
                    </p>
                  </div>
                </div>

                {/* Categories Wrapper */}
                <div className="p-6 space-y-8 flex-1 overflow-y-auto max-h-[600px] scrollbar-thin">
                  {Object.entries(PERMISSION_CATEGORIES).map(([category, permissions]) => {
                    const meta = CATEGORY_META[category] || { 
                      icon: HelpCircle, 
                      color: "text-slate-600", 
                      bg: "bg-slate-50", 
                      barColor: "bg-slate-600",
                      accentBorder: "hover:border-slate-200"
                    };
                    const CategoryIcon = meta.icon;
                    const catCheckedCount = permissions.filter((p) => roleSet.permissions.includes(p)).length;
                    const percent = Math.round((catCheckedCount / permissions.length) * 100);
                    const isAllCatChecked = catCheckedCount === permissions.length;
                    const isSomeCatChecked = catCheckedCount > 0 && !isAllCatChecked;

                    return (
                      <div 
                        key={category} 
                        className="group p-5 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-850 rounded-2xl transition-all duration-300 hover:bg-white hover:border-slate-200 hover:shadow-sm"
                      >
                        {/* Header of Category */}
                        <div className="flex items-center gap-3 mb-3">
                          <Checkbox
                            id={`category-${roleSet.role}-${category}`}
                            checked={isAllCatChecked}
                            indeterminate={isSomeCatChecked ? true : undefined}
                            onCheckedChange={() =>
                              toggleCategoryPermissions(roleIndex, permissions)
                            }
                            className="w-4.5 h-4.5"
                          />
                          <div className={`p-2 rounded-xl ${meta.bg} ${meta.color}`}>
                            <CategoryIcon className="w-4.5 h-4.5" />
                          </div>
                          <label
                            htmlFor={`category-${roleSet.role}-${category}`}
                            className="font-bold text-sm text-slate-800 dark:text-slate-200 cursor-pointer flex-1"
                          >
                            {category}
                          </label>
                          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            {catCheckedCount} / {permissions.length}
                          </span>
                        </div>

                        {/* Category Progress Bar */}
                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mb-4">
                          <div 
                            className={`h-full ${meta.barColor} transition-all duration-500 ease-out`} 
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        {/* Permission Pills */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {permissions.map((permission) => {
                            const isChecked = roleSet.permissions.includes(permission);
                            return (
                              <label
                                key={permission}
                                htmlFor={`perm-${roleSet.role}-${permission}`}
                                className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all duration-200 select-none ${
                                  isChecked 
                                    ? `bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-950 text-indigo-900 dark:text-indigo-400 shadow-sm shadow-indigo-500/5`
                                    : "bg-white/40 dark:bg-slate-900/20 border-slate-100 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-white hover:border-slate-200 dark:hover:border-slate-700"
                                }`}
                              >
                                <div className="relative flex items-center justify-center">
                                  <input
                                    type="checkbox"
                                    id={`perm-${roleSet.role}-${permission}`}
                                    checked={isChecked}
                                    onChange={() => togglePermission(roleIndex, permission)}
                                    className="sr-only"
                                  />
                                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                                    isChecked 
                                      ? "bg-indigo-600 border-indigo-600 text-white" 
                                      : "border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-800"
                                  }`}>
                                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                </div>
                                <span className="flex-1 truncate">
                                  {PERMISSION_LABELS[permission] || permission}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 p-4 bg-slate-50 dark:bg-slate-900 border rounded-2xl">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            className="border-slate-200 hover:bg-slate-100"
          >
            Hủy thay đổi
          </Button>
          <Button 
            onClick={handleSave}
            className="bg-gradient-to-r from-indigo-650 to-violet-650 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md shadow-indigo-600/10 px-6"
          >
            Lưu thay đổi
          </Button>
        </div>
      </div>
    </div>
  </AdminOnly>
);
}

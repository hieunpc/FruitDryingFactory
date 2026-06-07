import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Switch } from "@/app/components/ui/switch";
import { AdminOnly } from "@/components/permission/PermissionGuards";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { User, UserRole, APIUser } from "@/types/rbac";
import {
  Trash2,
  Edit2,
  Plus,
  Shield,
  ShieldAlert,
  Search,
  UserPlus,
  Lock,
  Mail,
  User as UserIcon,
  Calendar,
  Layers,
  ArrowUpDown,
  Filter,
  CheckCircle,
  HelpCircle
} from "lucide-react";
import { userAPI, structureAPI } from "../../config/api.config";

const toUser = (u: APIUser): User => ({
  ...u,
  role: u.is_admin ? UserRole.ADMIN : UserRole.USER,
});

const getAvatarColor = (name: string) => {
  const colors = [
    "bg-red-500/10 text-red-650 dark:bg-red-500/20 dark:text-red-300 border-red-200/50",
    "bg-orange-500/10 text-orange-650 dark:bg-orange-500/20 dark:text-orange-300 border-orange-200/50",
    "bg-amber-500/10 text-amber-650 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200/50",
    "bg-emerald-500/10 text-emerald-650 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-200/50",
    "bg-teal-500/10 text-teal-650 dark:bg-teal-500/20 dark:text-teal-300 border-teal-200/50",
    "bg-blue-500/10 text-blue-650 dark:bg-blue-500/20 dark:text-blue-300 border-blue-200/50",
    "bg-indigo-500/10 text-indigo-650 dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-200/50",
    "bg-violet-500/10 text-violet-650 dark:bg-violet-500/20 dark:text-violet-300 border-violet-200/50",
    "bg-purple-500/10 text-purple-650 dark:bg-purple-500/20 dark:text-purple-300 border-purple-200/50",
    "bg-pink-500/10 text-pink-650 dark:bg-pink-500/20 dark:text-pink-300 border-pink-200/50"
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    app_user_name: "",
    is_admin: false,
    password: "",
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Scope management states
  const [isScopeOpen, setIsScopeOpen] = useState(false);
  const [selectedUserForScope, setSelectedUserForScope] = useState<User | null>(null);
  const [userScopes, setUserScopes] = useState<any[]>([]);
  const [isScopesLoading, setIsScopesLoading] = useState(false);
  const [areas, setAreas] = useState<any[]>([]);
  const [dryers, setDryers] = useState<any[]>([]);
  const [newScopeType, setNewScopeType] = useState<"area" | "dryer">("area");
  const [selectedAreaId, setSelectedAreaId] = useState<number | "">("");
  const [selectedDryerId, setSelectedDryerId] = useState<number | "">("");

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await userAPI.list();
      const list: APIUser[] = response?.data ?? response ?? [];
      setUsers(list.map(toUser));
    } catch (error) {
      console.error("Failed to fetch users:", error);
      const message =
        error instanceof Error ? error.message : "Không tải được danh sách người dùng";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAreasAndDryers = useCallback(async () => {
    try {
      const [areasRes, dryersRes] = await Promise.all([
        structureAPI.areas.list(),
        structureAPI.dryers.list(),
      ]);
      setAreas(areasRes?.data ?? areasRes ?? []);
      setDryers(dryersRes?.data ?? dryersRes ?? []);
    } catch (error) {
      console.error("Failed to fetch areas and dryers:", error);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchAreasAndDryers();
  }, [fetchUsers, fetchAreasAndDryers]);

  const handleToggleActive = async (user: User, nextActive: boolean) => {
    setTogglingId(user.app_user_id);
    // Optimistic UI update
    setUsers((prev) =>
      prev.map((u) =>
        u.app_user_id === user.app_user_id ? { ...u, is_active: nextActive } : u
      )
    );
    try {
      await userAPI.update(user.app_user_id, { is_active: nextActive });
      toast.success(
        nextActive
          ? `Đã kích hoạt hoạt động tài khoản ${user.email}`
          : `Đã vô hiệu hoá hoạt động tài khoản ${user.email}`
      );
      await fetchUsers();
    } catch (error) {
      // Rollback optimistic change
      setUsers((prev) =>
        prev.map((u) =>
          u.app_user_id === user.app_user_id ? { ...u, is_active: !nextActive } : u
        )
      );
      const message =
        error instanceof Error ? error.message : "Cập nhật trạng thái thất bại";
      toast.error(message);
    } finally {
      setTogglingId(null);
    }
  };

  const handleAddUser = async () => {
    if (!formData.email || !formData.app_user_name) {
      toast.error("Vui lòng điền đầy đủ email và tên người dùng");
      return;
    }

    if (!editingId && !formData.password) {
      toast.error("Vui lòng nhập mật khẩu khởi tạo");
      return;
    }

    setIsLoading(true);
    try {
      if (editingId) {
        // Edit User API call
        await userAPI.update(editingId, {
          app_user_name: formData.app_user_name,
          is_admin: formData.is_admin,
        });
        toast.success(`Cập nhật thông tin thành công cho ${formData.email}`);
      } else {
        // Add User API call
        await userAPI.create({
          app_user_name: formData.app_user_name,
          email: formData.email,
          password: formData.password,
          is_admin: formData.is_admin,
        });
        toast.success(`Thêm tài khoản người dùng mới thành công: ${formData.email}`);
      }

      // Reset form
      setFormData({
        email: "",
        app_user_name: "",
        is_admin: false,
        password: "",
      });
      setIsOpen(false);
      setEditingId(null);

      // Refresh list
      await fetchUsers();
    } catch (error) {
      console.error("Failed to save user:", error);
      const message = error instanceof Error ? error.message : "Lỗi thao tác lưu người dùng";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setFormData({
      email: user.email,
      app_user_name: user.app_user_name,
      is_admin: user.is_admin,
      password: "",
    });
    setEditingId(user.app_user_id);
    setIsOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản người dùng này?")) return;

    setIsLoading(true);
    try {
      await userAPI.delete(id);
      toast.success("Đã xóa tài khoản người dùng thành công");
      await fetchUsers();
    } catch (error) {
      console.error("Failed to delete user:", error);
      const message = error instanceof Error ? error.message : "Xóa người dùng thất bại";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseDialog = () => {
    setIsOpen(false);
    setEditingId(null);
    setFormData({
      email: "",
      app_user_name: "",
      is_admin: false,
      password: "",
    });
  };

  // Scope management handlers
  const handleManageScopes = async (user: User) => {
    setSelectedUserForScope(user);
    setIsScopeOpen(true);
    setIsScopesLoading(true);
    try {
      const response = await userAPI.listScopes(user.app_user_id);
      setUserScopes(response?.data ?? response ?? []);
    } catch (error) {
      console.error("Failed to fetch scopes:", error);
      toast.error("Không tải được danh sách phạm vi");
    } finally {
      setIsScopesLoading(false);
    }
  };

  const handleAddScope = async () => {
    if (!selectedUserForScope) return;

    if (newScopeType === "area" && !selectedAreaId) {
      toast.error("Vui lòng chọn khu vực");
      return;
    }
    if (newScopeType === "dryer" && !selectedDryerId) {
      toast.error("Vui lòng chọn máy sấy");
      return;
    }

    setIsScopesLoading(true);
    try {
      const body = newScopeType === "area"
        ? { area_id: Number(selectedAreaId) }
        : { dry_id: Number(selectedDryerId) };

      await userAPI.addScope(selectedUserForScope.app_user_id, body);
      toast.success("Đã thêm phạm vi truy cập dữ liệu thành công");

      // Reload scopes
      const response = await userAPI.listScopes(selectedUserForScope.app_user_id);
      setUserScopes(response?.data ?? response ?? []);

      // Reset inputs
      setSelectedAreaId("");
      setSelectedDryerId("");
    } catch (error) {
      console.error("Failed to add scope:", error);
      const message = error instanceof Error ? error.message : "Thêm phạm vi thất bại";
      toast.error(message);
    } finally {
      setIsScopesLoading(false);
    }
  };

  const handleDeleteScope = async (scopeId: number) => {
    if (!selectedUserForScope) return;
    if (!confirm("Bạn có chắc chắn muốn xóa phạm vi phân quyền này?")) return;

    setIsScopesLoading(true);
    try {
      await userAPI.deleteScope(selectedUserForScope.app_user_id, scopeId);
      toast.success("Đã gỡ bỏ phạm vi truy cập dữ liệu");

      // Reload scopes
      const response = await userAPI.listScopes(selectedUserForScope.app_user_id);
      setUserScopes(response?.data ?? response ?? []);
    } catch (error) {
      console.error("Failed to delete scope:", error);
      const message = error instanceof Error ? error.message : "Xóa phạm vi thất bại";
      toast.error(message);
    } finally {
      setIsScopesLoading(false);
    }
  };

  // Filter users based on query state
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.app_user_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole =
      roleFilter === "all" ||
      (roleFilter === "admin" && u.is_admin) ||
      (roleFilter === "user" && !u.is_admin);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && u.is_active) ||
      (statusFilter === "inactive" && !u.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  });

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

        {/* Dynamic Premium Header Banner */}
        <div className="relative p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl text-white overflow-hidden shadow-xl shadow-slate-950/20">
          <div className="absolute top-0 right-0 w-85 h-85 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold tracking-wide uppercase rounded-full mb-3">
                <Shield className="w-3.5 h-3.5" /> Quản trị viên điều khiển
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight">
                Quản lý Người dùng
              </h2>
              <p className="text-slate-300 mt-2 max-w-2xl text-sm">
                Thiết lập tài khoản người dùng, phân cấp quyền lực (Admin/User), giám sát trạng thái kích hoạt, và gán phân quyền hạn chế theo khu vực/thiết bị sấy.
              </p>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-indigo-500 to-violet-650 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold shadow-lg shadow-indigo-500/25 border-none gap-2 self-start md:self-center">
                  <UserPlus className="w-4 h-4" />
                  Thêm người dùng mới
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 shadow-2xl p-6">
                <DialogHeader className="pb-4 border-b">
                  <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-indigo-650" />
                    {editingId ? "Cập nhật tài khoản" : "Tạo tài khoản mới"}
                  </DialogTitle>
                  <DialogDescription className="text-slate-500 text-xs mt-1">
                    Điền đầy đủ các thông tin thiết lập tài khoản bên dưới.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {/* Email Input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-650 mb-1">
                      Email đăng nhập
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <Input
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="tenuser@nhamay.com"
                        disabled={!!editingId}
                        className={`pl-10 h-10 rounded-xl bg-slate-50/50 ${editingId ? "bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200" : ""}`}
                      />
                    </div>
                  </div>

                  {/* Name Input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-650 mb-1">
                      Tên người dùng
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <Input
                        value={formData.app_user_name}
                        onChange={(e) =>
                          setFormData({ ...formData, app_user_name: e.target.value })
                        }
                        placeholder="Nguyễn Văn A"
                        className="pl-10 h-10 rounded-xl bg-slate-50/50"
                      />
                    </div>
                  </div>

                  {/* Password Input (Create only) */}
                  {!editingId && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-650 mb-1">
                        Mật khẩu tài khoản
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                        <Input
                          type="password"
                          value={formData.password}
                          onChange={(e) =>
                            setFormData({ ...formData, password: e.target.value })
                          }
                          placeholder="••••••••"
                          className="pl-10 h-10 rounded-xl bg-slate-50/50"
                        />
                      </div>
                    </div>
                  )}

                  {/* Admin Checkbox */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/60">
                    <div>
                      <label htmlFor="is_admin" className="text-sm font-bold text-slate-850 dark:text-white cursor-pointer block">
                        Cấp quyền Quản trị (Admin)
                      </label>
                      <span className="text-xs text-slate-500 block mt-0.5">
                        Cho phép tài khoản này thay đổi thiết lập hệ thống.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      id="is_admin"
                      checked={formData.is_admin}
                      onChange={(e) =>
                        setFormData({ ...formData, is_admin: e.target.checked })
                      }
                      className="w-5 h-5 accent-indigo-650 cursor-pointer rounded-md"
                    />
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={handleCloseDialog}
                    className="border-slate-200 hover:bg-slate-50 rounded-xl h-10 px-4"
                  >
                    Hủy bỏ
                  </Button>
                  <Button
                    onClick={handleAddUser}
                    className="bg-indigo-655 hover:bg-indigo-700 text-white rounded-xl h-10 px-6 font-semibold"
                  >
                    {editingId ? "Cập nhật" : "Tạo tài khoản"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo email hoặc tên hiển thị..."
              className="pl-10.5 h-11.5 rounded-2xl border-slate-200 bg-slate-50/50"
            />
          </div>

          <div className="flex flex-wrap gap-3 items-center w-full md:w-auto justify-end">
            {/* Filter by Role */}
            <div className="flex items-center gap-2 bg-slate-50 border rounded-2xl p-1 px-2.5 h-11.5">
              <Filter className="w-4 h-4 text-slate-550" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">Tất cả vai trò</option>
                <option value="admin">Vai trò: Admin</option>
                <option value="user">Vai trò: User</option>
              </select>
            </div>

            {/* Filter by Status */}
            <div className="flex items-center gap-2 bg-slate-50 border rounded-2xl p-1 px-2.5 h-11.5">
              <CheckCircle className="w-4 h-4 text-slate-550" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Hoạt động</option>
                <option value="inactive">Tạm khóa</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table Card */}
        <Card className="overflow-hidden border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/60 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                  <TableHead className="py-4 font-bold text-slate-700 dark:text-slate-300">Thông tin cá nhân</TableHead>
                  <TableHead className="py-4 font-bold text-slate-700 dark:text-slate-300">Tên người dùng</TableHead>
                  <TableHead className="py-4 font-bold text-slate-700 dark:text-slate-300">Phân cấp vai trò</TableHead>
                  <TableHead className="py-4 font-bold text-slate-700 dark:text-slate-300">Trạng thái khóa</TableHead>
                  <TableHead className="py-4 font-bold text-slate-700 dark:text-slate-300">Ngày tạo lập</TableHead>
                  <TableHead className="py-4 font-bold text-slate-700 dark:text-slate-350 text-right pr-6">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-500 py-12">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-650 animate-spin" />
                        <span className="text-sm font-medium mt-1">Đang tải danh sách người dùng...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-500 py-12">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <UserIcon className="w-8 h-8 text-slate-350 mb-1" />
                        <span className="text-sm font-semibold text-slate-750">Không tìm thấy kết quả</span>
                        <span className="text-xs text-slate-500">Thử thay đổi bộ lọc tìm kiếm của bạn.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {filteredUsers.map((user) => {
                  const initials = user.app_user_name ? user.app_user_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase();
                  const avatarColorClass = getAvatarColor(user.app_user_name || user.email);

                  return (
                    <TableRow
                      key={user.app_user_id}
                      className="border-b border-slate-50 dark:border-slate-800/40 hover:bg-slate-50/30 dark:hover:bg-slate-800/10 transition-colors"
                    >
                      {/* Avatar & Email */}
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full border flex items-center justify-center font-bold text-sm ${avatarColorClass} shrink-0`}>
                            {initials}
                          </div>
                          <div>
                            <span className="block font-bold text-sm text-slate-800 dark:text-slate-200">
                              {user.email}
                            </span>
                            <span className="block text-xs text-slate-400 mt-0.5">
                              ID: #{user.app_user_id}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Display name */}
                      <TableCell className="py-4 font-semibold text-slate-700 dark:text-slate-300">
                        {user.app_user_name}
                      </TableCell>

                      {/* Role Badge */}
                      <TableCell className="py-4">
                        {user.is_admin ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-violet-50 text-violet-750 border border-violet-100 rounded-full dark:bg-violet-950/35 dark:border-violet-900/40 dark:text-violet-400">
                            <Shield className="w-3.5 h-3.5 fill-violet-750/10 dark:fill-violet-400/15" />
                            Quản trị (Admin)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-blue-50 text-blue-750 border border-blue-100 rounded-full dark:bg-blue-950/35 dark:border-blue-900/40 dark:text-blue-400">
                            <UserIcon className="w-3.5 h-3.5" />
                            Vận hành (User)
                          </span>
                        )}
                      </TableCell>

                      {/* Status Toggle Switch */}
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2.5">
                          <Switch
                            checked={user.is_active}
                            disabled={togglingId === user.app_user_id}
                            onCheckedChange={(checked) =>
                              handleToggleActive(user, checked)
                            }
                            aria-label={`Trạng thái khóa ${user.email}`}
                          />
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-2xs font-extrabold tracking-wide uppercase ${user.is_active
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40"
                                : "bg-red-50 text-red-700 border border-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40"
                              }`}
                          >
                            {user.is_active ? "Hoạt động" : "Tạm khóa"}
                          </span>
                        </div>
                      </TableCell>

                      {/* Created date */}
                      <TableCell className="py-4 text-xs font-medium text-slate-500 flex items-center gap-1.5 mt-3 border-none">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(user.created_at).toLocaleDateString("vi-VN", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit"
                        })}
                      </TableCell>

                      {/* Row Action buttons */}
                      <TableCell className="py-4 text-right pr-6">
                        <div className="flex gap-2 justify-end items-center">
                          {!user.is_admin && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleManageScopes(user)}
                              className="gap-1.5 bg-slate-100/80 hover:bg-slate-200/90 hover:text-slate-800 text-slate-650 h-9 rounded-xl px-3 border border-transparent hover:border-slate-300/30"
                            >
                              <Shield className="w-3.5 h-3.5 text-indigo-650 dark:text-indigo-400" />
                              Phạm vi
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(user)}
                            className="gap-1.5 h-9 rounded-xl px-3 border-slate-200 hover:bg-slate-50 hover:text-slate-800"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Sửa
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(user.app_user_id)}
                            className="gap-1.5 h-9 rounded-xl px-3 hover:bg-red-600 hover:text-white"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Xóa
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Scope Management Dialog */}
      <Dialog open={isScopeOpen} onOpenChange={setIsScopeOpen}>
        <DialogContent className="max-w-lg bg-white dark:bg-slate-900 border border-slate-100 shadow-2xl p-6 rounded-3xl">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-2.5 text-xl font-extrabold text-slate-900 dark:text-white">
              <Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              <span>Phân quyền phạm vi truy cập</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Phân quyền cho <strong className="text-indigo-600">{selectedUserForScope?.app_user_name}</strong> chỉ xem/điều khiển thiết bị của các khu vực hoặc máy sấy chỉ định.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 my-4">
            {/* List current scopes */}
            <div>
              <h4 className="font-bold text-sm text-slate-850 dark:text-slate-200 mb-2">Phạm vi hạn chế hiện tại</h4>
              {isScopesLoading ? (
                <div className="text-center text-sm py-8 text-slate-500">
                  <div className="w-6 h-6 rounded-full border-3 border-indigo-100 border-t-indigo-600 animate-spin mx-auto mb-2" />
                  Đang truy vấn dữ liệu...
                </div>
              ) : userScopes.length === 0 ? (
                <div className="text-sm p-5 bg-slate-50 dark:bg-slate-800/40 border border-dashed rounded-2xl text-slate-500 text-center flex flex-col items-center justify-center gap-1.5">
                  <Layers className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="font-semibold text-slate-750">Toàn bộ nhà máy sấy</span>
                  <span className="text-xs text-slate-400">Tài khoản này hiện được phép truy cập toàn bộ các khu vực và máy sấy.</span>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {userScopes.map((scope) => {
                    const areaName = scope.area_id
                      ? areas.find((a) => a.area_id === scope.area_id)?.area_name || `Khu vực #${scope.area_id}`
                      : null;
                    const dryerName = scope.dry_id
                      ? dryers.find((d) => d.dry_id === scope.dry_id)?.dry_name || `Máy sấy #${scope.dry_id}`
                      : null;

                    return (
                      <div
                        key={scope.scope_id}
                        className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-850 rounded-2xl"
                      >
                        <span className="text-sm font-semibold text-slate-750 dark:text-slate-350">
                          {scope.area_id ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/20"></span>
                              Phân khu vực: <strong className="text-slate-900 dark:text-white font-extrabold">{areaName}</strong>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-md shadow-blue-500/20"></span>
                              Máy sấy: <strong className="text-slate-900 dark:text-white font-extrabold">{dryerName}</strong>
                            </span>
                          )}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteScope(scope.scope_id)}
                          className="h-8 w-8 text-red-500 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 p-0 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add new scope */}
            <div className="p-4 bg-slate-50/70 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/60 rounded-2xl space-y-4">
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Gán phạm vi hạn chế mới</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Cấp độ giới hạn
                  </label>
                  <select
                    className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl p-2 bg-white dark:bg-slate-800 h-10 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    value={newScopeType}
                    onChange={(e) => {
                      setNewScopeType(e.target.value as "area" | "dryer");
                      setSelectedAreaId("");
                      setSelectedDryerId("");
                    }}
                  >
                    <option value="area">Hạn chế theo Khu vực</option>
                    <option value="dryer">Hạn chế theo Máy sấy</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    {newScopeType === "area" ? "Chọn Khu vực sấy" : "Chọn Máy sấy cụ thể"}
                  </label>
                  {newScopeType === "area" ? (
                    <select
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl p-2 bg-white dark:bg-slate-800 h-10 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={selectedAreaId}
                      onChange={(e) => setSelectedAreaId(e.target.value ? Number(e.target.value) : "")}
                    >
                      <option value="">-- Danh sách khu vực --</option>
                      {areas.map((a) => (
                        <option key={a.area_id} value={a.area_id}>
                          {a.area_name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl p-2 bg-white dark:bg-slate-800 h-10 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={selectedDryerId}
                      onChange={(e) => setSelectedDryerId(e.target.value ? Number(e.target.value) : "")}
                    >
                      <option value="">-- Danh sách máy sấy --</option>
                      {dryers.map((d) => (
                        <option key={d.dry_id} value={d.dry_id}>
                          {d.dry_name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  onClick={handleAddScope}
                  className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-9.5 px-4 font-semibold"
                  disabled={isScopesLoading}
                >
                  <Plus className="w-4 h-4" />
                  Áp dụng phạm vi
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button
              variant="outline"
              onClick={() => setIsScopeOpen(false)}
              className="border-slate-250 hover:bg-slate-50 rounded-xl h-10"
            >
              Đóng quản lý
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  </AdminOnly>
);
}

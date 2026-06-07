// Role definitions
export enum UserRole {
  USER = "user",
  ADMIN = "admin",
}

// Permissions based on roles
export enum Permission {
  // Dashboard & Monitoring
  VIEW_DASHBOARD = "view_dashboard",
  VIEW_DRYING_STATUS = "view_drying_status",
  VIEW_SENSOR_DATA = "view_sensor_data",
  VIEW_DEVICE_STATUS = "view_device_status",

  // Batch Management
  CREATE_BATCH = "create_batch",
  RUN_BATCH = "run_batch",
  STOP_BATCH = "stop_batch",
  EDIT_BATCH = "edit_batch",

  // Drying Control
  MANUAL_CONTROL = "manual_control",
  SCHEDULED_CONTROL = "scheduled_control",
  ADJUST_PARAMETERS = "adjust_parameters",
  TOGGLE_THRESHOLD = "toggle_threshold",

  // Reporting & Logs
  VIEW_EVENT_LOGS = "view_event_logs",
  VIEW_REPORTS = "view_reports",
  EXPORT_DATA = "export_data",

  // User Management
  MANAGE_USERS = "manage_users",
  MANAGE_ROLES = "manage_roles",
  MANAGE_PERMISSIONS = "manage_permissions",

  // System Configuration
  MANAGE_DEVICES = "manage_devices",
  CONFIGURE_SENSORS = "configure_sensors",
  MANAGE_RECIPES = "manage_recipes",
  ADD_RECIPE_PHASE = "add_recipe_phase",
  DELETE_RECIPE_PHASE = "delete_recipe_phase",
  MANAGE_POLICIES = "manage_policies",
  SET_THRESHOLDS = "set_thresholds",
  MANAGE_AUTOMATION_RULES = "manage_automation_rules",

  // Settings
  ACCESS_SETTINGS = "access_settings",
  CONFIGURE_MQTT = "configure_mqtt",
  MANAGE_NOTIFICATIONS = "manage_notifications",
}

// Role to permissions mapping
export const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.USER]: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_DRYING_STATUS,
    Permission.VIEW_SENSOR_DATA,
    Permission.VIEW_DEVICE_STATUS,
    Permission.CREATE_BATCH,
    Permission.RUN_BATCH,
    Permission.STOP_BATCH,
    Permission.EDIT_BATCH,
    Permission.MANUAL_CONTROL,
    Permission.SCHEDULED_CONTROL,
    Permission.ADJUST_PARAMETERS,
    Permission.TOGGLE_THRESHOLD,
    Permission.VIEW_EVENT_LOGS,
    Permission.VIEW_REPORTS,
    Permission.ADD_RECIPE_PHASE,
    Permission.MANAGE_POLICIES,
  ],
  [UserRole.ADMIN]: [
    // All user permissions plus admin-specific
    ...Object.values(Permission),
  ],
};

// API Response - Direct from backend
export interface APIUser {
  app_user_id: number;
  app_user_name: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
}

// User type - Internal representation with computed role
export interface User extends APIUser {
  role: UserRole; // Computed from is_admin
}

// Auth state
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Auth context type
export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: UserRole) => boolean;
}

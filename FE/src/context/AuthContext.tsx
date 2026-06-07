import React, { createContext, useContext, useState, useEffect } from "react";
import {
  AuthContextType,
  AuthState,
  UserRole,
  Permission,
  APIUser,
  User,
  rolePermissions,
} from "@/types/rbac";
import { authAPI } from "../app/config/api.config";

// The /auth/me endpoint returns req.user which has { id, name, email, isAdmin } (camelCase)
// The /auth/login endpoint returns { app_user_id, app_user_name, email, is_admin } (snake_case)
// We normalize both shapes here
type MeUser = { id: number; name: string; email: string; isAdmin: boolean };

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Convert API User response to internal User object with computed role
 */
const mapAPIUserToUser = (apiUser: APIUser | MeUser): User => {
  // Handle /auth/me shape: { id, name, email, isAdmin }
  const isMeShape = 'isAdmin' in apiUser && 'id' in apiUser && !('app_user_id' in apiUser);
  if (isMeShape) {
    const meUser = apiUser as MeUser;
    return {
      app_user_id: meUser.id,
      app_user_name: meUser.name,
      email: meUser.email,
      is_admin: meUser.isAdmin,
      role: meUser.isAdmin ? UserRole.ADMIN : UserRole.USER,
    } as User;
  }
  // Handle /auth/login shape: { app_user_id, app_user_name, email, is_admin }
  const loginUser = apiUser as APIUser;
  return {
    ...loginUser,
    role: loginUser.is_admin ? UserRole.ADMIN : UserRole.USER,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem("access_token");
        const storedUserData = localStorage.getItem("userData");

        if (!token) {
          setAuthState({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }

        // Optimistically restore user from cache
        if (storedUserData) {
          const cachedUser = JSON.parse(storedUserData) as User;
          setAuthState({ user: cachedUser, isAuthenticated: true, isLoading: true });
        }

        // Validate token by fetching current user
        try {
          const response = await authAPI.getCurrentUser();
          // /auth/me returns: { data: { user: { id, name, email, isAdmin }, scopes: [...] } }
          // Extract the nested user object, falling back gracefully
          const rawData = response.data ?? response;
          const apiUser: APIUser | MeUser = rawData?.user ?? rawData;
          const user = mapAPIUserToUser(apiUser);
          localStorage.setItem("userData", JSON.stringify(user));
          setAuthState({ user, isAuthenticated: true, isLoading: false });
        } catch {
          // Token invalid/expired
          localStorage.removeItem("access_token");
          localStorage.removeItem("userData");
          setAuthState({ user: null, isAuthenticated: false, isLoading: false });
        }
      } catch (error) {
        console.error("Failed to initialize auth:", error);
        setAuthState({ user: null, isAuthenticated: false, isLoading: false });
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setAuthState((prev: AuthState) => ({ ...prev, isLoading: true }));
    try {
      // 1. Call POST /auth/login -> { data: { access_token, ... } }
      const loginResponse = await authAPI.login(email, password);
      const accessToken: string | undefined =
        loginResponse?.data?.access_token ?? loginResponse?.access_token;

      if (!accessToken) {
        throw new Error("Login response missing access_token");
      }

      // 2. Persist token so subsequent apiRequest calls are authenticated
      localStorage.setItem("access_token", accessToken);
      // 3. Resolve current user (prefer payload from login, fallback to /auth/me)
      let apiUser: APIUser | undefined =
        loginResponse?.data?.user ?? loginResponse?.user;
      if (!apiUser) {
        const meResponse = await authAPI.getCurrentUser();
        apiUser = meResponse.data ?? meResponse;
      }
      if (!apiUser) {
        throw new Error("Unable to resolve current user");
      }

      const user = mapAPIUserToUser(apiUser);
      localStorage.setItem("userData", JSON.stringify(user));

      setAuthState({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("userData");
      setAuthState({ user: null, isAuthenticated: false, isLoading: false });
      throw error;
    }
  };

  const logout = (): void => {
    // Best-effort server-side logout; ignore failures
    authAPI.logout().catch(() => {});
    localStorage.removeItem("access_token");
    localStorage.removeItem("userData");
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  /**
   * Check if user has a specific role
   */
  const hasRole = (role: UserRole): boolean => {
    if (!authState.user) return false;
    if (authState.user.role === UserRole.ADMIN) return true;
    return authState.user.role === role;
  };

  /**
   * Check if user has a specific permission
   */
  const hasPermission = (permission: Permission): boolean => {
    if (!authState.user) return false;

    const userRole = authState.user.role;
    let currentRolePermissions = rolePermissions;

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("role_permissions");
      if (stored) {
        try {
          currentRolePermissions = JSON.parse(stored);
        } catch (e) {
          console.error("Failed to parse stored role permissions:", e);
        }
      }
    }

    const permissions = currentRolePermissions[userRole] || [];
    return permissions.includes(permission);
  };

  const value: AuthContextType = {
    ...authState,
    login,
    logout,
    hasRole,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

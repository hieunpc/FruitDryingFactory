import { useAuth } from "@/context/AuthContext";
import { Permission, UserRole } from "@/types/rbac";

/**
 * Hook to check if user has a specific permission
 */
export const usePermission = (permission: Permission): boolean => {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
};

/**
 * Hook to check if user has multiple permissions (all must be true)
 */
export const usePermissions = (permissions: Permission[]): boolean => {
  const { hasPermission } = useAuth();
  return permissions.every((permission) => hasPermission(permission));
};

/**
 * Hook to check if user has at least one of the given permissions
 */
export const useHasAnyPermission = (permissions: Permission[]): boolean => {
  const { hasPermission } = useAuth();
  return permissions.some((permission) => hasPermission(permission));
};

/**
 * Hook to check if user has a specific role
 */
export const useRole = (role: UserRole): boolean => {
  const { hasRole } = useAuth();
  return hasRole(role);
};

/**
 * Hook to check if user is an admin
 */
export const useIsAdmin = (): boolean => {
  const { hasRole } = useAuth();
  return hasRole(UserRole.ADMIN);
};

/**
 * Hook to check if user is a regular user
 */
export const useIsUser = (): boolean => {
  const { hasRole } = useAuth();
  return hasRole(UserRole.USER);
};

/**
 * Hook to get current user
 */
export const useCurrentUser = () => {
  const { user } = useAuth();
  return user;
};

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { Permission, UserRole } from "@/types/rbac";

interface CanProps {
  permission?: Permission;
  permissions?: Permission[];
  role?: UserRole;
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Conditionally render content based on permissions/roles
 * Example: <Can permission={Permission.EDIT_BATCH}><Button>Edit</Button></Can>
 */
export const Can: React.FC<CanProps> = ({
  permission,
  permissions,
  role,
  requireAll = true,
  children,
  fallback = null,
}) => {
  const { hasPermission, hasRole } = useAuth();

  let allowed = true;

  if (role && !hasRole(role)) {
    allowed = false;
  }

  if (permission && !hasPermission(permission)) {
    allowed = false;
  }

  if (permissions && permissions.length > 0) {
    if (requireAll) {
      allowed = permissions.every((p) => hasPermission(p));
    } else {
      allowed = permissions.some((p) => hasPermission(p));
    }
  }

  return <>{allowed ? children : fallback}</>;
};

interface AdminOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Render content only for admins
 */
export const AdminOnly: React.FC<AdminOnlyProps> = ({
  children,
  fallback = null,
}) => {
  return (
    <Can role={UserRole.ADMIN} fallback={fallback}>
      {children}
    </Can>
  );
};

interface UserOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Render content only for regular users
 */
export const UserOnly: React.FC<UserOnlyProps> = ({
  children,
  fallback = null,
}) => {
  return (
    <Can role={UserRole.USER} fallback={fallback}>
      {children}
    </Can>
  );
};

interface AdminOrProps {
  permission?: Permission;
  permissions?: Permission[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Render content if admin OR has specific permission
 */
export const AdminOr: React.FC<AdminOrProps> = ({
  permission,
  permissions,
  children,
  fallback = null,
}) => {
  const { hasPermission, hasRole } = useAuth();

  const isAdmin = hasRole(UserRole.ADMIN);
  const hasPerms =
    (permission && hasPermission(permission)) ||
    (permissions &&
      permissions.some((p) => hasPermission(p)));

  return <>{isAdmin || hasPerms ? children : fallback}</>;
};

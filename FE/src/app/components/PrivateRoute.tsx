import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Permission, UserRole } from "@/types/rbac";

interface RoleBasedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  requiredPermission?: Permission;
  requiredPermissions?: Permission[];
  requireAll?: boolean; // If true, requires ALL permissions; if false, requires ANY
}

/**
 * Enhanced PrivateRoute with role and permission checking
 */
export function PrivateRoute({
  children,
  requiredRole,
  requiredPermission,
  requiredPermissions,
  requireAll = true,
}: RoleBasedRouteProps) {
  const { isAuthenticated, isLoading, hasRole, hasPermission } = useAuth();

  // Still loading auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check required role
  if (requiredRole && !hasRole(requiredRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Check required permissions
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasAllPermissions = requiredPermissions.every((p) =>
      hasPermission(p)
    );
    const hasAnyPermission = requiredPermissions.some((p) =>
      hasPermission(p)
    );

    if (requireAll && !hasAllPermissions) {
      return <Navigate to="/dashboard" replace />;
    }
    if (!requireAll && !hasAnyPermission) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}

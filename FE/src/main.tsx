import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import App from "./app/App.tsx";
import { Login } from "./app/components/Login.tsx";
import { PrivateRoute } from "./app/components/PrivateRoute.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import { UserRole, Permission } from "./types/rbac.ts";
import { Toaster } from "./app/components/ui/sonner.tsx";
import "./styles/index.css";

const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },
  {
    path: "/dashboard",
    element: (
      <PrivateRoute>
        <App />
      </PrivateRoute>
    ),
  },
  {
    path: "/devices",
    element: (
      <PrivateRoute>
        <App />
      </PrivateRoute>
    ),
  },
  {
    path: "/devices/:id",
    element: (
      <PrivateRoute>
        <App />
      </PrivateRoute>
    ),
  },
  {
    path: "/automation",
    element: (
      <PrivateRoute requiredPermission={Permission.MANAGE_POLICIES}>
        <App />
      </PrivateRoute>
    ),
  },
  {
    path: "/reports",
    element: (
      <PrivateRoute>
        <App />
      </PrivateRoute>
    ),
  },
  {
    path: "/user-management",
    element: (
      <PrivateRoute requiredRole={UserRole.ADMIN}>
        <App />
      </PrivateRoute>
    ),
  },
  {
    path: "/role-management",
    element: (
      <PrivateRoute requiredRole={UserRole.ADMIN}>
        <App />
      </PrivateRoute>
    ),
  },
  {
    path: "/settings",
    element: (
      <PrivateRoute requiredRole={UserRole.ADMIN}>
        <App />
      </PrivateRoute>
    ),
  },
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />,
  },
]);

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <RouterProvider router={router} />
    <Toaster richColors position="top-right" />
  </AuthProvider>
);
  
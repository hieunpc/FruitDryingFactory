import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import App from "./app/App.tsx";
import { Login } from "./app/components/Login.tsx";
import { PrivateRoute } from "./app/components/PrivateRoute.tsx";
import "./styles/index.css";

const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/",
    element: (
      <PrivateRoute>
        <App />
      </PrivateRoute>
    ),
    children: [
      {
        path: "dashboard",
        element: (
          <PrivateRoute>
            <App />
          </PrivateRoute>
        ),
      },
      {
        path: "devices",
        element: (
          <PrivateRoute>
            <App />
          </PrivateRoute>
        ),
      },
      {
        path: "automation",
        element: (
          <PrivateRoute>
            <App />
          </PrivateRoute>
        ),
      },
      {
        path: "reports",
        element: (
          <PrivateRoute>
            <App />
          </PrivateRoute>
        ),
      },
      {
        path : "drying",
        element : (
          <PrivateRoute>
            <App />
          </PrivateRoute>
        )
      },
      {
        path: "batch",
        element: (
          <PrivateRoute>
            <App />
          </PrivateRoute>
        ),
      }
    ],
  },
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />,
  },
]);

createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />
);
  
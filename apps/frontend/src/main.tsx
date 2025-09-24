import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import LoginPage from "./pages/Login";
import AdminLayout from "./pages/AdminLayout";
import PostsPage from "./pages/Posts";
import "./index.css";

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/t/blue/login" replace /> }, // dev shortcut
  { path: "/t/:tenantSlug/login", element: <LoginPage /> },
  {
    path: "/t/:tenantSlug/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="posts" replace /> },
      { path: "posts", element: <PostsPage /> }
    ]
  }
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

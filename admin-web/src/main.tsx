/* admin-web/src/main.tsx */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider, localStorageColorSchemeManager, } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import AdminLayout from './components/shell/AdminLayout'
import SignInPage from './pages/SignInPage'
import ProductsPage from './pages/ProductsPage'
import TenantUsersPage from './pages/TenantUsersPage'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/dates/styles.css'
import './index.css'
import { RouteErrorBoundary } from './components/feedback/ErrorBoundary'
import ThemePage from './pages/ThemePage';
import RequirePermission from './components/rbac/RequirePermission'
import RolesPage from './pages/RolesPage'
import BranchesPage from './pages/BranchesPage'
import TenantUserPage from './pages/TenantUserPage'
import ProductPage from './pages/ProductPage'
import AuditLogPage from './pages/AuditLogPage' // ⬅️ NEW

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />, // Root layout with TopLoader; no shell here
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <SignInPage /> },
      { path: 'sign-in', element: <SignInPage /> },

      // Admin area under :tenantSlug/*
      {
        path: ':tenantSlug',
        element: <AdminLayout />, // <-- Shell applies only here
        children: [
          { 
            path: 'products', 
            element: (
              <RequirePermission perm="products:read">
                <ProductsPage />
              </RequirePermission>
            ), 
            errorElement: <RouteErrorBoundary /> 
          },
          {
            path: 'products/new',
            element: (
              <RequirePermission perm="products:write">
                <ProductPage />
              </RequirePermission>
            ),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: 'products/:productId',
            element: (
              <RequirePermission perm="products:read">
                <ProductPage />
              </RequirePermission>
            ),
            errorElement: <RouteErrorBoundary />,
          },

          // ⬇️ NEW: Tenant-level Audit Log (admins)
          {
            path: 'audit',
            element: (
              <RequirePermission perm="users:manage">
                <AuditLogPage />
              </RequirePermission>
            ),
            errorElement: <RouteErrorBoundary />
          },

          { 
            path: 'users', 
            element: (
              <RequirePermission perm="users:manage">
                <TenantUsersPage />
              </RequirePermission>
            ), 
            errorElement: <RouteErrorBoundary /> 
          },
          {
            path: 'users/new',
            element: (
              <RequirePermission perm="users:manage">
                <TenantUserPage />
              </RequirePermission>
            ),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: 'users/:userId',
            element: (
              <RequirePermission perm="users:manage">
                <TenantUserPage />
              </RequirePermission>
            ),
            errorElement: <RouteErrorBoundary />,
          },
          { 
            path: 'settings/theme', 
            element: (
              <RequirePermission perm="theme:manage">
                <ThemePage />
              </RequirePermission>
            ), 
            errorElement: <RouteErrorBoundary /> 
          },
          {
            path: 'roles',
            element: (
              <RequirePermission perm="roles:manage">
                <RolesPage />
              </RequirePermission>
            ),
            errorElement: <RouteErrorBoundary />
          },
          {
            path: 'branches',
            element: (
              <RequirePermission perm="branches:manage">
                <BranchesPage />
              </RequirePermission>
            ),
            errorElement: <RouteErrorBoundary />
          },
        ],
      },
    ],
  },
])

const colorSchemeManager = localStorageColorSchemeManager({ key: 'admin-color-scheme' })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider defaultColorScheme="light" colorSchemeManager={colorSchemeManager}>
      <Notifications position="top-right" />
      <RouterProvider router={router} />
    </MantineProvider>
  </React.StrictMode>
)

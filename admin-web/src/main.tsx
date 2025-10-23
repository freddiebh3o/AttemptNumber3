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
import AuditLogPage from './pages/AuditLogPage'
import RolePage from './pages/RolePage'
import BranchPage from './pages/BranchPage'
import StockTransfersPage from './pages/StockTransfersPage'
import StockTransferDetailPage from './pages/StockTransferDetailPage'
import TransferTemplatesPage from './pages/TransferTemplatesPage'
import TransferApprovalRulesPage from './pages/TransferApprovalRulesPage'
import TransferAnalyticsPage from './pages/TransferAnalyticsPage'
import { ChatAnalyticsPage } from './pages/ChatAnalyticsPage'
import FeatureSettingsPage from './pages/FeatureSettingsPage'

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
            path: 'chat-analytics',
            element: (
              <RequirePermission perm="reports:view">
                <ChatAnalyticsPage />
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
            path: 'settings/features',
            element: (
              <RequirePermission perm="theme:manage">
                <FeatureSettingsPage />
              </RequirePermission>
            ),
            errorElement: <RouteErrorBoundary />
          },
          {
            path: 'roles',
            element: (
              <RequirePermission perm="roles:read">
                <RolesPage />
              </RequirePermission>
            ),
            errorElement: <RouteErrorBoundary />
          },
          {
            path: 'roles/:roleId',
            element: (
              <RequirePermission perm="roles:read">
                <RolePage />
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
          {
            path: 'branches/new',
            element: (
              <RequirePermission perm="branches:manage">
                <BranchPage />
              </RequirePermission>
            ),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: 'branches/:branchId',
            element: (
              <RequirePermission perm="branches:manage">
                <BranchPage />
              </RequirePermission>
            ),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: 'stock-transfers',
            element: (
              <RequirePermission perm="stock:read">
                <StockTransfersPage />
              </RequirePermission>
            ),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: 'stock-transfers/:transferId',
            element: (
              <RequirePermission perm="stock:read">
                <StockTransferDetailPage />
              </RequirePermission>
            ),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: 'stock-transfers/templates',
            element: (
              <RequirePermission perm="stock:read">
                <TransferTemplatesPage />
              </RequirePermission>
            ),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: 'stock-transfers/approval-rules',
            element: (
              <RequirePermission perm="stock:write">
                <TransferApprovalRulesPage />
              </RequirePermission>
            ),
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: 'stock-transfers/analytics',
            element: (
              <RequirePermission perm="reports:view">
                <TransferAnalyticsPage />
              </RequirePermission>
            ),
            errorElement: <RouteErrorBoundary />,
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

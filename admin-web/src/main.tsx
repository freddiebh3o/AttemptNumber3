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
import ThemeSettingsPage from './pages/ThemeSettingsPage';

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
          { path: 'products', element: <ProductsPage />, errorElement: <RouteErrorBoundary /> },
          { path: 'users', element: <TenantUsersPage />, errorElement: <RouteErrorBoundary /> },
          { path: 'settings/theme', element: <ThemeSettingsPage />, errorElement: <RouteErrorBoundary /> },
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

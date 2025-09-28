/* admin-web/src/main.tsx */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import AdminLayout from './components/shell/AdminLayout'
import SignInPage from './pages/SignInPage'
import ProductsPage from './pages/ProductsPage'
import TenantUsersPage from './pages/TenantUsersPage'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './index.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />, // Root layout with TopLoader; no shell here
    children: [
      { index: true, element: <SignInPage /> },
      { path: 'sign-in', element: <SignInPage /> },

      // Admin area under :tenantSlug/*
      {
        path: ':tenantSlug',
        element: <AdminLayout />, // <-- Shell applies only here
        children: [
          { path: 'products', element: <ProductsPage /> },
          { path: 'users', element: <TenantUsersPage /> },
        ],
      },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider defaultColorScheme="light">
      <Notifications position="top-right" />
      <RouterProvider router={router} />
    </MantineProvider>
  </React.StrictMode>
)

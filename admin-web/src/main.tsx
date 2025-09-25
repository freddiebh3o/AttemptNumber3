import React from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import SignInPage from './pages/SignInPage'
import ProductsPage from './pages/ProductsPage'
import './index.css'
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

const router = createBrowserRouter([
  { path: '/', element: <SignInPage /> },
  { path: '/sign-in', element: <SignInPage /> },
  { path: '/:tenantSlug/products', element: <ProductsPage /> },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider defaultColorScheme="light">
      <Notifications position="top-right" />
      <RouterProvider router={router} />
    </MantineProvider>
  </React.StrictMode>
)

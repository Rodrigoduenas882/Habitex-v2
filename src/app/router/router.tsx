// This file exports router configuration, not components, so it is not a
// Fast Refresh boundary.
/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from '@/features/auth/presentation/ProtectedRoute'
import { LoadingFallback } from '@/shared/components/LoadingFallback'
import { RouteErrorBoundary } from '@/shared/components/RouteErrorBoundary'
import { RootLayout } from '../layouts/RootLayout'

const HomePage = lazy(() => import('../pages/HomePage'))
const LoginPage = lazy(() => import('@/features/auth/presentation/LoginPage'))
const UiPreviewPage = lazy(() => import('../pages/ui-preview/UiPreviewPage'))
const NotFoundPage = lazy(() => import('@/shared/components/NotFoundPage'))

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<LoadingFallback />}>{element}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <ProtectedRoute />,
        children: [{ index: true, element: withSuspense(<HomePage />) }],
      },
      { path: 'login', element: withSuspense(<LoginPage />) },
      // Public on purpose: internal design-system tool, not authenticated
      // product surface. See UiPreviewPage's own doc comment.
      { path: 'ui-preview', element: withSuspense(<UiPreviewPage />) },
      { path: '*', element: withSuspense(<NotFoundPage />) },
    ],
  },
])

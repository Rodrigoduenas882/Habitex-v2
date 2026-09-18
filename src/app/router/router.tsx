// This file exports router configuration, not components, so it is not a
// Fast Refresh boundary.
/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from '@/features/auth/presentation/ProtectedRoute'
import { RedirectIfAuthenticated } from '@/features/auth/presentation/RedirectIfAuthenticated'
import { HabitexBootScreen } from '@/shared/components/HabitexBootScreen'
import { RouteErrorBoundary } from '@/shared/components/RouteErrorBoundary'
import { AuthenticatedLayout } from '../layouts/AuthenticatedLayout'
import { RootLayout } from '../layouts/RootLayout'

const DashboardPage = lazy(() => import('@/features/dashboard/presentation/DashboardPage'))
const PropertiesPage = lazy(() => import('@/features/properties/presentation/PropertiesPage'))
const AddPropertyPage = lazy(() => import('@/features/properties/presentation/AddPropertyPage'))
const RoomSetupPage = lazy(() => import('@/features/properties/presentation/RoomSetupPage'))
const RentalsPage = lazy(() => import('@/features/rentals/presentation/RentalsPage'))
const LoginPage = lazy(() => import('@/features/auth/presentation/LoginPage'))
const UiPreviewPage = lazy(() => import('../pages/ui-preview/UiPreviewPage'))
const NotFoundPage = lazy(() => import('@/shared/components/NotFoundPage'))

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<HabitexBootScreen />}>{element}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AuthenticatedLayout />,
            children: [
              { index: true, element: withSuspense(<DashboardPage />) },
              { path: 'properties', element: withSuspense(<PropertiesPage />) },
              { path: 'properties/new', element: withSuspense(<AddPropertyPage />) },
              {
                path: 'properties/:propertyId/rooms/setup',
                element: withSuspense(<RoomSetupPage />),
              },
              { path: 'rentals', element: withSuspense(<RentalsPage />) },
            ],
          },
        ],
      },
      {
        element: <RedirectIfAuthenticated />,
        children: [{ path: 'login', element: withSuspense(<LoginPage />) }],
      },
      // Public on purpose: internal design-system tool, not authenticated
      // product surface. See UiPreviewPage's own doc comment.
      { path: 'ui-preview', element: withSuspense(<UiPreviewPage />) },
      { path: '*', element: withSuspense(<NotFoundPage />) },
    ],
  },
])

import { Navigate, Outlet } from 'react-router-dom'
import { LoadingFallback } from '@/shared/components/LoadingFallback'
import { useAuthSession } from '../application/useAuthSession'

/**
 * Gates child routes on an authenticated Supabase session.
 *
 * The loading (unknown) state renders a fallback and never falls through to
 * the authenticated branch - only a resolved, non-null session does.
 */
export function ProtectedRoute() {
  const { data: session, isLoading } = useAuthSession()

  if (isLoading) {
    return <LoadingFallback />
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

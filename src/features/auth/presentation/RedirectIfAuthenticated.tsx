import { Navigate, Outlet } from 'react-router-dom'
import { HabitexBootScreen } from '@/shared/components/HabitexBootScreen'
import { useAuthSession } from '../application/useAuthSession'

/**
 * Guards routes that only make sense when signed out (currently just
 * /login). Mirrors ProtectedRoute's fail-closed loading handling so both
 * guards agree on the same session state and never fight each other into a
 * redirect loop.
 */
export function RedirectIfAuthenticated() {
  const { data: session, isLoading } = useAuthSession()

  if (isLoading) {
    return <HabitexBootScreen />
  }

  if (session) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

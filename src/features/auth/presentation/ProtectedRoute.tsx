import { Navigate, Outlet } from 'react-router-dom'
import { HabitexBootScreen } from '@/shared/components/HabitexBootScreen'
import { useAuthSession } from '../application/useAuthSession'

/**
 * Gates child routes on an authenticated Supabase session.
 *
 * The loading (unknown) state renders a fallback and never falls through to
 * the authenticated branch - only a resolved, non-null session does. If
 * getSession() fails, `data` stays undefined (query settles into an error
 * state, not a session), so the `!session` branch below also covers errors:
 * fail closed, same as "no session" - never render protected content.
 */
export function ProtectedRoute() {
  const { data: session, isLoading } = useAuthSession()

  if (isLoading) {
    return <HabitexBootScreen />
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

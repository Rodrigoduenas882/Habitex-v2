import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabaseSessionRepository } from '../infrastructure/supabase-session.repository'
import type { AuthSession } from '../domain/session.types'
import { authQueryKeys } from './auth-query-keys'

/**
 * Bridges Supabase auth state changes into TanStack Query.
 *
 * On sign-out or identity change (a different user signs in), it clears the
 * entire query cache so no server state belonging to the previous user leaks
 * into the new session. Mount once near the app root.
 */
export function AuthSessionListener() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const unsubscribe = supabaseSessionRepository.onAuthStateChange((session) => {
      const previous = queryClient.getQueryData<AuthSession>(authQueryKeys.session)
      const identityChanged = previous?.userId !== session?.userId

      if (identityChanged) {
        queryClient.clear()
      }

      queryClient.setQueryData(authQueryKeys.session, session)
    })

    return unsubscribe
  }, [queryClient])

  return null
}

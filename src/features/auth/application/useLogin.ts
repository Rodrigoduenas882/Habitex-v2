import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabaseSessionRepository } from '../infrastructure/supabase-session.repository'
import type { AuthSession, SessionAuthError, SessionCredentials } from '../domain/session.types'
import { authQueryKeys } from './auth-query-keys'

/**
 * Eagerly writes the returned session into the query cache on success so the
 * UI (ProtectedRoute) reacts immediately, instead of waiting on the
 * asynchronous onAuthStateChange round trip that AuthSessionListener also
 * reacts to. Both end up setting the same value - harmless and not a second
 * listener, just an authoritative write of a value this mutation already has.
 */
export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation<AuthSession, SessionAuthError, SessionCredentials>({
    mutationFn: (credentials) => supabaseSessionRepository.signInWithPassword(credentials),
    onSuccess: (session) => {
      if (import.meta.env.DEV) {
        // TEMPORARY: remove alongside the repository's [auth-timing] logs.
        console.info(`[auth-timing] useLogin onSuccess setQueryData at ${performance.now().toFixed(0)}ms`)
      }
      queryClient.setQueryData(authQueryKeys.session, session)
    },
  })
}

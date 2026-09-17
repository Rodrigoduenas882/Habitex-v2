import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabaseSessionRepository } from '../infrastructure/supabase-session.repository'
import { authQueryKeys } from './auth-query-keys'

/**
 * Eagerly nulls the session in the query cache on success so the UI
 * (ProtectedRoute) reacts immediately instead of waiting on the
 * asynchronous onAuthStateChange round trip - mirrors useLogin's eager
 * write. Removing *business* data belonging to the signed-out user is still
 * AuthSessionListener's job alone (it reacts to every identity change, not
 * just ones caused by this mutation); this only writes the auth session
 * value itself, so there is exactly one place that decides when private
 * data gets cleared.
 */
export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => supabaseSessionRepository.signOut(),
    onSuccess: () => {
      if (import.meta.env.DEV) {
        // TEMPORARY: remove alongside the repository's [auth-timing] logs.
        console.info(`[auth-timing] useLogout onSuccess setQueryData at ${performance.now().toFixed(0)}ms`)
      }
      queryClient.setQueryData(authQueryKeys.session, null)
    },
    onError: (error: unknown) => {
      if (import.meta.env.DEV) {
        console.error('Sign out failed:', error)
      }
    },
  })
}

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { supabaseSessionRepository } from '../infrastructure/supabase-session.repository'
import { authQueryKeys } from './auth-query-keys'

/**
 * Bridges Supabase auth state changes into TanStack Query.
 *
 * On sign-out or identity change (a different user signs in), it removes
 * cached server state belonging to the previous user - everything *except*
 * the ['auth', ...] namespace itself. Mount once near the app root.
 *
 * Two things that both look reasonable independently combine into a bug:
 *
 * 1. queryClient.clear() (or removeQueries matching the session key) doesn't
 *    just drop cached data - it destroys the Query instance a currently
 *    mounted useAuthSession() observer is subscribed to. A subsequent
 *    setQueryData() recreates the cache entry but does not reconnect that
 *    orphaned observer, so the component never sees the update and gets
 *    stuck on its last rendered state (loading forever on a page-load race,
 *    or "still logged out"/"still logged in" forever on a real login/logout
 *    - only a full remount, e.g. F5, creates a fresh observer that reads
 *    the correct cache state).
 * 2. Supabase fires onAuthStateChange for every real transition, including
 *    the login/logout the user just performed in this same tab - so this
 *    listener runs on every sign-in and sign-out, not just on page load.
 *
 * The fix: never remove the auth session query itself, only "business" data
 * under other key namespaces (see the architecture note on queryClient.ts -
 * every non-auth key is scoped like ["administration", id, ...], never
 * bare). The previously-observed identity is tracked in a ref (not read
 * from the query cache, which can be transiently empty while the initial
 * getSession() call is still in flight) so the very first event this
 * listener ever sees is never treated as a change - there's nothing to
 * clean up yet on a fresh mount.
 */
export function AuthSessionListener() {
  const queryClient = useQueryClient()
  const previousUserIdRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const unsubscribe = supabaseSessionRepository.onAuthStateChange((session) => {
      const previousUserId = previousUserIdRef.current
      const currentUserId = session?.userId ?? null
      const isFirstObservedEvent = previousUserId === undefined
      const identityChanged = !isFirstObservedEvent && previousUserId !== currentUserId

      if (identityChanged) {
        queryClient.removeQueries({
          predicate: (query) => query.queryKey[0] !== authQueryKeys.session[0],
        })
      }

      previousUserIdRef.current = currentUserId
      queryClient.setQueryData(authQueryKeys.session, session)
    })

    return unsubscribe
  }, [queryClient])

  return null
}

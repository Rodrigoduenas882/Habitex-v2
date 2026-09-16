import { useQuery } from '@tanstack/react-query'
import { supabaseSessionRepository } from '../infrastructure/supabase-session.repository'
import { authQueryKeys } from './auth-query-keys'

/**
 * Current auth session as server state. Kept up to date by AuthSessionListener
 * pushing updates into the query cache, so this only ever fetches once to
 * rehydrate on load.
 *
 * `isLoading` (unknown) must never be treated as authenticated - callers should
 * gate on `data` only once `isLoading` is false.
 */
export function useAuthSession() {
  return useQuery({
    queryKey: authQueryKeys.session,
    queryFn: () => supabaseSessionRepository.getSession(),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })
}

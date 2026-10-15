import { QueryClient } from '@tanstack/react-query'

/**
 * No retries, no delays - tests should fail fast and deterministically.
 *
 * `staleTime: 30_000` is kept intentionally equal to the real app's own
 * QueryClient value (see app/providers/queryClient.ts's own `staleTime`):
 * without it, the default `staleTime: 0` makes react-query treat data as
 * stale the instant it resolves, so a *second* `useQuery` observer for the
 * same already-resolved key - mounting later in the same test, e.g. a
 * shared component like RentalContextHeader (DS-002) that only mounts once
 * its host page's own `relationship` lookup already resolved - triggers an
 * extra background refetch purely as a test artifact (real usage never hits
 * this inside the 30s window). Explicit invalidation (`invalidateQueries`)
 * still forces a refetch regardless of staleTime, so every test asserting a
 * mutation's own list-refetch keeps working exactly as before. The literal
 * is duplicated here rather than imported from app/providers/queryClient.ts
 * to avoid a shared/testing -> app/providers dependency direction.
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30_000 },
      mutations: { retry: false },
    },
  })
}

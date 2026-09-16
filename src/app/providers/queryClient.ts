import { QueryClient } from '@tanstack/react-query'

/**
 * Central QueryClient. Defaults favor request dedupe and a controlled cache
 * lifetime; individual queries (e.g. session, real-time-adjacent data) override
 * staleTime/gcTime explicitly when the default isn't right for them.
 *
 * Query keys must be scoped by administrative context once that concept
 * exists, e.g. ["administration", administrationId, "rentals"], never bare
 * resource names like ["rentals"].
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}

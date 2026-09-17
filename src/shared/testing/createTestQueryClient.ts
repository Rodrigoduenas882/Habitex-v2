import { QueryClient } from '@tanstack/react-query'

/** No retries, no delays - tests should fail fast and deterministically. */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

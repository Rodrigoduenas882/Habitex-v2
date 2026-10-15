import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useRentalTermsExistence } from './useRentalTermsExistence'

const { listRelationshipIdsWithTerms } = vi.hoisted(() => ({ listRelationshipIdsWithTerms: vi.fn() }))

vi.mock('../infrastructure/supabase-rental-terms.repository', () => ({
  supabaseRentalTermsRepository: { create: vi.fn(), getCurrent: vi.fn(), listRelationshipIdsWithTerms },
}))

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('useRentalTermsExistence', () => {
  it('stays disabled and never fetches while administrationId is not resolved', () => {
    const { result } = renderHook(() => useRentalTermsExistence(undefined, ['rel-1']), {
      wrapper: wrapperFor(createClient()),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(listRelationshipIdsWithTerms).not.toHaveBeenCalled()
  })

  it('stays disabled and never fetches when the id list is empty, even with a resolved administrationId', () => {
    const { result } = renderHook(() => useRentalTermsExistence('admin-1', []), {
      wrapper: wrapperFor(createClient()),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(listRelationshipIdsWithTerms).not.toHaveBeenCalled()
  })

  it('fetches through the port once administrationId is resolved and there is at least one id', async () => {
    listRelationshipIdsWithTerms.mockResolvedValueOnce(new Set(['rel-1']))
    const { result } = renderHook(() => useRentalTermsExistence('admin-1', ['rel-1', 'rel-2']), {
      wrapper: wrapperFor(createClient()),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(listRelationshipIdsWithTerms).toHaveBeenCalledWith(['rel-1', 'rel-2'])
    expect(result.current.data).toEqual(new Set(['rel-1']))
  })

  it('scopes the query key by administrationId, nested under the rentals list key prefix', async () => {
    listRelationshipIdsWithTerms.mockResolvedValueOnce(new Set())
    const client = createClient()
    const { result } = renderHook(() => useRentalTermsExistence('admin-1', ['rel-1']), {
      wrapper: wrapperFor(client),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    const cached = client.getQueryCache().findAll({
      queryKey: ['administration', 'admin-1', 'rentals'],
    })
    expect(cached.some((query) => query.queryKey.includes('terms-existence'))).toBe(true)
  })
})

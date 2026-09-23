import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { RentalTermVersion } from '../domain/rental-terms.types'
import { useRentalTermVersion } from './useRentalTermVersion'

const { getCurrent } = vi.hoisted(() => ({ getCurrent: vi.fn() }))

vi.mock('../infrastructure/supabase-rental-terms.repository', () => ({
  supabaseRentalTermsRepository: { create: vi.fn(), getCurrent },
}))

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

const TERM_VERSION: RentalTermVersion = {
  id: 'term-1',
  rentalRelationshipId: 'rel-1',
  versionNumber: 1,
  effectiveFrom: '2026-01-01',
  effectiveUntil: null,
  rentAmount: 1000000,
  administrationMode: 'NONE',
  utilitiesMode: null,
  createdAt: '2026-01-01T00:00:00Z',
}

describe('useRentalTermVersion', () => {
  it('stays disabled and never fetches while administrationId is not resolved', () => {
    const { result } = renderHook(() => useRentalTermVersion(undefined, 'rel-1'), {
      wrapper: wrapperFor(createClient()),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(getCurrent).not.toHaveBeenCalled()
  })

  it('stays disabled and never fetches while relationshipId is not resolved', () => {
    const { result } = renderHook(() => useRentalTermVersion('admin-1', undefined), {
      wrapper: wrapperFor(createClient()),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(getCurrent).not.toHaveBeenCalled()
  })

  it('fetches the current term version through the port once both ids are resolved', async () => {
    getCurrent.mockResolvedValueOnce(TERM_VERSION)
    const { result } = renderHook(() => useRentalTermVersion('admin-1', 'rel-1'), {
      wrapper: wrapperFor(createClient()),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(getCurrent).toHaveBeenCalledWith('rel-1')
    expect(result.current.data).toEqual(TERM_VERSION)
  })

  it('resolves to null when no term version exists yet, without treating that as an error', async () => {
    getCurrent.mockResolvedValueOnce(null)
    const { result } = renderHook(() => useRentalTermVersion('admin-1', 'rel-1'), {
      wrapper: wrapperFor(createClient()),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toBeNull()
  })
})

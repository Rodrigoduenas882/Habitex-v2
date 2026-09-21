import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { RentalRepositoryError, type CreateRentalDraftInput } from '../domain/rental.types'
import { rentalQueryKeys } from './rental-query-keys'
import { useCreateRentalDraft } from './useCreateRentalDraft'

const { createDraft } = vi.hoisted(() => ({ createDraft: vi.fn() }))

vi.mock('../infrastructure/supabase-rental.repository', () => ({
  supabaseRentalRepository: { createDraft, listByAdministration: vi.fn() },
}))

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

const INPUT: CreateRentalDraftInput = {
  administrationId: 'admin-1',
  rentalSubjectId: 'subj-1',
  tenant: { kind: 'existing', personId: 'person-1' },
}

describe('useCreateRentalDraft', () => {
  it('calls the repository through the port with the submitted input, exactly once', async () => {
    createDraft.mockResolvedValueOnce({ rentalRelationshipId: 'rel-1', tenantPersonId: 'person-1' })
    const { result } = renderHook(() => useCreateRentalDraft(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(createDraft).toHaveBeenCalledTimes(1)
    expect(createDraft).toHaveBeenCalledWith(INPUT)
    expect(result.current.data).toEqual({ rentalRelationshipId: 'rel-1', tenantPersonId: 'person-1' })
  })

  it('surfaces a repository failure as a mutation error', async () => {
    createDraft.mockRejectedValueOnce(new RentalRepositoryError('Failed to create the rental draft'))
    const { result } = renderHook(() => useCreateRentalDraft(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })

  it('invalidates ["administration", administrationId, "rentals"] for that administration on success', async () => {
    createDraft.mockResolvedValueOnce({ rentalRelationshipId: 'rel-1', tenantPersonId: 'person-1' })
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCreateRentalDraft(), { wrapper: wrapperFor(client) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: rentalQueryKeys.list('admin-1') })
  })
})

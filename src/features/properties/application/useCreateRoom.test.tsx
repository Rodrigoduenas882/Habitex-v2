import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { RoomRepositoryError } from '../domain/room.types'
import { roomQueryKeys } from './room-query-keys'
import { useCreateRoom } from './useCreateRoom'

const { createForProperty } = vi.hoisted(() => ({ createForProperty: vi.fn() }))

vi.mock('../infrastructure/supabase-room.repository', () => ({
  supabaseRoomRepository: { createForProperty },
}))

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

const INPUT = {
  propertyId: 'prop-1',
  name: 'Habitación 1',
  bathroomType: 'PRIVATE' as const,
  furnished: true,
  description: null,
}

describe('useCreateRoom', () => {
  it('calls the repository through the port with the submitted input', async () => {
    createForProperty.mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useCreateRoom(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(createForProperty).toHaveBeenCalledWith(INPUT)
  })

  it('invalidates ["property", propertyId, "rooms"] for that property on success', async () => {
    createForProperty.mockResolvedValueOnce(undefined)
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCreateRoom(), { wrapper: wrapperFor(client) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: roomQueryKeys.list('prop-1') })
  })

  it('surfaces a repository failure as a mutation error, carrying its code', async () => {
    createForProperty.mockRejectedValueOnce(
      new RoomRepositoryError('Failed to create the room', 'duplicate_name'),
    )
    const { result } = renderHook(() => useCreateRoom(), { wrapper: wrapperFor(createClient()) })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as RoomRepositoryError | null)?.code).toBe('duplicate_name')
  })
})

import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { RoomRepositoryError } from '../domain/room.types'
import { roomQueryKeys } from './room-query-keys'
import { useRooms } from './useRooms'

const { listByProperty } = vi.hoisted(() => ({ listByProperty: vi.fn() }))

vi.mock('../infrastructure/supabase-room.repository', () => ({
  supabaseRoomRepository: { listByProperty },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useRooms', () => {
  it('does not fetch while no propertyId is available', () => {
    const { result } = renderHook(() => useRooms(undefined), { wrapper })

    expect(listByProperty).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches through the port, scoped under ["property", propertyId, "rooms"], once a propertyId is available', async () => {
    listByProperty.mockResolvedValueOnce([
      {
        id: 'room-1',
        propertyId: 'prop-1',
        name: 'Habitación 1',
        bathroomType: 'PRIVATE',
        furnished: true,
        description: null,
        isEnabled: true,
      },
    ])

    const { result } = renderHook(() => useRooms('prop-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(listByProperty).toHaveBeenCalledWith('prop-1')
    expect(result.current.data).toHaveLength(1)
  })

  it('uses the ["property", propertyId, "rooms"] key shape', () => {
    expect(roomQueryKeys.list('prop-1')).toEqual(['property', 'prop-1', 'rooms'])
  })

  it('surfaces a repository failure as a query error', async () => {
    listByProperty.mockRejectedValueOnce(new RoomRepositoryError('Failed to list rooms for the property'))

    const { result } = renderHook(() => useRooms('prop-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})

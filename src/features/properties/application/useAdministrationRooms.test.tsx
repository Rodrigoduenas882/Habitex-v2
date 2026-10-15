import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { RoomRepositoryError } from '../domain/room.types'
import { roomQueryKeys } from './room-query-keys'
import { useAdministrationRooms } from './useAdministrationRooms'

const { listByAdministration } = vi.hoisted(() => ({ listByAdministration: vi.fn() }))

vi.mock('../infrastructure/supabase-room.repository', () => ({
  supabaseRoomRepository: { listByAdministration },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useAdministrationRooms', () => {
  it('does not fetch while no administrationId is available', () => {
    const { result } = renderHook(() => useAdministrationRooms(undefined), { wrapper })

    expect(listByAdministration).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches through the port, scoped under ["administration", administrationId, "rooms"], once an administrationId is available', async () => {
    listByAdministration.mockResolvedValueOnce([
      {
        id: 'room-1',
        administrationId: 'admin-1',
        propertyId: 'prop-1',
        name: 'Habitación 1',
        bathroomType: 'PRIVATE',
        furnished: true,
        description: null,
        isEnabled: true,
      },
    ])

    const { result } = renderHook(() => useAdministrationRooms('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(listByAdministration).toHaveBeenCalledWith('admin-1')
    expect(result.current.data).toHaveLength(1)
  })

  it('uses the ["administration", administrationId, "rooms"] key shape', () => {
    expect(roomQueryKeys.byAdministration('admin-1')).toEqual(['administration', 'admin-1', 'rooms'])
  })

  it('surfaces a repository failure as a query error', async () => {
    listByAdministration.mockRejectedValueOnce(new RoomRepositoryError('Failed to list rooms for the administration'))

    const { result } = renderHook(() => useAdministrationRooms('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})

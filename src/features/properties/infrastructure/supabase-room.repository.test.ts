import { describe, expect, it, vi } from 'vitest'
import { RoomRepositoryError } from '../domain/room.types'

const { eq, select, from, rpc } = vi.hoisted(() => {
  const eq = vi.fn()
  const select = vi.fn((_columns: string) => ({ eq }))
  const from = vi.fn((_table: string) => ({ select }))
  const rpc = vi.fn()
  return { eq, select, from, rpc }
})

vi.mock('@/infrastructure/supabase/client', () => ({
  supabaseClient: { from, rpc },
}))

import { supabaseRoomRepository } from './supabase-room.repository'

describe('supabaseRoomRepository.listByProperty', () => {
  it('queries rooms scoped by property_id and maps snake_case rows to the domain shape', async () => {
    eq.mockResolvedValueOnce({
      data: [
        {
          id: 'room-1',
          property_id: 'prop-1',
          name: 'Habitación 1',
          bathroom_type: 'PRIVATE',
          furnished: true,
          description: 'Con balcón',
          is_enabled: true,
        },
      ],
      error: null,
    })

    const result = await supabaseRoomRepository.listByProperty('prop-1')

    expect(from).toHaveBeenCalledWith('rooms')
    expect(eq).toHaveBeenCalledWith('property_id', 'prop-1')
    expect(result).toEqual([
      {
        id: 'room-1',
        propertyId: 'prop-1',
        name: 'Habitación 1',
        bathroomType: 'PRIVATE',
        furnished: true,
        description: 'Con balcón',
        isEnabled: true,
      },
    ])
  })

  it('never selects every column with *', () => {
    for (const [columns] of select.mock.calls) {
      expect(columns).not.toBe('*')
      expect(columns).not.toContain('*')
    }
  })

  it('wraps a Supabase failure in RoomRepositoryError instead of throwing the raw error', async () => {
    eq.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await expect(supabaseRoomRepository.listByProperty('prop-1')).rejects.toBeInstanceOf(RoomRepositoryError)
  })
})

describe('supabaseRoomRepository.createForProperty', () => {
  it('calls create_room_asset with the exact expected payload', async () => {
    rpc.mockResolvedValueOnce({ data: { id: 'rental-subject-1' }, error: null })

    await supabaseRoomRepository.createForProperty({
      propertyId: 'prop-1',
      name: 'Habitación 1',
      bathroomType: 'PRIVATE',
      furnished: true,
      description: 'Con balcón',
    })

    expect(rpc).toHaveBeenCalledWith('create_room_asset', {
      p_property_id: 'prop-1',
      p_name: 'Habitación 1',
      p_bathroom_type: 'PRIVATE',
      p_furnished: true,
      p_description: 'Con balcón',
    })
  })

  it('sends null for an unspecified bathroom type and an empty description', async () => {
    rpc.mockResolvedValueOnce({ data: { id: 'rental-subject-2' }, error: null })

    await supabaseRoomRepository.createForProperty({
      propertyId: 'prop-1',
      name: 'Habitación 2',
      bathroomType: null,
      furnished: false,
      description: null,
    })

    expect(rpc).toHaveBeenCalledWith('create_room_asset', {
      p_property_id: 'prop-1',
      p_name: 'Habitación 2',
      p_bathroom_type: null,
      p_furnished: false,
      p_description: null,
    })
  })

  it('does not treat the rental_subjects row as a Room (returns void)', async () => {
    rpc.mockResolvedValueOnce({ data: { id: 'rental-subject-1' }, error: null })

    await expect(
      supabaseRoomRepository.createForProperty({
        propertyId: 'prop-1',
        name: 'Habitación 1',
        bathroomType: null,
        furnished: false,
        description: null,
      }),
    ).resolves.toBeUndefined()
  })

  it('wraps a generic Supabase RPC failure in RoomRepositoryError with code "unknown"', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    const error = await supabaseRoomRepository
      .createForProperty({
        propertyId: 'prop-1',
        name: 'Habitación 1',
        bathroomType: null,
        furnished: false,
        description: null,
      })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(RoomRepositoryError)
    expect((error as RoomRepositoryError).code).toBe('unknown')
  })

  it('maps a Postgres unique_violation (23505) to RoomRepositoryError with code "duplicate_name"', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint "rooms_property_id_name_key"' },
    })

    const error = await supabaseRoomRepository
      .createForProperty({
        propertyId: 'prop-1',
        name: 'Habitación 1',
        bathroomType: null,
        furnished: false,
        description: null,
      })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(RoomRepositoryError)
    expect((error as RoomRepositoryError).code).toBe('duplicate_name')
  })
})

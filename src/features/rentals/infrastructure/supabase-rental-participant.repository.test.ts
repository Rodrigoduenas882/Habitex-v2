import { describe, expect, it, vi } from 'vitest'
import { RentalParticipantRepositoryError } from '../domain/rental-participant.types'

const { from, participantsSelect, participantsIn, participantsEqType, participantsEqStatus, peopleSelect, peopleIn } =
  vi.hoisted(() => {
    const participantsEqStatus = vi.fn()
    const participantsEqType = vi.fn((_column: string, _value: string) => ({ eq: participantsEqStatus }))
    const participantsIn = vi.fn((_column: string, _values: string[]) => ({ eq: participantsEqType }))
    const participantsSelect = vi.fn((_columns: string) => ({ in: participantsIn }))
    const peopleIn = vi.fn()
    const peopleSelect = vi.fn((_columns: string) => ({ in: peopleIn }))
    const from = vi.fn((table: string) => {
      if (table === 'rental_participants') return { select: participantsSelect }
      return { select: peopleSelect }
    })
    return {
      from,
      participantsSelect,
      participantsIn,
      participantsEqType,
      participantsEqStatus,
      peopleSelect,
      peopleIn,
    }
  })

vi.mock('@/infrastructure/supabase/client', () => ({
  supabaseClient: { from },
}))

import { supabaseRentalParticipantRepository } from './supabase-rental-participant.repository'

describe('supabaseRentalParticipantRepository.listActiveTenantNamesByRelationshipIds', () => {
  it('returns an empty Map without calling Supabase when given an empty array', async () => {
    from.mockClear()

    const result = await supabaseRentalParticipantRepository.listActiveTenantNamesByRelationshipIds([])

    expect(result).toEqual(new Map())
    expect(from).not.toHaveBeenCalled()
  })

  it('queries rental_participants scoped by a single .in() + participation_type=TENANT + status=ACTIVE, then people in one batched pair of queries', async () => {
    participantsEqStatus.mockResolvedValueOnce({
      data: [
        { rental_relationship_id: 'rel-1', person_id: 'person-1' },
        { rental_relationship_id: 'rel-2', person_id: 'person-2' },
      ],
      error: null,
    })
    peopleIn.mockResolvedValueOnce({
      data: [
        { id: 'person-1', full_name: 'María Pérez' },
        { id: 'person-2', full_name: 'Juan Gómez' },
      ],
      error: null,
    })

    const result = await supabaseRentalParticipantRepository.listActiveTenantNamesByRelationshipIds([
      'rel-1',
      'rel-2',
    ])

    expect(from).toHaveBeenCalledWith('rental_participants')
    expect(participantsIn).toHaveBeenCalledWith('rental_relationship_id', ['rel-1', 'rel-2'])
    expect(participantsEqType).toHaveBeenCalledWith('participation_type', 'TENANT')
    expect(participantsEqStatus).toHaveBeenCalledWith('status', 'ACTIVE')
    expect(from).toHaveBeenCalledWith('people')
    expect(peopleIn).toHaveBeenCalledWith('id', ['person-1', 'person-2'])
    expect(result).toEqual(
      new Map([
        ['rel-1', 'María Pérez'],
        ['rel-2', 'Juan Gómez'],
      ]),
    )
  })

  it('issues exactly one query per table regardless of how many relationship ids are passed', async () => {
    from.mockClear()
    participantsEqStatus.mockResolvedValueOnce({
      data: [
        { rental_relationship_id: 'rel-1', person_id: 'person-1' },
        { rental_relationship_id: 'rel-2', person_id: 'person-1' },
        { rental_relationship_id: 'rel-3', person_id: 'person-1' },
      ],
      error: null,
    })
    peopleIn.mockResolvedValueOnce({ data: [{ id: 'person-1', full_name: 'María Pérez' }], error: null })

    await supabaseRentalParticipantRepository.listActiveTenantNamesByRelationshipIds(['rel-1', 'rel-2', 'rel-3'])

    expect(from).toHaveBeenCalledTimes(2)
    expect(peopleIn).toHaveBeenCalledWith('id', ['person-1'])
  })

  it('leaves a relationship with no TENANT/ACTIVE row absent from the Map - not an error, not a null-valued entry', async () => {
    participantsEqStatus.mockResolvedValueOnce({
      data: [{ rental_relationship_id: 'rel-1', person_id: 'person-1' }],
      error: null,
    })
    peopleIn.mockResolvedValueOnce({ data: [{ id: 'person-1', full_name: 'María Pérez' }], error: null })

    const result = await supabaseRentalParticipantRepository.listActiveTenantNamesByRelationshipIds([
      'rel-1',
      'rel-2',
    ])

    expect(result.has('rel-2')).toBe(false)
    expect(result.get('rel-1')).toBe('María Pérez')
  })

  it('returns an empty Map without querying people when there are zero matching participant rows', async () => {
    from.mockClear()
    participantsEqStatus.mockResolvedValueOnce({ data: [], error: null })

    const result = await supabaseRentalParticipantRepository.listActiveTenantNamesByRelationshipIds(['rel-1'])

    expect(result).toEqual(new Map())
    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith('rental_participants')
  })

  it('never selects every column with *', async () => {
    participantsEqStatus.mockResolvedValueOnce({
      data: [{ rental_relationship_id: 'rel-1', person_id: 'person-1' }],
      error: null,
    })
    peopleIn.mockResolvedValueOnce({ data: [{ id: 'person-1', full_name: 'María Pérez' }], error: null })

    await supabaseRentalParticipantRepository.listActiveTenantNamesByRelationshipIds(['rel-1'])

    for (const [columns] of [...participantsSelect.mock.calls, ...peopleSelect.mock.calls]) {
      expect(columns).not.toBe('*')
      expect(columns).not.toContain('*')
    }
  })

  it('wraps a rental_participants failure in RentalParticipantRepositoryError', async () => {
    participantsEqStatus.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await expect(
      supabaseRentalParticipantRepository.listActiveTenantNamesByRelationshipIds(['rel-1']),
    ).rejects.toBeInstanceOf(RentalParticipantRepositoryError)
  })

  it('wraps a people lookup failure in RentalParticipantRepositoryError', async () => {
    participantsEqStatus.mockResolvedValueOnce({
      data: [{ rental_relationship_id: 'rel-1', person_id: 'person-1' }],
      error: null,
    })
    peopleIn.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await expect(
      supabaseRentalParticipantRepository.listActiveTenantNamesByRelationshipIds(['rel-1']),
    ).rejects.toBeInstanceOf(RentalParticipantRepositoryError)
  })
})

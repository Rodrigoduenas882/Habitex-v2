import { describe, expect, it, vi } from 'vitest'
import { RentalSubjectRepositoryError } from '../domain/rental-subject.types'

const { from, subjectsEqType, subjectsEqAdmin, subjectsSelect, assetIn, linksEq, linksSelect } = vi.hoisted(() => {
  const assetIn = vi.fn()
  const assetSelect = vi.fn((_columns: string) => ({ in: assetIn }))
  const subjectsEqType = vi.fn()
  const subjectsEqAdmin = vi.fn((_column: string, _value: string) => ({ eq: subjectsEqType }))
  const subjectsSelect = vi.fn((_columns: string) => ({ eq: subjectsEqAdmin }))
  const linksEq = vi.fn()
  const linksSelect = vi.fn((_columns: string) => ({ eq: linksEq }))
  const from = vi.fn((table: string) => {
    if (table === 'rental_subjects') return { select: subjectsSelect }
    if (table === 'rental_relationship_subjects') return { select: linksSelect }
    return { select: assetSelect }
  })
  return { from, subjectsEqType, subjectsEqAdmin, subjectsSelect, assetIn, linksEq, linksSelect }
})

vi.mock('@/infrastructure/supabase/client', () => ({
  supabaseClient: { from },
}))

import { supabaseRentalSubjectRepository } from './supabase-rental-subject.repository'

describe('supabaseRentalSubjectRepository.listByAdministration', () => {
  it('FULL_PROPERTY: queries rental_subjects then properties, and resolves label from the real property name', async () => {
    subjectsEqType.mockResolvedValueOnce({
      data: [{ id: 'subj-1', administration_id: 'admin-1', subject_type: 'FULL_PROPERTY', property_id: 'prop-1', room_id: null, parking_id: null }],
      error: null,
    })
    assetIn.mockResolvedValueOnce({ data: [{ id: 'prop-1', name: 'la florida' }], error: null })

    const result = await supabaseRentalSubjectRepository.listByAdministration('admin-1', 'FULL_PROPERTY')

    expect(from).toHaveBeenCalledWith('rental_subjects')
    expect(subjectsEqAdmin).toHaveBeenCalledWith('administration_id', 'admin-1')
    expect(subjectsEqType).toHaveBeenCalledWith('subject_type', 'FULL_PROPERTY')
    expect(from).toHaveBeenCalledWith('properties')
    expect(assetIn).toHaveBeenCalledWith('id', ['prop-1'])
    expect(result).toEqual([
      {
        id: 'subj-1',
        administrationId: 'admin-1',
        subjectType: 'FULL_PROPERTY',
        propertyId: 'prop-1',
        roomId: null,
        parkingId: null,
        label: 'la florida',
      },
    ])
  })

  it('ROOM: queries rooms and resolves label from the real room name', async () => {
    subjectsEqType.mockResolvedValueOnce({
      data: [{ id: 'subj-2', administration_id: 'admin-1', subject_type: 'ROOM', property_id: null, room_id: 'room-1', parking_id: null }],
      error: null,
    })
    assetIn.mockResolvedValueOnce({ data: [{ id: 'room-1', name: 'Habitación 2' }], error: null })

    const result = await supabaseRentalSubjectRepository.listByAdministration('admin-1', 'ROOM')

    expect(from).toHaveBeenCalledWith('rooms')
    expect(assetIn).toHaveBeenCalledWith('id', ['room-1'])
    expect(result).toEqual([
      {
        id: 'subj-2',
        administrationId: 'admin-1',
        subjectType: 'ROOM',
        propertyId: null,
        roomId: 'room-1',
        parkingId: null,
        label: 'Habitación 2',
      },
    ])
  })

  it('PARKING: queries parkings and resolves label from the real parking identifier', async () => {
    subjectsEqType.mockResolvedValueOnce({
      data: [{ id: 'subj-3', administration_id: 'admin-1', subject_type: 'PARKING', property_id: null, room_id: null, parking_id: 'park-1' }],
      error: null,
    })
    assetIn.mockResolvedValueOnce({ data: [{ id: 'park-1', identifier: 'P-12' }], error: null })

    const result = await supabaseRentalSubjectRepository.listByAdministration('admin-1', 'PARKING')

    expect(from).toHaveBeenCalledWith('parkings')
    expect(result).toEqual([
      {
        id: 'subj-3',
        administrationId: 'admin-1',
        subjectType: 'PARKING',
        propertyId: null,
        roomId: null,
        parkingId: 'park-1',
        label: 'P-12',
      },
    ])
  })

  it('returns [] without querying the asset table when there are zero subjects', async () => {
    subjectsEqType.mockResolvedValueOnce({ data: [], error: null })
    from.mockClear()

    const result = await supabaseRentalSubjectRepository.listByAdministration('admin-1', 'FULL_PROPERTY')

    expect(result).toEqual([])
    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith('rental_subjects')
  })

  it('never selects every column with *', async () => {
    subjectsEqType.mockResolvedValueOnce({ data: [], error: null })

    await supabaseRentalSubjectRepository.listByAdministration('admin-1', 'FULL_PROPERTY')

    for (const [columns] of subjectsSelect.mock.calls) {
      expect(columns).not.toBe('*')
      expect(columns).not.toContain('*')
    }
  })

  it('falls back to the subject id (never a fabricated name) if the referenced asset row is missing', async () => {
    subjectsEqType.mockResolvedValueOnce({
      data: [{ id: 'subj-4', administration_id: 'admin-1', subject_type: 'FULL_PROPERTY', property_id: 'prop-missing', room_id: null, parking_id: null }],
      error: null,
    })
    assetIn.mockResolvedValueOnce({ data: [], error: null })

    const result = await supabaseRentalSubjectRepository.listByAdministration('admin-1', 'FULL_PROPERTY')

    expect(result).toEqual([
      {
        id: 'subj-4',
        administrationId: 'admin-1',
        subjectType: 'FULL_PROPERTY',
        propertyId: 'prop-missing',
        roomId: null,
        parkingId: null,
        label: 'subj-4',
      },
    ])
  })

  it('wraps a rental_subjects failure in RentalSubjectRepositoryError', async () => {
    subjectsEqType.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await expect(
      supabaseRentalSubjectRepository.listByAdministration('admin-1', 'FULL_PROPERTY'),
    ).rejects.toBeInstanceOf(RentalSubjectRepositoryError)
  })

  it('wraps an asset-resolution failure in RentalSubjectRepositoryError', async () => {
    subjectsEqType.mockResolvedValueOnce({
      data: [{ id: 'subj-5', administration_id: 'admin-1', subject_type: 'FULL_PROPERTY', property_id: 'prop-1', room_id: null, parking_id: null }],
      error: null,
    })
    assetIn.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await expect(
      supabaseRentalSubjectRepository.listByAdministration('admin-1', 'FULL_PROPERTY'),
    ).rejects.toBeInstanceOf(RentalSubjectRepositoryError)
  })
})

describe('supabaseRentalSubjectRepository.listRelationshipLinksByAdministration', () => {
  it('queries rental_relationship_subjects scoped by administration_id, selecting only the needed columns', async () => {
    linksEq.mockResolvedValueOnce({
      data: [
        { rental_relationship_id: 'rel-1', rental_subject_id: 'subj-1', subject_role: 'PRIMARY' },
        { rental_relationship_id: 'rel-2', rental_subject_id: 'subj-2', subject_role: 'INCLUDED' },
      ],
      error: null,
    })

    const result = await supabaseRentalSubjectRepository.listRelationshipLinksByAdministration('admin-1')

    expect(from).toHaveBeenCalledWith('rental_relationship_subjects')
    expect(linksEq).toHaveBeenCalledWith('administration_id', 'admin-1')
    expect(result).toEqual([
      { rentalRelationshipId: 'rel-1', rentalSubjectId: 'subj-1', subjectRole: 'PRIMARY' },
      { rentalRelationshipId: 'rel-2', rentalSubjectId: 'subj-2', subjectRole: 'INCLUDED' },
    ])
  })

  it('never selects every column with *', async () => {
    linksEq.mockResolvedValueOnce({ data: [], error: null })

    await supabaseRentalSubjectRepository.listRelationshipLinksByAdministration('admin-1')

    for (const [columns] of linksSelect.mock.calls) {
      expect(columns).not.toBe('*')
      expect(columns).not.toContain('*')
    }
  })

  it('wraps a Supabase failure in RentalSubjectRepositoryError', async () => {
    linksEq.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await expect(
      supabaseRentalSubjectRepository.listRelationshipLinksByAdministration('admin-1'),
    ).rejects.toBeInstanceOf(RentalSubjectRepositoryError)
  })
})

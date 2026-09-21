import { describe, expect, it, vi } from 'vitest'
import { TenantCandidateRepositoryError } from '../domain/tenant-candidate.types'

const { from, linksEq, linksSelect, peopleIn, peopleSelect } = vi.hoisted(() => {
  const linksEq = vi.fn()
  const linksSelect = vi.fn((_columns: string) => ({ eq: linksEq }))
  const peopleIn = vi.fn()
  const peopleSelect = vi.fn((_columns: string) => ({ in: peopleIn }))
  const from = vi.fn((table: string) => {
    if (table === 'person_administration_links') return { select: linksSelect }
    return { select: peopleSelect }
  })
  return { from, linksEq, linksSelect, peopleIn, peopleSelect }
})

vi.mock('@/infrastructure/supabase/client', () => ({
  supabaseClient: { from },
}))

import { supabaseTenantCandidateRepository } from './supabase-tenant-candidate.repository'

describe('supabaseTenantCandidateRepository.listByAdministration', () => {
  it('queries person_administration_links then people, mapping to TenantCandidate', async () => {
    linksEq.mockResolvedValueOnce({ data: [{ person_id: 'person-1' }], error: null })
    peopleIn.mockResolvedValueOnce({ data: [{ id: 'person-1', full_name: 'María Pérez' }], error: null })

    const result = await supabaseTenantCandidateRepository.listByAdministration('admin-1')

    expect(from).toHaveBeenCalledWith('person_administration_links')
    expect(linksEq).toHaveBeenCalledWith('administration_id', 'admin-1')
    expect(from).toHaveBeenCalledWith('people')
    expect(peopleIn).toHaveBeenCalledWith('id', ['person-1'])
    expect(result).toEqual([{ id: 'person-1', fullName: 'María Pérez' }])
  })

  it('does not filter by relationship_type - TENANT and CONTACT links both come back', async () => {
    linksEq.mockResolvedValueOnce({
      data: [{ person_id: 'person-1' }, { person_id: 'person-2' }],
      error: null,
    })
    peopleIn.mockResolvedValueOnce({
      data: [
        { id: 'person-1', full_name: 'Tenant Persona' },
        { id: 'person-2', full_name: 'Contact Persona' },
      ],
      error: null,
    })

    const result = await supabaseTenantCandidateRepository.listByAdministration('admin-1')

    expect(result).toHaveLength(2)
  })

  it('returns [] without querying people when there are zero links', async () => {
    linksEq.mockResolvedValueOnce({ data: [], error: null })
    from.mockClear()

    const result = await supabaseTenantCandidateRepository.listByAdministration('admin-1')

    expect(result).toEqual([])
    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith('person_administration_links')
  })

  it('never selects every column with *', async () => {
    linksEq.mockResolvedValueOnce({ data: [], error: null })

    await supabaseTenantCandidateRepository.listByAdministration('admin-1')

    for (const [columns] of [...linksSelect.mock.calls, ...peopleSelect.mock.calls]) {
      expect(columns).not.toBe('*')
      expect(columns).not.toContain('*')
    }
  })

  it('wraps a person_administration_links failure in TenantCandidateRepositoryError', async () => {
    linksEq.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await expect(supabaseTenantCandidateRepository.listByAdministration('admin-1')).rejects.toBeInstanceOf(
      TenantCandidateRepositoryError,
    )
  })

  it('wraps a people lookup failure in TenantCandidateRepositoryError', async () => {
    linksEq.mockResolvedValueOnce({ data: [{ person_id: 'person-1' }], error: null })
    peopleIn.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await expect(supabaseTenantCandidateRepository.listByAdministration('admin-1')).rejects.toBeInstanceOf(
      TenantCandidateRepositoryError,
    )
  })
})

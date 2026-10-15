import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { useRentalIdentities } from './useRentalIdentities'

const {
  rentalsListByAdministration,
  subjectsListByAdministration,
  linksListByAdministration,
  listActiveTenantNamesByRelationshipIds,
  listCurrentRentAmountsByRelationshipIds,
} = vi.hoisted(() => ({
  rentalsListByAdministration: vi.fn(),
  subjectsListByAdministration: vi.fn(),
  linksListByAdministration: vi.fn(),
  listActiveTenantNamesByRelationshipIds: vi.fn(),
  listCurrentRentAmountsByRelationshipIds: vi.fn(),
}))

vi.mock('../infrastructure/supabase-rental.repository', () => ({
  supabaseRentalRepository: { listByAdministration: rentalsListByAdministration },
}))
vi.mock('../infrastructure/supabase-rental-subject.repository', () => ({
  supabaseRentalSubjectRepository: {
    listByAdministration: subjectsListByAdministration,
    listRelationshipLinksByAdministration: linksListByAdministration,
  },
}))
vi.mock('../infrastructure/supabase-rental-participant.repository', () => ({
  supabaseRentalParticipantRepository: { listActiveTenantNamesByRelationshipIds },
}))
vi.mock('../infrastructure/supabase-rental-terms.repository', () => ({
  supabaseRentalTermsRepository: {
    create: vi.fn(),
    getCurrent: vi.fn(),
    listRelationshipIdsWithTerms: vi.fn(),
    listCurrentRentAmountsByRelationshipIds,
  },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function rental(id: string) {
  return {
    id,
    administrationId: 'admin-1',
    status: 'ACTIVE' as const,
    jurisdictionCountry: 'CO',
    realStartDate: null,
    trackingStartDate: null,
    expectedEndDate: null,
    actualEndDate: null,
    paymentDay: null,
    paymentTiming: null,
  }
}

function subject(id: string, subjectType: 'FULL_PROPERTY' | 'ROOM' | 'PARKING', label: string) {
  return {
    id,
    administrationId: 'admin-1',
    subjectType,
    propertyId: subjectType === 'FULL_PROPERTY' ? 'prop-1' : null,
    roomId: subjectType === 'ROOM' ? 'room-1' : null,
    parkingId: subjectType === 'PARKING' ? 'park-1' : null,
    label,
  }
}

/**
 * Fixture: rel-1 fully resolved (PRIMARY FULL_PROPERTY subject + tenant +
 * rent amount). rel-2 partial (PRIMARY ROOM subject + tenant, but no term
 * version yet -> rentAmount null, a legitimate DRAFT state). rel-3 has only
 * an INCLUDED link (a parking sublease, never its primary identity) and no
 * tenant/rent amount resolved -> every field null. rel-4 has no subject link
 * at all and is absent from both the tenant-names and rent-amounts maps ->
 * every field null, no crash.
 */
function setUpRealisticFixture() {
  rentalsListByAdministration.mockResolvedValueOnce([rental('rel-1'), rental('rel-2'), rental('rel-3'), rental('rel-4')])
  subjectsListByAdministration.mockImplementation((_administrationId: string, subjectType: string) => {
    if (subjectType === 'FULL_PROPERTY') return Promise.resolve([subject('subj-full-1', 'FULL_PROPERTY', 'La Florida 101')])
    if (subjectType === 'ROOM') return Promise.resolve([subject('subj-room-1', 'ROOM', 'Habitación 2')])
    if (subjectType === 'PARKING') return Promise.resolve([subject('subj-parking-1', 'PARKING', 'P-12')])
    return Promise.resolve([])
  })
  linksListByAdministration.mockResolvedValueOnce([
    { rentalRelationshipId: 'rel-1', rentalSubjectId: 'subj-full-1', subjectRole: 'PRIMARY' },
    { rentalRelationshipId: 'rel-2', rentalSubjectId: 'subj-room-1', subjectRole: 'PRIMARY' },
    { rentalRelationshipId: 'rel-3', rentalSubjectId: 'subj-parking-1', subjectRole: 'INCLUDED' },
  ])
  listActiveTenantNamesByRelationshipIds.mockResolvedValueOnce(
    new Map([
      ['rel-1', 'María Pérez'],
      ['rel-2', 'Juan Gómez'],
    ]),
  )
  listCurrentRentAmountsByRelationshipIds.mockResolvedValueOnce(new Map([['rel-1', 1500000]]))
}

describe('useRentalIdentities', () => {
  // Several tests below deliberately leave a query disabled (e.g. a pending
  // rentals query keeps the batched tenant-names/rent-amounts queries from
  // ever firing), which would otherwise leave their queued mockResolvedValueOnce
  // unconsumed and bleed into the next test. Resetting before every test keeps
  // each test's mock setup fully self-contained.
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('resolves subjectLabel/tenantName/rentAmount per relationship, per the realistic fixture', async () => {
    setUpRealisticFixture()

    const { result } = renderHook(() => useRentalIdentities('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    expect(result.current.byRelationshipId.get('rel-1')).toEqual({
      subjectLabel: 'La Florida 101',
      tenantName: 'María Pérez',
      rentAmount: 1500000,
    })
    expect(result.current.byRelationshipId.get('rel-2')).toEqual({
      subjectLabel: 'Habitación 2',
      tenantName: 'Juan Gómez',
      rentAmount: null,
    })
  })

  it('never resolves an INCLUDED-role link as the subject label - rel-3 has no PRIMARY link, so subjectLabel is null', async () => {
    setUpRealisticFixture()

    const { result } = renderHook(() => useRentalIdentities('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    expect(result.current.byRelationshipId.get('rel-3')).toEqual({
      subjectLabel: null,
      tenantName: null,
      rentAmount: null,
    })
  })

  it('leaves a relationship absent from the tenant-names/rent-amounts maps with null fields, not a crash', async () => {
    setUpRealisticFixture()

    const { result } = renderHook(() => useRentalIdentities('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    expect(result.current.byRelationshipId.get('rel-4')).toEqual({
      subjectLabel: null,
      tenantName: null,
      rentAmount: null,
    })
  })

  it('reaches "ready" with an empty Map for an administration with zero rentals, without ever calling the batched reads over a non-empty id list', async () => {
    rentalsListByAdministration.mockResolvedValueOnce([])
    subjectsListByAdministration.mockResolvedValue([])
    linksListByAdministration.mockResolvedValueOnce([])
    listActiveTenantNamesByRelationshipIds.mockResolvedValueOnce(new Map())
    listCurrentRentAmountsByRelationshipIds.mockResolvedValueOnce(new Map())

    const { result } = renderHook(() => useRentalIdentities('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    expect(result.current.byRelationshipId.size).toBe(0)
    expect(listActiveTenantNamesByRelationshipIds).toHaveBeenCalledWith([])
    expect(listCurrentRentAmountsByRelationshipIds).toHaveBeenCalledWith([])
  })

  it('reports status "loading" while any dependency query is still pending', () => {
    rentalsListByAdministration.mockReturnValueOnce(new Promise(() => {}))
    subjectsListByAdministration.mockResolvedValue([])
    linksListByAdministration.mockResolvedValueOnce([])
    listActiveTenantNamesByRelationshipIds.mockResolvedValueOnce(new Map())
    listCurrentRentAmountsByRelationshipIds.mockResolvedValueOnce(new Map())

    const { result } = renderHook(() => useRentalIdentities('admin-1'), { wrapper })

    expect(result.current.status).toBe('loading')
    expect(result.current.byRelationshipId.size).toBe(0)
  })

  it('reports status "loading" while the batched tenant-names/rent-amounts reads are still pending, even after rentals resolved', async () => {
    rentalsListByAdministration.mockResolvedValueOnce([rental('rel-1')])
    subjectsListByAdministration.mockResolvedValue([])
    linksListByAdministration.mockResolvedValueOnce([])
    listActiveTenantNamesByRelationshipIds.mockReturnValueOnce(new Promise(() => {}))
    listCurrentRentAmountsByRelationshipIds.mockResolvedValueOnce(new Map())

    const { result } = renderHook(() => useRentalIdentities('admin-1'), { wrapper })

    await waitFor(() => {
      expect(linksListByAdministration).toHaveBeenCalled()
    })
    expect(result.current.status).toBe('loading')
  })

  it('reports status "error" if any dependency query fails', async () => {
    rentalsListByAdministration.mockRejectedValueOnce(new Error('boom'))
    subjectsListByAdministration.mockResolvedValue([])
    linksListByAdministration.mockResolvedValueOnce([])
    listActiveTenantNamesByRelationshipIds.mockResolvedValueOnce(new Map())
    listCurrentRentAmountsByRelationshipIds.mockResolvedValueOnce(new Map())

    const { result } = renderHook(() => useRentalIdentities('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
    expect(result.current.byRelationshipId.size).toBe(0)
  })

  it('reports status "error" if the new batched rent-amounts read fails', async () => {
    rentalsListByAdministration.mockResolvedValueOnce([rental('rel-1')])
    subjectsListByAdministration.mockResolvedValue([])
    linksListByAdministration.mockResolvedValueOnce([])
    listActiveTenantNamesByRelationshipIds.mockResolvedValueOnce(new Map())
    listCurrentRentAmountsByRelationshipIds.mockRejectedValueOnce(new Error('boom'))

    const { result } = renderHook(() => useRentalIdentities('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
  })
})

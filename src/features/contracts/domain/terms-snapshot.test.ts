import { describe, expect, it } from 'vitest'
import type { RentalTermVersion } from '@/features/rentals/domain/rental-terms.types'
import type { RentalRelationship } from '@/features/rentals/domain/rental.types'
import { buildTermsSnapshot } from './terms-snapshot'

const RELATIONSHIP: RentalRelationship = {
  id: 'rel-1',
  administrationId: 'admin-1',
  status: 'ACTIVE',
  jurisdictionCountry: 'CO',
  realStartDate: '2026-01-01',
  trackingStartDate: '2026-01-05',
  expectedEndDate: '2027-01-01',
  actualEndDate: null,
  paymentDay: 5,
  paymentTiming: 'ADVANCE',
}

const TERM_VERSION: RentalTermVersion = {
  id: 'term-1',
  rentalRelationshipId: 'rel-1',
  versionNumber: 1,
  effectiveFrom: '2026-01-01',
  effectiveUntil: null,
  rentAmount: 1_500_000,
  administrationMode: 'INCLUDED',
  utilitiesMode: 'TENANT',
  createdAt: '2026-01-01T00:00:00Z',
}

describe('buildTermsSnapshot', () => {
  it('maps the exact documented fields from the relationship and term version', () => {
    const result = buildTermsSnapshot(RELATIONSHIP, TERM_VERSION)

    expect(result).toEqual({
      rentAmount: 1_500_000,
      administrationMode: 'INCLUDED',
      utilitiesMode: 'TENANT',
      effectiveFrom: '2026-01-01',
      realStartDate: '2026-01-01',
      trackingStartDate: '2026-01-05',
      paymentDay: 5,
      paymentTiming: 'ADVANCE',
      expectedEndDate: '2027-01-01',
    })
  })

  it('produces exactly the documented key set, no extra/invented fields', () => {
    const result = buildTermsSnapshot(RELATIONSHIP, TERM_VERSION)

    expect(Object.keys(result).sort()).toEqual(
      [
        'rentAmount',
        'administrationMode',
        'utilitiesMode',
        'effectiveFrom',
        'realStartDate',
        'trackingStartDate',
        'paymentDay',
        'paymentTiming',
        'expectedEndDate',
      ].sort(),
    )
  })

  it('preserves a null utilitiesMode and a null expectedEndDate exactly, without inventing values', () => {
    const result = buildTermsSnapshot(RELATIONSHIP, { ...TERM_VERSION, utilitiesMode: null })

    expect(result.utilitiesMode).toBeNull()

    const resultNoEnd = buildTermsSnapshot({ ...RELATIONSHIP, expectedEndDate: null }, TERM_VERSION)
    expect(resultNoEnd.expectedEndDate).toBeNull()
  })

  it('throws if the relationship is missing a required schedule field (broken ACTIVE/ENDING invariant)', () => {
    expect(() => buildTermsSnapshot({ ...RELATIONSHIP, realStartDate: null }, TERM_VERSION)).toThrow()
    expect(() => buildTermsSnapshot({ ...RELATIONSHIP, trackingStartDate: null }, TERM_VERSION)).toThrow()
    expect(() => buildTermsSnapshot({ ...RELATIONSHIP, paymentDay: null }, TERM_VERSION)).toThrow()
    expect(() => buildTermsSnapshot({ ...RELATIONSHIP, paymentTiming: null }, TERM_VERSION)).toThrow()
  })
})

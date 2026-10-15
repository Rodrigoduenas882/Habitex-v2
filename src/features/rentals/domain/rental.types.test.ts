import { describe, expect, it } from 'vitest'
import { activeRelationshipCount, type RentalRelationship } from './rental.types'

function rental(status: RentalRelationship['status']): RentalRelationship {
  return {
    id: `rental-${status}`,
    administrationId: 'admin-1',
    status,
    jurisdictionCountry: 'CO',
    realStartDate: null,
    trackingStartDate: null,
    expectedEndDate: null,
    actualEndDate: null,
    paymentDay: null,
    paymentTiming: null,
  }
}

describe('activeRelationshipCount', () => {
  it('counts ACTIVE and ENDING, never DRAFT/ENDED/CANCELLED', () => {
    const rentals = [
      rental('DRAFT'),
      rental('ACTIVE'),
      rental('ACTIVE'),
      rental('ENDING'),
      rental('ENDED'),
      rental('CANCELLED'),
    ]

    expect(activeRelationshipCount(rentals)).toBe(3)
  })

  it('returns 0 for an empty list', () => {
    expect(activeRelationshipCount([])).toBe(0)
  })

  it('returns 0 when none of the rentals are ACTIVE/ENDING', () => {
    expect(activeRelationshipCount([rental('DRAFT'), rental('ENDED'), rental('CANCELLED')])).toBe(0)
  })
})

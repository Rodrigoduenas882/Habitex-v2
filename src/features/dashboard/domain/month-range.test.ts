import { describe, expect, it } from 'vitest'
import { currentMonthRange, lastNMonthRanges } from './month-range'

describe('currentMonthRange', () => {
  it('resolves the full month for a date mid-month', () => {
    // 2026-09-15 (local) - September, not a boundary day.
    const result = currentMonthRange(new Date(2026, 8, 15))

    expect(result).toEqual({ label: 'Sep', from: '2026-09-01', toExclusive: '2026-10-01' })
  })

  it('resolves the full month for the 1st of a month', () => {
    const result = currentMonthRange(new Date(2026, 8, 1))

    expect(result).toEqual({ label: 'Sep', from: '2026-09-01', toExclusive: '2026-10-01' })
  })

  it('resolves the full month for the last day of a month, correctly rolling into the next year (December 31 -> January of the next year)', () => {
    const result = currentMonthRange(new Date(2026, 11, 31))

    expect(result).toEqual({ label: 'Dic', from: '2026-12-01', toExclusive: '2027-01-01' })
  })

  it('never produces a UTC-shifted date near local midnight (uses Date field getters, not toISOString)', () => {
    // A local-time construction at 00:00 - if this were ever formatted via
    // toISOString() (which converts to UTC), a positive-UTC-offset
    // timezone could shift the date backwards by a day. Using the Date's
    // own local getters (getFullYear/getMonth/getDate) avoids that.
    const result = currentMonthRange(new Date(2026, 2, 1, 0, 0, 0))

    expect(result).toEqual({ label: 'Mar', from: '2026-03-01', toExclusive: '2026-04-01' })
  })
})

describe('lastNMonthRanges', () => {
  it('returns count=6 ranges, oldest first, ending with the current month', () => {
    const result = lastNMonthRanges(6, new Date(2026, 8, 15))

    expect(result).toEqual([
      { label: 'Abr', from: '2026-04-01', toExclusive: '2026-05-01' },
      { label: 'May', from: '2026-05-01', toExclusive: '2026-06-01' },
      { label: 'Jun', from: '2026-06-01', toExclusive: '2026-07-01' },
      { label: 'Jul', from: '2026-07-01', toExclusive: '2026-08-01' },
      { label: 'Ago', from: '2026-08-01', toExclusive: '2026-09-01' },
      { label: 'Sep', from: '2026-09-01', toExclusive: '2026-10-01' },
    ])
  })

  it('crosses a year boundary correctly (now in February, 6-month window reaches back into the prior September-January)', () => {
    const result = lastNMonthRanges(6, new Date(2026, 1, 10))

    expect(result).toEqual([
      { label: 'Sep', from: '2025-09-01', toExclusive: '2025-10-01' },
      { label: 'Oct', from: '2025-10-01', toExclusive: '2025-11-01' },
      { label: 'Nov', from: '2025-11-01', toExclusive: '2025-12-01' },
      { label: 'Dic', from: '2025-12-01', toExclusive: '2026-01-01' },
      { label: 'Ene', from: '2026-01-01', toExclusive: '2026-02-01' },
      { label: 'Feb', from: '2026-02-01', toExclusive: '2026-03-01' },
    ])
  })

  it('returns exactly one range (the current month only) for count=1', () => {
    const result = lastNMonthRanges(1, new Date(2026, 8, 15))

    expect(result).toEqual([{ label: 'Sep', from: '2026-09-01', toExclusive: '2026-10-01' }])
  })
})

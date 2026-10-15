import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import type { Charge, ChargeType } from '@/features/charges/domain/charge.types'
import { currentMonthRange, lastNMonthRanges } from '../domain/month-range'
import { useDashboardFinancials } from './useDashboardFinancials'

const { listByAdministration } = vi.hoisted(() => ({ listByAdministration: vi.fn() }))

vi.mock('@/features/charges/infrastructure/supabase-charge.repository', () => ({
  supabaseChargeRepository: { listByAdministration },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

let chargeCounter = 0

interface ChargeFixtureInput {
  chargeType: ChargeType
  dueDate: string
  paidAmount: number
  balance: number
}

function charge(input: ChargeFixtureInput): Charge {
  chargeCounter += 1
  return {
    id: `charge-${chargeCounter.toString()}`,
    administrationId: 'admin-1',
    rentalRelationshipId: 'rel-1',
    chargeType: input.chargeType,
    origin: 'SYSTEM',
    description: 'Renta',
    periodStart: null,
    periodEnd: null,
    dueDate: input.dueDate,
    amount: input.paidAmount + input.balance,
    currency: 'COP',
    sourceType: null,
    sourceId: null,
    createdAt: '2026-01-01T00:00:00Z',
    paidAmount: input.paidAmount,
    balance: input.balance,
    financialStatus: input.balance === 0 ? 'PAID' : 'PARTIAL',
  }
}

describe('useDashboardFinancials', () => {
  it('computes monthlyReceivable/monthlyIncome (current month, RENT only) and the 6-month income series exactly', async () => {
    const monthRanges = lastNMonthRanges(6)
    const current = currentMonthRange()
    const oldestRange = monthRanges[0]
    const middleRange = monthRanges[2]
    if (!oldestRange || !middleRange) {
      throw new Error('test setup: expected at least 3 month ranges')
    }

    const currentMonthRentCharge = charge({ chargeType: 'RENT', dueDate: current.from, paidAmount: 400_000, balance: 600_000 })
    const currentMonthUtilityCharge = charge({ chargeType: 'UTILITY', dueDate: current.from, paidAmount: 999_999, balance: 1 })
    const middleMonthRentCharge = charge({ chargeType: 'RENT', dueDate: middleRange.from, paidAmount: 200_000, balance: 0 })
    const oldestMonthRentCharge = charge({ chargeType: 'RENT', dueDate: oldestRange.from, paidAmount: 100_000, balance: 0 })

    listByAdministration.mockResolvedValueOnce([
      currentMonthRentCharge,
      currentMonthUtilityCharge,
      middleMonthRentCharge,
      oldestMonthRentCharge,
    ])

    const { result } = renderHook(() => useDashboardFinancials('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    expect(result.current.monthlyReceivable).toBe(600_000)
    expect(result.current.monthlyIncome).toBe(400_000)

    expect(result.current.monthlySeries).toHaveLength(6)
    expect(result.current.monthlySeries[0]).toEqual({ label: oldestRange.label, income: 100_000 })
    expect(result.current.monthlySeries[2]).toEqual({ label: middleRange.label, income: 200_000 })
    expect(result.current.monthlySeries[5]).toEqual({ label: current.label, income: 400_000 })
    // Untouched months carry 0, not undefined/omitted.
    expect(result.current.monthlySeries[1]?.income).toBe(0)
    expect(result.current.monthlySeries[3]?.income).toBe(0)
    expect(result.current.monthlySeries[4]?.income).toBe(0)
  })

  it('excludes non-RENT charge types (ADMINISTRATION/UTILITY/OTHER) from every computed field', async () => {
    const current = currentMonthRange()
    listByAdministration.mockResolvedValueOnce([
      charge({ chargeType: 'ADMINISTRATION', dueDate: current.from, paidAmount: 500_000, balance: 0 }),
      charge({ chargeType: 'UTILITY', dueDate: current.from, paidAmount: 500_000, balance: 0 }),
      charge({ chargeType: 'OTHER', dueDate: current.from, paidAmount: 500_000, balance: 0 }),
    ])

    const { result } = renderHook(() => useDashboardFinancials('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    expect(result.current.monthlyReceivable).toBe(0)
    expect(result.current.monthlyIncome).toBe(0)
    expect(result.current.monthlySeries.every((month) => month.income === 0)).toBe(true)
  })

  it('reports status "loading" while the underlying charges query is still pending', () => {
    listByAdministration.mockReturnValueOnce(new Promise(() => {}))

    const { result } = renderHook(() => useDashboardFinancials('admin-1'), { wrapper })

    expect(result.current.status).toBe('loading')
  })

  it('reports status "error" if the underlying charges query fails', async () => {
    listByAdministration.mockRejectedValueOnce(new Error('boom'))

    const { result } = renderHook(() => useDashboardFinancials('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
  })
})

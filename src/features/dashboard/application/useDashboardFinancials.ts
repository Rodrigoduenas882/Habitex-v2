import { useMemo } from 'react'
import { useAdministrationCharges } from '@/features/charges/application/useAdministrationCharges'
import { currentMonthRange, lastNMonthRanges, type MonthRange } from '../domain/month-range'

export interface DashboardFinancialMonth {
  label: string
  income: number
}

export interface DashboardFinancials {
  status: 'loading' | 'error' | 'ready'
  /** Sum of `balance` (amount - paidAmount) for this month's RENT charges - outstanding, not gross. */
  monthlyReceivable: number
  /** Sum of `paidAmount` for this month's RENT charges - already CONFIRMED-only via charge_balances. */
  monthlyIncome: number
  /** Last 6 months, income (paidAmount sum) only - no "expenses" concept exists anywhere in the deployed schema. */
  monthlySeries: DashboardFinancialMonth[]
}

const LOADING: DashboardFinancials = { status: 'loading', monthlyReceivable: 0, monthlyIncome: 0, monthlySeries: [] }
const ERROR: DashboardFinancials = { status: 'error', monthlyReceivable: 0, monthlyIncome: 0, monthlySeries: [] }

const SERIES_MONTH_COUNT = 6

function isWithinRange(dueDate: string, range: MonthRange): boolean {
  return dueDate >= range.from && dueDate < range.toExclusive
}

/**
 * Computes the Dashboard's financial KPIs + 6-month income series, per the
 * task's exact framing: "the current month's expected rent". Filters to
 * chargeType === 'RENT' only - never ADMINISTRATION/UTILITY/OTHER, even
 * though no existing flow creates those today.
 *
 * Data flow: fetches every RENT-relevant charge across the full 6-month span
 * in a single useAdministrationCharges call (earliest `from` of
 * lastNMonthRanges(6) through the latest `toExclusive`, which is also
 * currentMonthRange()'s own toExclusive) - one network round trip, not one
 * per month. Charges are then bucketed client-side into each month's own
 * `[from, toExclusive)` window by comparing `dueDate` (never re-fetched per
 * month, never re-derived from raw payments/allocations - paidAmount/balance
 * always come from the already-merged charge_balances fields the repository
 * provides).
 */
export function useDashboardFinancials(administrationId: string | undefined): DashboardFinancials {
  const monthRanges = useMemo(() => lastNMonthRanges(SERIES_MONTH_COUNT), [])
  const current = useMemo(() => currentMonthRange(), [])

  const firstRange = monthRanges[0]
  const spanRange = useMemo(
    () => (firstRange ? { from: firstRange.from, toExclusive: current.toExclusive } : undefined),
    [firstRange, current],
  )

  const chargesQuery = useAdministrationCharges(administrationId, spanRange)

  const isError = chargesQuery.isError
  const isSuccess = chargesQuery.isSuccess
  const charges = chargesQuery.data

  return useMemo(() => {
    if (isError) {
      return ERROR
    }

    if (!isSuccess || !charges) {
      return LOADING
    }

    const rentCharges = charges.filter((charge) => charge.chargeType === 'RENT')

    const currentMonthCharges = rentCharges.filter((charge) => isWithinRange(charge.dueDate, current))
    const monthlyReceivable = currentMonthCharges.reduce((sum, charge) => sum + charge.balance, 0)
    const monthlyIncome = currentMonthCharges.reduce((sum, charge) => sum + charge.paidAmount, 0)

    const monthlySeries: DashboardFinancialMonth[] = monthRanges.map((range) => ({
      label: range.label,
      income: rentCharges
        .filter((charge) => isWithinRange(charge.dueDate, range))
        .reduce((sum, charge) => sum + charge.paidAmount, 0),
    }))

    return {
      status: 'ready',
      monthlyReceivable,
      monthlyIncome,
      monthlySeries,
    }
  }, [isError, isSuccess, charges, current, monthRanges])
}

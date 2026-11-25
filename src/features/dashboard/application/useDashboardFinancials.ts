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
  /**
   * Sum of `paidAmount` for RENT charges whose `dueDate` falls in the
   * CURRENT calendar month - already CONFIRMED-only via charge_balances.
   *
   * IMPORTANT, not cash-received-this-month: this groups by the charge's
   * `dueDate`, never by when a payment was actually confirmed. A charge due
   * this month that was paid in advance last month (ADVANCE paymentTiming)
   * contributes its full paidAmount here even though the cash arrived
   * earlier; a charge due this month that gets paid next month (ARREARS,
   * paid late) will NOT appear in this month's figure at all - it shows up
   * in the month it was due, once paid, regardless of which month the
   * payment itself lands in. "Cobrado este mes" therefore means "lo ya
   * pagado de los cargos que vencieron este mes", not "efectivo que entró
   * a la cuenta este mes". No existing UI copy currently disambiguates
   * this - flagged for product/copy review, not changed here (INC-DASH-02
   * was explicitly told not to alter existing financial rules without
   * separate authorization).
   */
  monthlyIncome: number
  /**
   * Sum of `balance` for RENT charges with `financialStatus === 'OVERDUE'`
   * (authoritative from charge_balances, never inferred from dates here)
   * whose `dueDate` falls anywhere in the full 6-month window below - NOT
   * current-month-only, unlike monthlyReceivable/monthlyIncome above. An
   * overdue charge from 3 months ago is still real, outstanding arrears
   * today; limiting this to the current month would silently hide it.
   * Deliberately NOT mutually exclusive with monthlyReceivable: a RENT
   * charge due THIS month that is already OVERDUE counts in both - they are
   * two different lenses (everything outstanding this month vs. the
   * overdue subset, which also reaches back further) - never sum the two as
   * if they were disjoint categories.
   */
  overdueAmount: number
  /** Last 6 months, income (paidAmount sum) only - no "expenses" concept exists anywhere in the deployed schema. */
  monthlySeries: DashboardFinancialMonth[]
}

const LOADING: DashboardFinancials = { status: 'loading', monthlyReceivable: 0, monthlyIncome: 0, overdueAmount: 0, monthlySeries: [] }
const ERROR: DashboardFinancials = { status: 'error', monthlyReceivable: 0, monthlyIncome: 0, overdueAmount: 0, monthlySeries: [] }

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
 *
 * INC-DASH-02 added `overdueAmount` (see its own doc comment on
 * DashboardFinancials) by filtering/summing this SAME already-fetched
 * `rentCharges` array - no new query, no new repository call. The span this
 * hook already fetches (6 months through the end of the current month) is
 * exactly the window `overdueAmount` needs.
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
    const overdueAmount = rentCharges
      .filter((charge) => charge.financialStatus === 'OVERDUE')
      .reduce((sum, charge) => sum + charge.balance, 0)

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
      overdueAmount,
      monthlySeries,
    }
  }, [isError, isSuccess, charges, current, monthRanges])
}

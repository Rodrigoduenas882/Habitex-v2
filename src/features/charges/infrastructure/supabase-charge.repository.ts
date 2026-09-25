import { supabaseClient } from '@/infrastructure/supabase/client'
import {
  ChargeRepositoryError,
  type Charge,
  type ChargeErrorCode,
  type ChargeFinancialStatus,
  type ChargeOrigin,
  type ChargeRepository,
  type ChargeType,
} from '../domain/charge.types'

interface ChargeRow {
  id: string
  administration_id: string
  rental_relationship_id: string
  charge_type: ChargeType
  origin: ChargeOrigin
  description: string
  period_start: string | null
  period_end: string | null
  due_date: string
  amount: number
  currency: 'COP'
  source_type: string | null
  source_id: string | null
  created_at: string
}

interface ChargeBalanceRow {
  charge_id: string
  administration_id: string
  rental_relationship_id: string
  amount: number
  paid_amount: number
  balance: number
  financial_status: ChargeFinancialStatus
}

const CHARGE_COLUMNS =
  'id, administration_id, rental_relationship_id, charge_type, origin, description, period_start, period_end, due_date, amount, currency, source_type, source_id, created_at'

const CHARGE_BALANCE_COLUMNS = 'charge_id, administration_id, rental_relationship_id, amount, paid_amount, balance, financial_status'

/**
 * Merges a charges row with its charge_balances row. A missing balance row
 * should never actually happen - charge_balances is a LEFT JOIN from
 * charges, so it always has exactly one row per charge - but the fallback
 * below (0 paid, full amount outstanding, PENDING) is a defensive last
 * resort, not a real path this repository expects to exercise.
 */
function toCharge(row: ChargeRow, balance: ChargeBalanceRow | null): Charge {
  return {
    id: row.id,
    administrationId: row.administration_id,
    rentalRelationshipId: row.rental_relationship_id,
    chargeType: row.charge_type,
    origin: row.origin,
    description: row.description,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    dueDate: row.due_date,
    amount: row.amount,
    currency: row.currency,
    sourceType: row.source_type,
    sourceId: row.source_id,
    createdAt: row.created_at,
    paidAmount: balance?.paid_amount ?? 0,
    balance: balance?.balance ?? row.amount,
    financialStatus: balance?.financial_status ?? 'PENDING',
  }
}

/**
 * Translates a failed Supabase call (generate_rent_charges' RPC exception
 * string, or a plain Supabase/network failure from either SELECT) into our
 * own ChargeRepositoryError - see ChargeErrorCode's own doc comment for the
 * exact mapping.
 */
function toChargeRepositoryError(error: { message: string; code?: string }): ChargeRepositoryError {
  if (error.message === 'MANAGEMENT_ACCESS_REQUIRED') {
    return new ChargeRepositoryError('management_access_required', error)
  }

  if (error.message === 'RENTAL_NOT_CHARGEABLE') {
    return new ChargeRepositoryError('not_chargeable', error)
  }

  if (error.message === 'RENTAL_BILLING_CONFIGURATION_INCOMPLETE') {
    return new ChargeRepositoryError('billing_configuration_incomplete', error)
  }

  const unknownCode: ChargeErrorCode = 'unknown'
  return new ChargeRepositoryError(unknownCode, error)
}

export const supabaseChargeRepository: ChargeRepository = {
  async listByRelationship(rentalRelationshipId: string): Promise<Charge[]> {
    // charges and charge_balances have no FK relationship registered for
    // PostgREST embedding - two separate SELECTs, both scoped by
    // rental_relationship_id, merged here by id/charge_id. Never computed
    // locally: paid/balance/status always come from charge_balances (RLS on
    // charges - charges_select - remains the real authority for scope).
    const [chargesResponse, balancesResponse] = await Promise.all([
      supabaseClient
        .from('charges')
        .select(CHARGE_COLUMNS)
        .eq('rental_relationship_id', rentalRelationshipId)
        .order('due_date', { ascending: true }),
      supabaseClient.from('charge_balances').select(CHARGE_BALANCE_COLUMNS).eq('rental_relationship_id', rentalRelationshipId),
    ])

    if (chargesResponse.error) {
      throw toChargeRepositoryError(chargesResponse.error)
    }

    if (balancesResponse.error) {
      throw toChargeRepositoryError(balancesResponse.error)
    }

    const balanceByChargeId = new Map(
      (balancesResponse.data as ChargeBalanceRow[]).map((row) => [row.charge_id, row] as const),
    )

    return (chargesResponse.data as ChargeRow[]).map((row) => toCharge(row, balanceByChargeId.get(row.id) ?? null))
  },

  async generateRentCharges(rentalRelationshipId: string): Promise<{ createdCount: number }> {
    // can_manage_administration()/status/billing-configuration checks all
    // happen inside the RPC (SECURITY DEFINER). Called with only
    // p_relationship_id - p_through_date is never sent from here, so the
    // RPC's own DEFAULT CURRENT_DATE applies. No period/month/rent-amount/
    // term-version computation exists in this frontend; response.data is
    // the array of newly-created charges for this call only, and its
    // length (possibly 0, a normal outcome) is the created count.
    const response = await supabaseClient.rpc('generate_rent_charges', {
      p_relationship_id: rentalRelationshipId,
    })

    if (response.error) {
      throw toChargeRepositoryError(response.error)
    }

    const createdRows = (response.data as ChargeRow[] | null) ?? []
    return { createdCount: createdRows.length }
  },
}

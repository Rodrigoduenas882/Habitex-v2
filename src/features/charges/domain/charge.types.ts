/** charge_type, confirmed against the deployed schema (public.charges). */
export type ChargeType = 'RENT' | 'ADMINISTRATION' | 'UTILITY' | 'OTHER'

/** charge_origin, confirmed against the deployed schema (public.charges). */
export type ChargeOrigin = 'SYSTEM' | 'MANUAL' | 'UTILITY_ALLOCATION'

/**
 * financial_status, confirmed against the deployed public.charge_balances
 * view - never computed in this frontend (see ChargeRepository's own doc
 * comment).
 */
export type ChargeFinancialStatus = 'PENDING' | 'OVERDUE' | 'PARTIAL' | 'PAID'

/**
 * A public.charges row merged with its public.charge_balances row, mirrored
 * into camelCase domain shape. paidAmount/balance/financialStatus come
 * exclusively from charge_balances (a security_invoker view, the sole
 * source of truth for paid/balance/status) - see
 * ChargeRepository.listByRelationship's own doc comment for how the merge
 * happens, since there is no FK relationship registered between the two for
 * PostgREST embedding.
 */
export interface Charge {
  id: string
  administrationId: string
  rentalRelationshipId: string
  chargeType: ChargeType
  origin: ChargeOrigin
  description: string
  periodStart: string | null
  periodEnd: string | null
  dueDate: string
  amount: number
  currency: 'COP'
  sourceType: string | null
  sourceId: string | null
  createdAt: string
  paidAmount: number
  balance: number
  financialStatus: ChargeFinancialStatus
}

/**
 * Known, user-facing generate_rent_charges failure categories -
 * deliberately coarse, mirroring RentalLifecycleErrorCode/
 * ContractErrorCode's shape (see toChargeRepositoryError's own doc comment
 * for the exact mapping):
 *
 * - 'management_access_required' <- MANAGEMENT_ACCESS_REQUIRED.
 * - 'not_chargeable' <- RENTAL_NOT_CHARGEABLE (status not in
 *   ACTIVE/ENDING/ENDED).
 * - 'billing_configuration_incomplete' <-
 *   RENTAL_BILLING_CONFIGURATION_INCOMPLETE (tracking_start_date/
 *   payment_day null).
 * - 'unknown' <- everything else, including RENTAL_RELATIONSHIP_NOT_FOUND -
 *   unreachable through this frontend's own flows (every relationshipId
 *   passed here comes from a row already read via useRentals), so it stays
 *   unmapped rather than getting a speculative dedicated code.
 */
export type ChargeErrorCode =
  | 'management_access_required'
  | 'not_chargeable'
  | 'billing_configuration_incomplete'
  | 'unknown'

export class ChargeRepositoryError extends Error {
  readonly code: ChargeErrorCode

  constructor(code: ChargeErrorCode, cause?: unknown) {
    super(`Charge repository error: ${code}`)
    this.name = 'ChargeRepositoryError'
    this.code = code
    this.cause = cause
  }
}

/**
 * public.charges (+ public.charge_balances) port, read-only in this
 * increment plus the one RPC that creates RENT charges:
 *
 * - listByRelationship: two separate SELECTs (charges + charge_balances),
 *   both scoped by rental_relationship_id, merged by id/charge_id in the
 *   adapter - never in application/presentation. RLS (charges_select) is
 *   the real authority (can_view_relationship) - this filter expresses
 *   scope, not security. No manual charge creation/edit/delete/void exists
 *   anywhere in this port - out of scope for this increment (see this
 *   feature's own scope notes).
 *
 * - generateRentCharges: generate_rent_charges RPC (SECURITY DEFINER),
 *   called with only the relationship id so the RPC's own
 *   DEFAULT CURRENT_DATE applies to p_through_date - never sent from here,
 *   same principle as end_rental's omitted p_actual_end_date. Idempotent
 *   (unique index + ON CONFLICT DO NOTHING) - a zero-row result is a normal,
 *   successful outcome ("nothing new to generate"), not an error.
 */
export interface ChargeRepository {
  listByRelationship(rentalRelationshipId: string): Promise<Charge[]>
  generateRentCharges(rentalRelationshipId: string): Promise<{ createdCount: number }>
}

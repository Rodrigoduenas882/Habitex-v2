import { createClient } from '@supabase/supabase-js'
import { expect, type Page } from '@playwright/test'
import type { DisposableStack } from './habitex-ui-flows.js'

// Rental lifecycle (cancel_draft_rental / start_ending_rental / end_rental)
// real-UI flows for scenario #6. Kept separate from the other support files
// - same precedent as habitex-contracts-flows.ts's/habitex-charges-payments-flows.ts's
// own header comments on when shared extraction is warranted versus
// premature. All three transitions are RPC-only - RLS
// (rental_relationships_update_draft) blocks any direct client UPDATE from
// ever changing status outside DRAFT, so there is no raw-UPDATE fallback to
// special-case here (unlike contracts' markShared/terminate).

/** A date `days` in the past, in UTC (matches Postgres' own `current_date`
 * reference - see habitex-charges-payments-flows.ts's own
 * firstOfCurrentMonthISO doc comment for why UTC matters here). Used as
 * realStartDate so end_rental's own `p_actual_end_date >= real_start_date`
 * precondition is satisfied regardless of when this suite actually runs. */
export function daysAgoISO(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/** A date `days` in the future, in UTC - used as a deliberately-invalid
 * realStartDate so end_rental's own current-date default is guaranteed to
 * be earlier than it, reliably reproducing END_BEFORE_START without ever
 * touching the system clock. */
export function daysFromNowISO(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** "Cancelar" (cancel_draft_rental) - two-step confirmation
 * (LifecycleConfirmAction's own doc comment: the first click only flips
 * local UI state, "Confirmar cancelación" is the real action). */
export async function cancelDraft(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar cancelación', exact: true }).click()
}

/** "Iniciar cierre" (start_ending_rental) - a single click, deliberately NOT
 * a two-step confirmation (verified against RentalListCard.tsx: this is the
 * only lifecycle action rendered as a plain Button, not via
 * LifecycleConfirmAction). */
export async function startEndingRental(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Iniciar cierre', exact: true }).click()
}

/** "Terminar arriendo" (end_rental) - two-step confirmation, same pattern as
 * cancelDraft. Always invoked with only the relationship id (no date), so
 * the RPC's own DEFAULT CURRENT_DATE applies - matching useEndRental's own
 * real call shape. */
export async function endRental(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Terminar arriendo', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar terminación', exact: true }).click()
}

/**
 * Independent, read-only verification using an administrator's own real,
 * authenticated session (anon key + signInWithPassword) - never
 * service_role. Same dual-layer precedent as scenarios #3/#4/#5's own
 * readVisibleRentalRelationships/readVisibleCharges/readVisibleContracts.
 */
async function signInAsAdministrator(stack: DisposableStack, credentials: { email: string; password: string }) {
  const supabase = createClient(stack.url, stack.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const signIn = await supabase.auth.signInWithPassword(credentials)
  expect(signIn.error, signIn.error?.message).toBeNull()
  return supabase
}

/** Reads every rental relationship visible to this session (id + status) -
 * RLS (rental_relationships_select -> can_view_relationship) alone decides
 * what comes back. Used only for the isolation scenario, to prove an
 * administration with zero rentals of its own genuinely cannot see the
 * other's relationship id, not even unfiltered. */
export async function readVisibleRelationshipStatuses(
  stack: DisposableStack,
  credentials: { email: string; password: string },
): Promise<Array<{ id: string; status: string }>> {
  const supabase = await signInAsAdministrator(stack, credentials)
  const { data, error } = await supabase.from('rental_relationships').select('id, status')
  expect(error, error?.message).toBeNull()

  return (data ?? []).map((row) => ({ id: row.id as string, status: row.status as string }))
}

import { createClient } from '@supabase/supabase-js'
import { expect, type Page } from '@playwright/test'
import { expectRentalCardTenant, findRentalCard, type DisposableStack } from './habitex-ui-flows.js'

// Charges/payments-specific real-UI flows for scenario #4 (financial
// ledger: charges, payments, allocations, receipts). Kept separate from
// habitex-ui-flows.ts/habitex-invitation-flows.ts (used only by this
// scenario's own spec file) - same precedent as habitex-invitation-flows.ts's
// own header comment on when shared extraction is warranted versus
// premature.
//
// Habitex does not custody money - it only records obligations (charges)
// and reported payments. Every financial write here goes through the real
// UI (report_payment/confirm_payment/reject_payment/allocate_payment/
// issue_receipt/generate_rent_charges), never a direct insert/RPC call,
// never service_role. The only direct Supabase reads below are read-only
// (anon key + a real administrator's own signInWithPassword session), used
// exclusively to prove RLS itself for the isolation scenario, where no UI
// exposes a stranger's raw relationship id to navigate to.

/** Mirrors RentalChargesPage.tsx's/RentalPaymentsPage.tsx's own formatAmount
 * exactly (`$${new Intl.NumberFormat('es-CO').format(value)}`) - used to
 * build precise, source-grounded assertions rather than guessing the
 * rendered string. */
export function formatAmountCOP(value: number): string {
  return `$${new Intl.NumberFormat('es-CO').format(value)}`
}

/**
 * The first day of the REAL current month (read once from the real system
 * clock - never mocked/advanced, see this suite's own constraint on not
 * manipulating the clock), in UTC - independent review (MEDIUM, fixed):
 * generate_rent_charges bounds its generation loop at Postgres' own
 * `current_date`, which this project's disposable stack always evaluates in
 * UTC (verified directly against the running container: `show timezone` ->
 * `UTC`) - using the host machine's LOCAL month/year here instead would
 * disagree with the server around each UTC month boundary whenever the host
 * runs in a timezone behind UTC (e.g. the last few hours of a month in
 * America/Bogota, UTC-5), producing 2 charges instead of the 1 every
 * assertion in this suite expects. `getUTCFullYear()`/`getUTCMonth()` keep
 * this in agreement with the server regardless of the host's own timezone.
 * Used as realStartDate (and, via completeRentalTerms's own existing
 * behavior, trackingStartDate too - it fills both fields with the same
 * value) so generate_rent_charges produces EXACTLY one RENT charge:
 * unambiguous to select in the UI without needing to disambiguate by
 * period. Never hardcodes a calendar year, so this suite stays valid
 * regardless of when it actually runs.
 */
export function firstOfCurrentMonthISO(): string {
  const now = new Date()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${now.getUTCFullYear()}-${month}-01`
}

/** The real, current date (read once, never mocked), in UTC via
 * toISOString() - already in agreement with Postgres' own `current_date`
 * (see firstOfCurrentMonthISO's own doc comment on why UTC matters here).
 * Used as payment_date for reported payments, always valid since
 * report_payment places no constraint on it besides existing. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Navigates to a rental's "Cargos"/"Pagos" sub-page through the REAL list
 * (RentalListCard's own "Cargos"/"Pagos" buttons, visible only once
 * ACTIVE/ENDING/ENDED - see that component's own doc comment), always
 * starting fresh from /rentals so this can be called repeatedly to bounce
 * between sections within one test without ever needing to know the
 * relationship's raw id.
 */
export async function goToRentalSection(
  page: Page,
  { propertyName, tenantName, section }: { propertyName: string; tenantName: string; section: 'Cargos' | 'Pagos' },
): Promise<void> {
  await page.goto('/rentals')
  const card = findRentalCard(page, propertyName, tenantName)
  await expectRentalCardTenant(card, tenantName)
  await card.getByRole('button', { name: section }).click()
  await page.waitForURL(section === 'Cargos' ? '**/charges' : '**/payments')
}

/** "Reportar un pago" (report_payment) - fills only the required fields
 * (amount, date); method/reference/notes/proof are all optional and left
 * unset, keeping this scenario's scope to the fields the backend actually
 * requires. Waits for the form's own success signal: PaymentReportForm
 * resets its fields on a successful report_payment (see that component's
 * own onSubmit), the clearest UI-driven signal available without a
 * dedicated test-id. */
export async function reportPayment(page: Page, { amount, paymentDate }: { amount: string; paymentDate: string }): Promise<void> {
  await page.getByLabel('Valor pagado').fill(amount)
  await page.getByLabel('Fecha de pago').fill(paymentDate)
  await page.getByRole('button', { name: 'Reportar pago' }).click()
  await expect(page.getByLabel('Valor pagado')).toHaveValue('')
}

/** "Confirmar pago" (confirm_payment) - single click, no confirmation step. */
export async function confirmPayment(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Confirmar pago' }).click()
}

/** "Rechazar pago" (reject_payment) - two-step confirmation
 * (RejectPaymentAction's own doc comment): the first click only flips local
 * UI state, the second ("Confirmar rechazo") actually calls the RPC. */
export async function rejectPayment(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Rechazar pago' }).click()
  await page.getByRole('button', { name: 'Confirmar rechazo' }).click()
}

/**
 * "Aplicar a cargos" (allocate_payment) against the SOLE eligible charge
 * currently offered by the "Cargo" select - selects it by index (1, since
 * index 0 is the placeholder option) rather than by label text, since this
 * scenario's scope only ever has exactly one eligible charge at a time, so
 * no further disambiguation is needed.
 */
export async function allocatePaymentToSoleCharge(page: Page, amount: string): Promise<void> {
  await page.getByRole('button', { name: 'Aplicar a cargos' }).click()
  await page.getByLabel('Cargo').selectOption({ index: 1 })
  await page.getByLabel('Valor a aplicar').fill(amount)
  await page.getByRole('button', { name: 'Aplicar' }).click()
}

/** "Emitir recibo" (issue_receipt) - only reachable once the payment has at
 * least one allocation (see PaymentReceiptSummary's own doc comment). */
export async function issueReceipt(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Emitir recibo' }).click()
}

/**
 * Independent, read-only verification using an administrator's own real,
 * authenticated session (anon key + signInWithPassword) - never
 * service_role. Used only for scenario #4's isolation check (D): reading
 * `charges`/`payments` directly proves RLS itself (charges_select/
 * payments_select -> can_view_relationship), not just a frontend UX
 * side-effect - same dual-layer precedent as scenario #3's
 * readOwnAccountLink/readVisibleRentalRelationships.
 */
async function signInAsAdministrator(stack: DisposableStack, credentials: { email: string; password: string }) {
  const supabase = createClient(stack.url, stack.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const signIn = await supabase.auth.signInWithPassword(credentials)
  expect(signIn.error, signIn.error?.message).toBeNull()
  return supabase
}

export async function readVisibleCharges(
  stack: DisposableStack,
  credentials: { email: string; password: string },
): Promise<Array<{ id: string; rentalRelationshipId: string }>> {
  const supabase = await signInAsAdministrator(stack, credentials)
  const { data, error } = await supabase.from('charges').select('id, rental_relationship_id')
  expect(error, error?.message).toBeNull()
  return (data ?? []).map((row) => ({ id: row.id as string, rentalRelationshipId: row.rental_relationship_id as string }))
}

export async function readVisiblePayments(
  stack: DisposableStack,
  credentials: { email: string; password: string },
): Promise<Array<{ id: string; rentalRelationshipId: string }>> {
  const supabase = await signInAsAdministrator(stack, credentials)
  const { data, error } = await supabase.from('payments').select('id, rental_relationship_id')
  expect(error, error?.message).toBeNull()
  return (data ?? []).map((row) => ({ id: row.id as string, rentalRelationshipId: row.rental_relationship_id as string }))
}

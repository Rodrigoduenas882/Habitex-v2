import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import {
  callReportPayment,
  callReportPaymentTwiceConcurrently,
  readPaymentsForRelationship,
} from './support/habitex-payment-idempotency-flows.js'
import { goToRentalSection, reportPayment } from './support/habitex-charges-payments-flows.js'
import { readVisibleRentalRelationships } from './support/habitex-invitation-flows.js'
import {
  completeRentalTerms,
  createProperty,
  createRentalDraft,
  expectNoPageErrors,
  expectRentalCardTenant,
  findRentalCard,
  signUpAndBootstrap,
  verifyDisposableStack,
} from './support/habitex-ui-flows.js'

// NOT YET EXECUTED - written and ready, pending explicit authorization to
// apply supabase/migrations/20261019193705_report_payment_idempotency.sql
// to a disposable local stack. See this round's own diagnostic for why:
// the migration changes report_payment's signature, and that change has
// not been applied anywhere yet (not even the disposable stack), per an
// explicit instruction to stop and ask before doing so.
//
// report_payment idempotency (scenario #7) through a mix of the real UI
// (for the one thing a sequential human click CAN reliably reproduce - two
// genuinely separate legitimate payments) and direct, real-session RPC
// calls (for retry/concurrency/cross-administration semantics a single
// browser click cannot reproduce on demand) - see
// habitex-payment-idempotency-flows.ts's own header comment for why this
// is a deliberate, scoped exception to this suite's "business actions go
// through the UI" convention. Never service_role, never bypassing RLS -
// every call uses a real, signed-in administrator session, exactly what
// the browser's own fetch to PostgREST would send.

const stack = await verifyDisposableStack()

function uniqueRunId() {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}

/** Shared setup: a brand-new account, property, activated rental relationship.
 * Returns the credentials and the real relationship id (captured via a
 * read-only self-query - no UI exposes this raw id). */
async function setUpActivatedRental(page: import('@playwright/test').Page, runId: string) {
  const ownerEmail = `e2e-idempotency-${runId}@habitex.test`
  const ownerPassword = `Habitex-E2E-Idempotency-${runId}!`
  const propertyName = `Apartamento Idempotencia ${runId}`
  const tenantName = `Inquilino Idempotencia ${runId}`

  await signUpAndBootstrap(page, stack, { email: ownerEmail, password: ownerPassword, fullName: 'Propietaria E2E Idempotencia' })
  await createProperty(page, { name: propertyName, address: 'Calle 10 # 20-30', city: 'Bogotá' })
  await createRentalDraft(page, { propertyName, tenantName })
  await completeRentalTerms(page, {
    propertyName,
    tenantName,
    realStartDate: '2026-01-01',
    paymentDay: '5',
    rentAmount: '1500000',
  })

  const rentalCard = findRentalCard(page, propertyName, tenantName)
  await expectRentalCardTenant(rentalCard, tenantName)
  await rentalCard.getByRole('button', { name: 'Activar' }).click()
  await expect(rentalCard).toContainText('Activo')

  const credentials = { email: ownerEmail, password: ownerPassword }
  const relationships = await readVisibleRentalRelationships(stack, credentials)
  expect(relationships).toHaveLength(1)
  const relationshipId = relationships[0]?.id
  if (!relationshipId) {
    throw new Error('Expected exactly one visible rental relationship for this administration')
  }

  return { credentials, relationshipId, propertyName, tenantName }
}

test('un reintento con la misma clave e idéntico payload devuelve el mismo pago, sin duplicar', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const { credentials, relationshipId } = await setUpActivatedRental(page, uniqueRunId())
  const idempotencyKey = randomUUID()
  const paymentInput = { relationshipId, amount: 1_500_000, paymentDate: '2026-01-05', idempotencyKey }

  const first = await callReportPayment(stack, credentials, paymentInput)
  expect(first.error, first.error?.message).toBeNull()
  const firstPaymentId = (first.data as { id: string }).id

  // Exact same key AND exact same payload - the genuine "lost response, user
  // retries" case (scenarios B/E/G of the diagnostic).
  const retry = await callReportPayment(stack, credentials, paymentInput)
  expect(retry.error, retry.error?.message).toBeNull()
  expect((retry.data as { id: string }).id).toBe(firstPaymentId)

  const payments = await readPaymentsForRelationship(stack, credentials, relationshipId)
  expect(payments).toHaveLength(1)
  expect(payments[0]?.id).toBe(firstPaymentId)

  expectNoPageErrors(pageErrors)
})

test('dos solicitudes verdaderamente simultáneas con la misma clave no duplican el pago', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const { credentials, relationshipId } = await setUpActivatedRental(page, uniqueRunId())
  const idempotencyKey = randomUUID()

  const [first, second] = await callReportPaymentTwiceConcurrently(stack, credentials, {
    relationshipId,
    amount: 1_500_000,
    paymentDate: '2026-01-05',
    idempotencyKey,
  })
  expect(first.error, first.error?.message).toBeNull()
  expect(second.error, second.error?.message).toBeNull()
  expect((second.data as { id: string }).id).toBe((first.data as { id: string }).id)

  const payments = await readPaymentsForRelationship(stack, credentials, relationshipId)
  expect(payments).toHaveLength(1)

  expectNoPageErrors(pageErrors)
})

test('la misma clave con un payload distinto se rechaza sin crear un segundo pago', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const { credentials, relationshipId } = await setUpActivatedRental(page, uniqueRunId())
  const idempotencyKey = randomUUID()

  const first = await callReportPayment(stack, credentials, {
    relationshipId,
    amount: 1_500_000,
    paymentDate: '2026-01-05',
    idempotencyKey,
  })
  expect(first.error, first.error?.message).toBeNull()

  // Same key, genuinely different amount - must be rejected, never silently
  // treated as a replay of the first.
  const conflicting = await callReportPayment(stack, credentials, {
    relationshipId,
    amount: 999_999,
    paymentDate: '2026-01-05',
    idempotencyKey,
  })
  expect(conflicting.error).not.toBeNull()
  expect(conflicting.error?.message).toContain('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD')

  const payments = await readPaymentsForRelationship(stack, credentials, relationshipId)
  expect(payments).toHaveLength(1)

  expectNoPageErrors(pageErrors)
})

test('dos pagos legítimos de igual monto y fecha, reportados por separado desde la UI real, se registran como dos pagos distintos', async ({
  page,
}) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const { credentials, relationshipId, propertyName, tenantName } = await setUpActivatedRental(page, uniqueRunId())

  await goToRentalSection(page, { propertyName, tenantName, section: 'Pagos' })
  await reportPayment(page, { amount: '1500000', paymentDate: '2026-01-05' })
  await expect(page.getByText('Reportado', { exact: true }).first()).toBeVisible()

  // The form itself rotates its own idempotency key only after a successful
  // report (see PaymentReportForm's own onSubmit) - this second submission
  // is a genuinely new logical attempt with the same visible amount/date.
  await reportPayment(page, { amount: '1500000', paymentDate: '2026-01-05' })

  const payments = await readPaymentsForRelationship(stack, credentials, relationshipId)
  expect(payments).toHaveLength(2)
  expect(payments[0]?.amount).toBe(1_500_000)
  expect(payments[1]?.amount).toBe(1_500_000)
  expect(payments[0]?.id).not.toBe(payments[1]?.id)

  expectNoPageErrors(pageErrors)
})

test('la misma clave de idempotencia puede reutilizarse de forma segura entre dos administraciones distintas', async ({
  page,
  browser,
}) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const runId = uniqueRunId()
  const { credentials: credentialsA, relationshipId: relationshipAId } = await setUpActivatedRental(page, `${runId}-a`)

  const contextB = await browser.newContext()
  const pageB = await contextB.newPage()
  pageB.on('pageerror', (error) => {
    pageErrors.push(error)
  })
  const { credentials: credentialsB, relationshipId: relationshipBId } = await setUpActivatedRental(pageB, `${runId}-b`)

  const sharedKey = randomUUID()
  const resultA = await callReportPayment(stack, credentialsA, {
    relationshipId: relationshipAId,
    amount: 1_500_000,
    paymentDate: '2026-01-05',
    idempotencyKey: sharedKey,
  })
  const resultB = await callReportPayment(stack, credentialsB, {
    relationshipId: relationshipBId,
    amount: 900_000,
    paymentDate: '2026-01-06',
    idempotencyKey: sharedKey,
  })

  expect(resultA.error, resultA.error?.message).toBeNull()
  expect(resultB.error, resultB.error?.message).toBeNull()
  expect((resultA.data as { id: string }).id).not.toBe((resultB.data as { id: string }).id)

  const paymentsA = await readPaymentsForRelationship(stack, credentialsA, relationshipAId)
  const paymentsB = await readPaymentsForRelationship(stack, credentialsB, relationshipBId)
  expect(paymentsA).toHaveLength(1)
  expect(paymentsB).toHaveLength(1)

  await contextB.close()
  expectNoPageErrors(pageErrors)
})

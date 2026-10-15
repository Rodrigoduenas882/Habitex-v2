import { expect, test } from '@playwright/test'
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

// Rental activation (activate_rental_relationship) through the REAL UI,
// against a disposable, isolated local Supabase stack - never the shared
// dev stack, never remote. Every "principal" entity and transition
// (account/administration, property, rental draft, terms, activation) is
// created/triggered by driving the actual app forms/buttons, never by
// calling RPCs directly or writing to the database - the one unavoidable
// non-UI step is the initial `supabase.auth.signUp()` inside
// signUpAndBootstrap (see habitex-ui-flows.ts's own doc comment for why).
//
// Each test below signs up its OWN brand-new account (unique email/RUN_ID)
// and creates its own property/draft(s) - no shared fixtures, no order
// dependency, no reuse of data across tests or across this suite's other
// spec file.

const stack = await verifyDisposableStack()

function uniqueRunId() {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}

test('activa un arriendo desde la UI real y el estado persiste tras recargar', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const RUN_ID = uniqueRunId()
  const USER_EMAIL = `e2e-activate-${RUN_ID}@habitex.test`
  const USER_PASSWORD = `Habitex-E2E-Activate-${RUN_ID}!`
  const PROPERTY_NAME = `Apartamento Activación ${RUN_ID}`
  const TENANT_NAME = `Inquilino Activación ${RUN_ID}`

  await signUpAndBootstrap(page, stack, {
    email: USER_EMAIL,
    password: USER_PASSWORD,
    fullName: 'Propietaria E2E Activación',
  })
  await createProperty(page, { name: PROPERTY_NAME, address: 'Calle 20 # 30-40', city: 'Cali' })
  await createRentalDraft(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME })

  const rentalCard = findRentalCard(page, PROPERTY_NAME, TENANT_NAME)
  await expectRentalCardTenant(rentalCard, TENANT_NAME)
  await expect(rentalCard).toContainText('Borrador')

  // --- Negative check, free within this same flow: cannot activate
  // without terms (activate_rental_relationship's own
  // RENTAL_TERMS_INCOMPLETE/INITIAL_TERM_VERSION_REQUIRED, mirrored
  // proactively client-side by RentalsPage.hasCompleteSchedule +
  // useRentalTermsExistence). A real, disabled native <button> - Playwright
  // asserts this rather than attempting a click, which a disabled button
  // would never actually deliver. ---
  const activateButton = rentalCard.getByRole('button', { name: 'Activar' })
  await expect(activateButton).toBeDisabled()
  await expect(rentalCard).toContainText('Completa los términos de este arriendo para poder activarlo.')

  // --- Complete terms through the real form ---
  await completeRentalTerms(page, {
    propertyName: PROPERTY_NAME,
    tenantName: TENANT_NAME,
    realStartDate: '2026-11-01',
    paymentDay: '5',
    rentAmount: '1500000',
  })

  // --- Now activatable ---
  const rentalCardAfterTerms = findRentalCard(page, PROPERTY_NAME, TENANT_NAME)
  await expectRentalCardTenant(rentalCardAfterTerms, TENANT_NAME)
  await expect(rentalCardAfterTerms.getByRole('button', { name: 'Activar' })).toBeEnabled()
  await rentalCardAfterTerms.getByRole('button', { name: 'Activar' }).click()

  await expect(rentalCardAfterTerms).toContainText('Activo')
  await expect(rentalCardAfterTerms).not.toContainText('Borrador')

  // --- Persistence check: a page reload must read the real, persisted
  // status back from the server, not a client-only optimistic update. ---
  await page.reload()
  const rentalCardAfterReload = findRentalCard(page, PROPERTY_NAME, TENANT_NAME)
  await expectRentalCardTenant(rentalCardAfterReload, TENANT_NAME)
  await expect(rentalCardAfterReload).toContainText('Activo')

  expectNoPageErrors(pageErrors)
})

test('impide activar un segundo borrador sobre el mismo inmueble ya ocupado', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const RUN_ID = uniqueRunId()
  const USER_EMAIL = `e2e-doubleocc-${RUN_ID}@habitex.test`
  const USER_PASSWORD = `Habitex-E2E-DoubleOcc-${RUN_ID}!`
  const PROPERTY_NAME = `Apartamento Doble Ocupación ${RUN_ID}`
  const TENANT_A = `Inquilino A ${RUN_ID}`
  const TENANT_B = `Inquilino B ${RUN_ID}`

  await signUpAndBootstrap(page, stack, {
    email: USER_EMAIL,
    password: USER_PASSWORD,
    fullName: 'Propietaria E2E Doble Ocupación',
  })
  await createProperty(page, { name: PROPERTY_NAME, address: 'Calle 50 # 60-70', city: 'Barranquilla' })

  // Two independent DRAFT rentals against the SAME property - nothing in
  // create_rental_draft prevents this; the conflict only surfaces at
  // activation time (RENTAL_SUBJECT_ALREADY_IN_USE), per
  // RentalActivationErrorCode's own doc comment.
  await createRentalDraft(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_A })
  await createRentalDraft(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_B })

  await completeRentalTerms(page, {
    propertyName: PROPERTY_NAME,
    tenantName: TENANT_A,
    realStartDate: '2026-11-01',
    paymentDay: '5',
    rentAmount: '1500000',
  })
  await completeRentalTerms(page, {
    propertyName: PROPERTY_NAME,
    tenantName: TENANT_B,
    realStartDate: '2026-11-01',
    paymentDay: '10',
    rentAmount: '1200000',
  })

  // --- Activate the first draft - succeeds, occupies the property ---
  const cardA = findRentalCard(page, PROPERTY_NAME, TENANT_A)
  await expectRentalCardTenant(cardA, TENANT_A)
  await expect(cardA.getByRole('button', { name: 'Activar' })).toBeEnabled()
  await cardA.getByRole('button', { name: 'Activar' }).click()
  await expect(cardA).toContainText('Activo')

  // --- Attempt to activate the second draft on the SAME property - a real
  // RPC rejection (RENTAL_SUBJECT_ALREADY_IN_USE), not a client-side
  // proactive gate (the client has no way to know the subject is already
  // occupied before asking the server - this exercises the server's own
  // authority, not a UI heuristic). ---
  const cardB = findRentalCard(page, PROPERTY_NAME, TENANT_B)
  await expectRentalCardTenant(cardB, TENANT_B)
  await expect(cardB.getByRole('button', { name: 'Activar' })).toBeEnabled()
  await cardB.getByRole('button', { name: 'Activar' }).click()
  await expect(cardB.getByText('El activo de este arriendo ya está en uso en otra relación activa.')).toBeVisible()
  await expect(cardB).toContainText('Borrador')

  // --- Persistence check: both outcomes must survive a reload. ---
  await page.reload()
  const cardAAfterReload = findRentalCard(page, PROPERTY_NAME, TENANT_A)
  const cardBAfterReload = findRentalCard(page, PROPERTY_NAME, TENANT_B)
  await expectRentalCardTenant(cardAAfterReload, TENANT_A)
  await expectRentalCardTenant(cardBAfterReload, TENANT_B)
  await expect(cardAAfterReload).toContainText('Activo')
  await expect(cardBAfterReload).toContainText('Borrador')

  expectNoPageErrors(pageErrors)
})

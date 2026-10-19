import { expect, test } from '@playwright/test'
import {
  cancelDraft,
  daysAgoISO,
  daysFromNowISO,
  endRental,
  readVisibleRelationshipStatuses,
  startEndingRental,
} from './support/habitex-rental-lifecycle-flows.js'
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

// Rental lifecycle (cancel_draft_rental / start_ending_rental / end_rental)
// through the REAL UI, against a disposable, isolated local Supabase stack -
// never the shared dev stack, never remote. Every write is driven by the
// actual app forms/buttons, never a direct RPC/SQL call, never service_role.
// All three transitions are RPC-only (RLS blocks any direct client UPDATE
// from changing status outside DRAFT), so there is no raw-UPDATE path to
// special-case here, unlike contracts' markShared/terminate.
//
// Each test signs up its OWN brand-new account(s) (unique email/RUN_ID) and
// creates its own property/draft/rental - no shared fixtures, no order
// dependency, no reuse of data across tests or across this suite's other
// spec files. Dates are always computed relative to the REAL current date
// (daysAgoISO/daysFromNowISO) - never hardcoded to a specific calendar
// year, never advanced/mocked.

const stack = await verifyDisposableStack()

function uniqueRunId() {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}

test('cancela un arriendo en borrador y confirma la persistencia', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const RUN_ID = uniqueRunId()
  const OWNER_EMAIL = `e2e-lifecycle-cancel-${RUN_ID}@habitex.test`
  const OWNER_PASSWORD = `Habitex-E2E-LifecycleCancel-${RUN_ID}!`
  const PROPERTY_NAME = `Apartamento Cancelación ${RUN_ID}`
  const TENANT_NAME = `Inquilino Cancelación ${RUN_ID}`

  await signUpAndBootstrap(page, stack, {
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    fullName: 'Propietaria E2E Cancelación',
  })
  await createProperty(page, { name: PROPERTY_NAME, address: 'Calle 11 # 22-33', city: 'Bogotá' })
  await createRentalDraft(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME })

  const rentalCard = findRentalCard(page, PROPERTY_NAME, TENANT_NAME)
  await expectRentalCardTenant(rentalCard, TENANT_NAME)
  await expect(rentalCard).toContainText('Borrador')

  await cancelDraft(page)
  await expect(rentalCard).toContainText('Cancelado')

  // --- Persistencia real: recargar y confirmar que el estado sobrevive. ---
  await page.reload()
  const rentalCardAfterReload = findRentalCard(page, PROPERTY_NAME, TENANT_NAME)
  await expectRentalCardTenant(rentalCardAfterReload, TENANT_NAME)
  await expect(rentalCardAfterReload).toContainText('Cancelado')

  // --- Ninguna acción de gestión incompatible con CANCELLED permanece disponible. ---
  await expect(rentalCardAfterReload.getByRole('button', { name: 'Activar' })).toHaveCount(0)
  await expect(rentalCardAfterReload.getByRole('button', { name: 'Cancelar', exact: true })).toHaveCount(0)
  await expect(rentalCardAfterReload.getByRole('button', { name: 'Completar términos' })).toHaveCount(0)
  await expect(rentalCardAfterReload.getByRole('button', { name: 'Contratos' })).toHaveCount(0)
  await expect(rentalCardAfterReload.getByRole('button', { name: 'Cargos' })).toHaveCount(0)
  await expect(rentalCardAfterReload.getByRole('button', { name: 'Pagos' })).toHaveCount(0)

  expectNoPageErrors(pageErrors)
})

test('inicia el cierre de un arriendo activo y confirma la persistencia', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const RUN_ID = uniqueRunId()
  const OWNER_EMAIL = `e2e-lifecycle-ending-${RUN_ID}@habitex.test`
  const OWNER_PASSWORD = `Habitex-E2E-LifecycleEnding-${RUN_ID}!`
  const PROPERTY_NAME = `Apartamento Inicio Cierre ${RUN_ID}`
  const TENANT_NAME = `Inquilino Inicio Cierre ${RUN_ID}`

  await signUpAndBootstrap(page, stack, {
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    fullName: 'Propietaria E2E Inicio Cierre',
  })
  await createProperty(page, { name: PROPERTY_NAME, address: 'Calle 44 # 55-66', city: 'Medellín' })
  await createRentalDraft(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME })
  await completeRentalTerms(page, {
    propertyName: PROPERTY_NAME,
    tenantName: TENANT_NAME,
    realStartDate: daysAgoISO(30),
    paymentDay: '5',
    rentAmount: '1500000',
  })

  const rentalCard = findRentalCard(page, PROPERTY_NAME, TENANT_NAME)
  await expectRentalCardTenant(rentalCard, TENANT_NAME)
  await rentalCard.getByRole('button', { name: 'Activar' }).click()
  await expect(rentalCard).toContainText('Activo')

  await startEndingRental(page)
  await expect(rentalCard).toContainText('Finalizando')

  // --- Persistencia real. ---
  await page.reload()
  const rentalCardAfterReload = findRentalCard(page, PROPERTY_NAME, TENANT_NAME)
  await expectRentalCardTenant(rentalCardAfterReload, TENANT_NAME)
  await expect(rentalCardAfterReload).toContainText('Finalizando')

  expectNoPageErrors(pageErrors)
})

test('finaliza un arriendo con confirmación de dos pasos y libera el inmueble para un nuevo arriendo', async ({
  page,
}) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const RUN_ID = uniqueRunId()
  const OWNER_EMAIL = `e2e-lifecycle-end-${RUN_ID}@habitex.test`
  const OWNER_PASSWORD = `Habitex-E2E-LifecycleEnd-${RUN_ID}!`
  const PROPERTY_NAME = `Apartamento Finalización ${RUN_ID}`
  const TENANT_A = `Inquilino Finalización A ${RUN_ID}`
  const TENANT_B = `Inquilino Finalización B ${RUN_ID}`

  await signUpAndBootstrap(page, stack, {
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    fullName: 'Propietaria E2E Finalización',
  })
  await createProperty(page, { name: PROPERTY_NAME, address: 'Calle 77 # 88-99', city: 'Cali' })
  await createRentalDraft(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_A })
  await completeRentalTerms(page, {
    propertyName: PROPERTY_NAME,
    tenantName: TENANT_A,
    realStartDate: daysAgoISO(30),
    paymentDay: '5',
    rentAmount: '1500000',
  })

  const rentalCardA = findRentalCard(page, PROPERTY_NAME, TENANT_A)
  await expectRentalCardTenant(rentalCardA, TENANT_A)
  await rentalCardA.getByRole('button', { name: 'Activar' }).click()
  await expect(rentalCardA).toContainText('Activo')

  await startEndingRental(page)
  await expect(rentalCardA).toContainText('Finalizando')

  await endRental(page)

  // --- Independent review/self-caught, not a product defect: end_rental
  // marks the tenant's rental_participants row as ENDED, so
  // useRentalIdentities (which only resolves the CURRENT active tenant) now
  // legitimately renders the honest "Sin inquilino asignado" fallback
  // instead of TENANT_A's name - confirmed by reading the real page
  // snapshot after a genuine failure here. findRentalCard (which filters by
  // tenant name) can no longer locate this card once ENDED, so every
  // assertion from here on re-locates it by property name alone - there is
  // only one card for this property until TENANT_B's draft is created below. ---
  const rentalCardAEnded = page.getByText(PROPERTY_NAME, { exact: true }).locator('xpath=..')
  await expect(rentalCardAEnded).toContainText('Finalizado')

  // --- Persistencia real. ---
  await page.reload()
  const rentalCardAAfterReload = page.getByText(PROPERTY_NAME, { exact: true }).locator('xpath=..')
  await expect(rentalCardAAfterReload).toContainText('Finalizado')

  // --- Disponibilidad del inmueble: end_rental elimina la fila de
  // rental_subject_occupancies de la relación finalizada, así que un
  // SEGUNDO arriendo sobre la MISMA propiedad ahora debe poder activarse
  // sin el conflicto RENTAL_SUBJECT_ALREADY_IN_USE ya probado en E2E#2. ---
  await createRentalDraft(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_B })
  await completeRentalTerms(page, {
    propertyName: PROPERTY_NAME,
    tenantName: TENANT_B,
    realStartDate: daysAgoISO(5),
    paymentDay: '10',
    rentAmount: '1200000',
  })

  const rentalCardB = findRentalCard(page, PROPERTY_NAME, TENANT_B)
  await expectRentalCardTenant(rentalCardB, TENANT_B)
  await expect(rentalCardB.getByRole('button', { name: 'Activar' })).toBeEnabled()
  await rentalCardB.getByRole('button', { name: 'Activar' }).click()
  await expect(rentalCardB).toContainText('Activo')

  expectNoPageErrors(pageErrors)
})

test('aísla los arriendos de una administración frente a otra', async ({ page, browser }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const RUN_ID = uniqueRunId()
  const OWNER_A_EMAIL = `e2e-lifecycle-isolationA-${RUN_ID}@habitex.test`
  const OWNER_A_PASSWORD = `Habitex-E2E-LifecycleIsolationA-${RUN_ID}!`
  const OWNER_B_EMAIL = `e2e-lifecycle-isolationB-${RUN_ID}@habitex.test`
  const OWNER_B_PASSWORD = `Habitex-E2E-LifecycleIsolationB-${RUN_ID}!`
  const PROPERTY_A = `Apartamento Aislamiento Ciclo A ${RUN_ID}`
  const TENANT_A = `Inquilino Aislamiento Ciclo A ${RUN_ID}`

  // --- Administración A: un arriendo real en DRAFT (nunca una prueba vacía). ---
  await signUpAndBootstrap(page, stack, {
    email: OWNER_A_EMAIL,
    password: OWNER_A_PASSWORD,
    fullName: 'Propietaria E2E Aislamiento Ciclo A',
  })
  await createProperty(page, { name: PROPERTY_A, address: 'Calle 22 # 11-00', city: 'Bucaramanga' })
  await createRentalDraft(page, { propertyName: PROPERTY_A, tenantName: TENANT_A })

  const relationshipsA = await readVisibleRentalRelationships(stack, { email: OWNER_A_EMAIL, password: OWNER_A_PASSWORD })
  expect(relationshipsA).toHaveLength(1)
  const relationshipAId = relationshipsA[0]?.id
  expect(relationshipAId).toBeTruthy()

  // --- Administración B: cuenta y contexto de navegador independientes, sin ningún arriendo propio. ---
  const administrationBContext = await browser.newContext()
  const administrationBPage = await administrationBContext.newPage()
  administrationBPage.on('pageerror', (error) => {
    pageErrors.push(error)
  })
  await signUpAndBootstrap(administrationBPage, stack, {
    email: OWNER_B_EMAIL,
    password: OWNER_B_PASSWORD,
    fullName: 'Propietaria E2E Aislamiento Ciclo B',
  })

  // --- Denegación por UI: el arriendo de A nunca aparece en la propia lista de B. ---
  await administrationBPage.goto('/rentals')
  await expect(administrationBPage.getByText(PROPERTY_A, { exact: true })).not.toBeVisible()
  await expect(administrationBPage.getByText(TENANT_A, { exact: true })).not.toBeVisible()

  // --- Refuerzo: lectura read-only directa con la sesión real de B (clave
  // pública, nunca service_role) - ningún id de A aparece, ni siquiera sin filtrar. ---
  const relationshipsVisibleToB = await readVisibleRelationshipStatuses(stack, {
    email: OWNER_B_EMAIL,
    password: OWNER_B_PASSWORD,
  })
  expect(relationshipsVisibleToB.some((relationship) => relationship.id === relationshipAId)).toBe(false)

  await administrationBContext.close()
  expectNoPageErrors(pageErrors)
})

test('rechaza terminar un arriendo cuya fecha de inicio real es posterior a hoy', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const RUN_ID = uniqueRunId()
  const OWNER_EMAIL = `e2e-lifecycle-enderror-${RUN_ID}@habitex.test`
  const OWNER_PASSWORD = `Habitex-E2E-LifecycleEndError-${RUN_ID}!`
  const PROPERTY_NAME = `Apartamento Error Fecha ${RUN_ID}`
  const TENANT_NAME = `Inquilino Error Fecha ${RUN_ID}`

  await signUpAndBootstrap(page, stack, {
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    fullName: 'Propietaria E2E Error Fecha',
  })
  await createProperty(page, { name: PROPERTY_NAME, address: 'Calle 66 # 77-88', city: 'Pereira' })
  await createRentalDraft(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME })
  // realStartDate deliberadamente FUTURO - end_rental's own DEFAULT
  // CURRENT_DATE (hoy) siempre será anterior a esta fecha, reproduciendo
  // END_BEFORE_START de forma determinista sin tocar el reloj del sistema.
  await completeRentalTerms(page, {
    propertyName: PROPERTY_NAME,
    tenantName: TENANT_NAME,
    realStartDate: daysFromNowISO(30),
    paymentDay: '5',
    rentAmount: '1500000',
  })

  const rentalCard = findRentalCard(page, PROPERTY_NAME, TENANT_NAME)
  await expectRentalCardTenant(rentalCard, TENANT_NAME)
  await rentalCard.getByRole('button', { name: 'Activar' }).click()
  await expect(rentalCard).toContainText('Activo')

  await startEndingRental(page)
  await expect(rentalCard).toContainText('Finalizando')

  await rentalCard.getByRole('button', { name: 'Terminar arriendo', exact: true }).click()
  await rentalCard.getByRole('button', { name: 'Confirmar terminación', exact: true }).click()
  await expect(
    rentalCard.getByText('La fecha de terminación no puede ser anterior a la fecha de inicio del arriendo.'),
  ).toBeVisible()

  // --- El error no cambia el estado: sigue en "Finalizando", nunca "Finalizado". ---
  await expect(rentalCard).toContainText('Finalizando')
  await expect(rentalCard).not.toContainText('Finalizado')

  expectNoPageErrors(pageErrors)
})

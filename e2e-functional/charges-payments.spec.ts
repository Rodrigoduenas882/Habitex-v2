import { expect, test } from '@playwright/test'
import {
  allocatePaymentToSoleCharge,
  confirmPayment,
  firstOfCurrentMonthISO,
  formatAmountCOP,
  goToRentalSection,
  issueReceipt,
  readVisibleCharges,
  readVisiblePayments,
  rejectPayment,
  reportPayment,
  todayISO,
} from './support/habitex-charges-payments-flows.js'
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

// Charges and payments (generate_rent_charges / report_payment /
// confirm_payment / reject_payment / allocate_payment / issue_receipt)
// through the REAL UI, against a disposable, isolated local Supabase stack -
// never the shared dev stack, never remote. Every financial write is driven
// by the actual app forms/buttons, never a direct RPC/SQL call, never
// service_role - Habitex does not custody money, it only records
// obligations (charges) and reported payments, and these tests never
// pretend otherwise.
//
// Each test signs up its OWN brand-new account(s) (unique email/RUN_ID) and
// creates its own property/draft/rental - no shared fixtures, no order
// dependency, no reuse of data across tests or across this suite's other
// spec files. Rental term dates are always computed relative to the REAL
// current date (firstOfCurrentMonthISO/todayISO) - never hardcoded to a
// specific calendar year, never advanced/mocked.

const stack = await verifyDisposableStack()

function uniqueRunId() {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}

const RENT_AMOUNT = 1_500_000
const RENT_AMOUNT_STR = String(RENT_AMOUNT)

test('genera un cargo real, reporta y confirma un pago, lo aplica y emite un recibo', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const RUN_ID = uniqueRunId()
  const OWNER_EMAIL = `e2e-charges-cycle-${RUN_ID}@habitex.test`
  const OWNER_PASSWORD = `Habitex-E2E-ChargesCycle-${RUN_ID}!`
  const PROPERTY_NAME = `Apartamento Ciclo Financiero ${RUN_ID}`
  const TENANT_NAME = `Inquilino Ciclo Financiero ${RUN_ID}`

  await signUpAndBootstrap(page, stack, {
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    fullName: 'Propietaria E2E Ciclo Financiero',
  })
  await createProperty(page, { name: PROPERTY_NAME, address: 'Calle 80 # 20-10', city: 'Medellín' })
  await createRentalDraft(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME })
  await completeRentalTerms(page, {
    propertyName: PROPERTY_NAME,
    tenantName: TENANT_NAME,
    realStartDate: firstOfCurrentMonthISO(),
    paymentDay: '5',
    rentAmount: RENT_AMOUNT_STR,
  })

  const rentalCard = findRentalCard(page, PROPERTY_NAME, TENANT_NAME)
  await expectRentalCardTenant(rentalCard, TENANT_NAME)
  await expect(rentalCard.getByRole('button', { name: 'Activar' })).toBeEnabled()
  await rentalCard.getByRole('button', { name: 'Activar' }).click()
  await expect(rentalCard).toContainText('Activo')

  // --- Generar cargos: exactamente 1 cargo real (realStartDate es el
  // primer día del mes real actual, así que generate_rent_charges solo
  // itera ese único mes). ---
  await goToRentalSection(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME, section: 'Cargos' })
  await page.getByRole('button', { name: 'Generar cargos de renta' }).click()
  await expect(page.getByText('1 cargo(s) generado(s).')).toBeVisible()
  await expect(page.getByText(`Saldo: ${formatAmountCOP(RENT_AMOUNT)}`)).toBeVisible()
  await expect(page.getByText(`Pagado: ${formatAmountCOP(0)}`)).toBeVisible()

  // --- Reportar un pago por el valor completo del cargo. ---
  await goToRentalSection(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME, section: 'Pagos' })
  await reportPayment(page, { amount: RENT_AMOUNT_STR, paymentDate: todayISO() })
  await expect(page.getByText('Reportado', { exact: true })).toBeVisible()

  // --- Un pago REPORTED todavía no reduce el saldo del cargo. ---
  await goToRentalSection(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME, section: 'Cargos' })
  await expect(page.getByText(`Saldo: ${formatAmountCOP(RENT_AMOUNT)}`)).toBeVisible()
  await expect(page.getByText(`Pagado: ${formatAmountCOP(0)}`)).toBeVisible()
  await expect(page.getByText('Pagado', { exact: true })).not.toBeVisible()

  // --- Confirmar el pago y aplicarlo al cargo mediante la UI real. ---
  await goToRentalSection(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME, section: 'Pagos' })
  await confirmPayment(page)
  await expect(page.getByText('Confirmado', { exact: true })).toBeVisible()

  await allocatePaymentToSoleCharge(page, RENT_AMOUNT_STR)
  await expect(page.getByText('Pago aplicado completamente')).toBeVisible()

  // --- Saldo y estado financiero resultantes: pagado por completo. ---
  await goToRentalSection(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME, section: 'Cargos' })
  await expect(page.getByText(`Pagado: ${formatAmountCOP(RENT_AMOUNT)}`)).toBeVisible()
  await expect(page.getByText(`Saldo: ${formatAmountCOP(0)}`)).toBeVisible()
  await expect(page.getByText('Pagado', { exact: true })).toBeVisible()

  // --- Emitir recibo y comprobar su existencia visible. ---
  await goToRentalSection(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME, section: 'Pagos' })
  await issueReceipt(page)
  await expect(page.getByText(/Recibo No\. \d+/)).toBeVisible()

  expectNoPageErrors(pageErrors)
})

test('genera cargos de renta de forma idempotente para el mismo período', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const RUN_ID = uniqueRunId()
  const OWNER_EMAIL = `e2e-charges-idempotent-${RUN_ID}@habitex.test`
  const OWNER_PASSWORD = `Habitex-E2E-ChargesIdempotent-${RUN_ID}!`
  const PROPERTY_NAME = `Apartamento Idempotencia ${RUN_ID}`
  const TENANT_NAME = `Inquilino Idempotencia ${RUN_ID}`

  await signUpAndBootstrap(page, stack, {
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    fullName: 'Propietaria E2E Idempotencia',
  })
  await createProperty(page, { name: PROPERTY_NAME, address: 'Calle 90 # 30-20', city: 'Manizales' })
  await createRentalDraft(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME })
  await completeRentalTerms(page, {
    propertyName: PROPERTY_NAME,
    tenantName: TENANT_NAME,
    realStartDate: firstOfCurrentMonthISO(),
    paymentDay: '5',
    rentAmount: RENT_AMOUNT_STR,
  })

  const rentalCard = findRentalCard(page, PROPERTY_NAME, TENANT_NAME)
  await expectRentalCardTenant(rentalCard, TENANT_NAME)
  await rentalCard.getByRole('button', { name: 'Activar' }).click()
  await expect(rentalCard).toContainText('Activo')

  await goToRentalSection(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME, section: 'Cargos' })
  await page.getByRole('button', { name: 'Generar cargos de renta' }).click()
  await expect(page.getByText('1 cargo(s) generado(s).')).toBeVisible()
  await expect(page.getByText(/^Vence el /)).toHaveCount(1)

  // --- Segunda generación para el MISMO período: idempotente por el
  // índice único de generate_rent_charges (on conflict do nothing) - no
  // crea un cargo duplicado. ---
  await page.getByRole('button', { name: 'Generar cargos de renta' }).click()
  await expect(page.getByText('No había cargos nuevos por generar.')).toBeVisible()
  await expect(page.getByText(/^Vence el /)).toHaveCount(1)

  expectNoPageErrors(pageErrors)
})

test('rechaza un pago reportado sin afectar el saldo del cargo', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const RUN_ID = uniqueRunId()
  const OWNER_EMAIL = `e2e-charges-reject-${RUN_ID}@habitex.test`
  const OWNER_PASSWORD = `Habitex-E2E-ChargesReject-${RUN_ID}!`
  const PROPERTY_NAME = `Apartamento Rechazo ${RUN_ID}`
  const TENANT_NAME = `Inquilino Rechazo ${RUN_ID}`

  await signUpAndBootstrap(page, stack, {
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    fullName: 'Propietaria E2E Rechazo',
  })
  await createProperty(page, { name: PROPERTY_NAME, address: 'Calle 15 # 40-50', city: 'Pasto' })
  await createRentalDraft(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME })
  await completeRentalTerms(page, {
    propertyName: PROPERTY_NAME,
    tenantName: TENANT_NAME,
    realStartDate: firstOfCurrentMonthISO(),
    paymentDay: '5',
    rentAmount: RENT_AMOUNT_STR,
  })

  const rentalCard = findRentalCard(page, PROPERTY_NAME, TENANT_NAME)
  await expectRentalCardTenant(rentalCard, TENANT_NAME)
  await rentalCard.getByRole('button', { name: 'Activar' }).click()
  await expect(rentalCard).toContainText('Activo')

  await goToRentalSection(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME, section: 'Cargos' })
  await page.getByRole('button', { name: 'Generar cargos de renta' }).click()
  await expect(page.getByText('1 cargo(s) generado(s).')).toBeVisible()

  await goToRentalSection(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME, section: 'Pagos' })
  await reportPayment(page, { amount: RENT_AMOUNT_STR, paymentDate: todayISO() })
  await expect(page.getByText('Reportado', { exact: true })).toBeVisible()

  await rejectPayment(page)
  await expect(page.getByText('Rechazado', { exact: true })).toBeVisible()

  // --- Un pago RECHAZADO no ofrece ninguna acción adicional (el bloque de
  // acciones solo se renderiza para status REPORTED). ---
  await expect(page.getByRole('button', { name: 'Confirmar pago' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Rechazar pago' })).toHaveCount(0)

  // --- El rechazo nunca afecta el saldo del cargo. ---
  await goToRentalSection(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME, section: 'Cargos' })
  await expect(page.getByText(`Saldo: ${formatAmountCOP(RENT_AMOUNT)}`)).toBeVisible()
  await expect(page.getByText(`Pagado: ${formatAmountCOP(0)}`)).toBeVisible()
  await expect(page.getByText('Pagado', { exact: true })).not.toBeVisible()

  expectNoPageErrors(pageErrors)
})

test('aísla cargos y pagos de una administración frente a otra', async ({ page, browser }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const RUN_ID = uniqueRunId()
  const OWNER_A_EMAIL = `e2e-charges-isolationA-${RUN_ID}@habitex.test`
  const OWNER_A_PASSWORD = `Habitex-E2E-ChargesIsolationA-${RUN_ID}!`
  const OWNER_B_EMAIL = `e2e-charges-isolationB-${RUN_ID}@habitex.test`
  const OWNER_B_PASSWORD = `Habitex-E2E-ChargesIsolationB-${RUN_ID}!`
  const PROPERTY_A = `Apartamento Aislamiento A ${RUN_ID}`
  const TENANT_A = `Inquilino Aislamiento A ${RUN_ID}`

  // --- Administración A: datos financieros REALES (nunca una prueba
  // vacía) - un cargo real generado y un pago real reportado, ambos a
  // través de la UI. ---
  await signUpAndBootstrap(page, stack, {
    email: OWNER_A_EMAIL,
    password: OWNER_A_PASSWORD,
    fullName: 'Propietaria E2E Aislamiento A',
  })
  await createProperty(page, { name: PROPERTY_A, address: 'Calle 25 # 60-30', city: 'Ibagué' })
  await createRentalDraft(page, { propertyName: PROPERTY_A, tenantName: TENANT_A })
  await completeRentalTerms(page, {
    propertyName: PROPERTY_A,
    tenantName: TENANT_A,
    realStartDate: firstOfCurrentMonthISO(),
    paymentDay: '5',
    rentAmount: RENT_AMOUNT_STR,
  })

  const rentalCardA = findRentalCard(page, PROPERTY_A, TENANT_A)
  await expectRentalCardTenant(rentalCardA, TENANT_A)
  await rentalCardA.getByRole('button', { name: 'Activar' }).click()
  await expect(rentalCardA).toContainText('Activo')

  await goToRentalSection(page, { propertyName: PROPERTY_A, tenantName: TENANT_A, section: 'Cargos' })
  await page.getByRole('button', { name: 'Generar cargos de renta' }).click()
  await expect(page.getByText('1 cargo(s) generado(s).')).toBeVisible()

  await goToRentalSection(page, { propertyName: PROPERTY_A, tenantName: TENANT_A, section: 'Pagos' })
  await reportPayment(page, { amount: RENT_AMOUNT_STR, paymentDate: todayISO() })
  await expect(page.getByText('Reportado', { exact: true })).toBeVisible()

  // --- Captura, con la propia sesión real de A (RLS-escopada a su propia
  // administración), el id de SU relación - ninguna UI expone este id
  // crudo, y se necesita únicamente para construir la URL que B intentará
  // abrir a continuación. ---
  const relationshipsA = await readVisibleRentalRelationships(stack, { email: OWNER_A_EMAIL, password: OWNER_A_PASSWORD })
  expect(relationshipsA).toHaveLength(1)
  const relationshipAId = relationshipsA[0]?.id
  expect(relationshipAId).toBeTruthy()

  // --- Administración B: cuenta y contexto de navegador completamente
  // independientes, sin ningún arriendo propio. ---
  const administrationBContext = await browser.newContext()
  const administrationBPage = await administrationBContext.newPage()
  administrationBPage.on('pageerror', (error) => {
    pageErrors.push(error)
  })
  await signUpAndBootstrap(administrationBPage, stack, {
    email: OWNER_B_EMAIL,
    password: OWNER_B_PASSWORD,
    fullName: 'Propietaria E2E Aislamiento B',
  })

  // --- Denegación por UI: B navega directamente a la relación de A (la
  // única forma de intentarlo, ya que A nunca aparece en la propia lista
  // de B) y la página real responde "no encontrado", nunca con los datos
  // de A. ---
  await administrationBPage.goto(`/rentals/${relationshipAId}/charges`)
  await expect(administrationBPage.getByText('No encontramos este arriendo en tu administración.')).toBeVisible()

  await administrationBPage.goto(`/rentals/${relationshipAId}/payments`)
  await expect(administrationBPage.getByText('No encontramos este arriendo en tu administración.')).toBeVisible()

  // --- Refuerzo: lectura read-only directa con la sesión real de B (clave
  // pública, nunca service_role) - prueba la RLS misma (charges_select/
  // payments_select -> can_view_relationship), no solo el efecto de la UI. ---
  const chargesVisibleToB = await readVisibleCharges(stack, { email: OWNER_B_EMAIL, password: OWNER_B_PASSWORD })
  expect(chargesVisibleToB.some((charge) => charge.rentalRelationshipId === relationshipAId)).toBe(false)

  const paymentsVisibleToB = await readVisiblePayments(stack, { email: OWNER_B_EMAIL, password: OWNER_B_PASSWORD })
  expect(paymentsVisibleToB.some((payment) => payment.rentalRelationshipId === relationshipAId)).toBe(false)

  await administrationBContext.close()
  expectNoPageErrors(pageErrors)
})

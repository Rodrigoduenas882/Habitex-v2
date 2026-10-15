import { expect, test } from '@playwright/test'
import {
  createProperty,
  createRentalDraft,
  expectNoPageErrors,
  expectRentalCardTenant,
  findRentalCard,
  signUpAndBootstrap,
  verifyDisposableStack,
} from './support/habitex-ui-flows.js'

// Full MVP journey through the REAL UI - signup, bootstrap, property
// creation, rental draft creation - against a disposable, isolated local
// Supabase stack (never the shared dev stack, never remote). Every
// "principal" entity (account/administration, property, rental) is created
// by driving the actual app forms, not by calling RPCs directly - the one
// unavoidable exception is the initial `supabase.auth.signUp()` call
// inside signUpAndBootstrap, because Habitex has no self-service "create an
// owner account" UI form anywhere in the product.
//
// Deliberately creates a brand-new account every run (unique email) and
// never reuses e2e-authenticated/.auth/user.json or .seed-output.json -
// those belong to the separate visual baseline suite.

const stack = await verifyDisposableStack()

const RUN_ID = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
const USER_EMAIL = `e2e-func-${RUN_ID}@habitex.test`
const USER_PASSWORD = `Habitex-E2E-Functional-${RUN_ID}!`
const FULL_NAME = 'Propietaria E2E Funcional'
const PROPERTY_NAME = `Apartamento Funcional ${RUN_ID}`
const PROPERTY_ADDRESS = 'Calle 10 # 20-30'
const PROPERTY_CITY = 'Medellín'
const TENANT_NAME = `Inquilino Funcional ${RUN_ID}`

test('crea una propiedad y registra un arriendo en borrador a través de la UI real', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  await signUpAndBootstrap(page, stack, { email: USER_EMAIL, password: USER_PASSWORD, fullName: FULL_NAME })
  await createProperty(page, { name: PROPERTY_NAME, address: PROPERTY_ADDRESS, city: PROPERTY_CITY })
  await createRentalDraft(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME })

  const rentalCard = findRentalCard(page, PROPERTY_NAME, TENANT_NAME)
  await expectRentalCardTenant(rentalCard, TENANT_NAME)
  await expect(rentalCard).toContainText('Borrador')

  expectNoPageErrors(pageErrors)
})

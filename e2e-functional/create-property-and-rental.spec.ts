import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import { assertDisposableSupabaseStack } from '../scripts/local-supabase-guard.mjs'

// Full MVP journey through the REAL UI - signup, bootstrap, property
// creation, rental draft creation - against a disposable, isolated local
// Supabase stack (never the shared dev stack, never remote). Every
// "principal" entity (account/administration, property, rental) is created
// by driving the actual app forms, not by calling RPCs directly - the one
// unavoidable exception is the initial `supabase.auth.signUp()` call below,
// because Habitex has no self-service "create an owner account" UI form
// anywhere in the product (the only signup form that exists,
// InvitationClaimPage, is for a different flow: a tenant claiming an
// already-issued invitation, not for creating an administration owner).
//
// Deliberately creates a brand-new account every run (unique email) and
// never reuses e2e-authenticated/.auth/user.json or .seed-output.json -
// those belong to the separate visual baseline suite and reusing them here
// would mean testing against already-existing data instead of the real
// creation flow this suite exists to exercise.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''

// Independent review (HIGH, fixed): repeats the SAME verification the config
// file already did (see playwright.e2e-functional.config.ts), as a second,
// independent layer right before the one real write this file performs
// outside the UI (signUp). Never assume the config's check alone is enough
// if this spec is ever invoked a different way. See local-supabase-guard.mjs.
await assertDisposableSupabaseStack({
  url: SUPABASE_URL,
  declaredPort: process.env.E2E_FUNCTIONAL_SUPABASE_PORT,
  sharedConfigTomlText: readFileSync('supabase/config.toml', 'utf8'),
})
if (!SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is not set.')
}

const RUN_ID = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
const USER_EMAIL = `e2e-func-${RUN_ID}@habitex.test`
const USER_PASSWORD = `Habitex-E2E-Functional-${RUN_ID}!`
const FULL_NAME = 'Propietaria E2E Funcional'
const PROPERTY_NAME = `Apartamento Funcional ${RUN_ID}`
const PROPERTY_ADDRESS = 'Calle 10 # 20-30'
const PROPERTY_CITY = 'Medellín'
const TENANT_NAME = `Inquilino Funcional ${RUN_ID}`

function expectNoPageErrors(pageErrors: Error[]) {
  expect(pageErrors, `Unexpected page error(s): ${pageErrors.map((e) => e.message).join('; ')}`).toEqual([])
}

test('crea una propiedad y registra un arriendo en borrador a través de la UI real', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  // The one unavoidable non-UI step - see file header. Real signUp against
  // the real local Auth instance, never a manually-injected session/JWT.
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const signUp = await supabase.auth.signUp({ email: USER_EMAIL, password: USER_PASSWORD })
  expect(signUp.error, signUp.error?.message).toBeNull()
  expect(signUp.data.session, 'signUp did not return an immediate session (unexpected on a local stack).').not.toBeNull()

  // --- Login, real form ---
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(USER_EMAIL)
  await page.getByLabel('Contraseña').fill(USER_PASSWORD)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()

  // --- Bootstrap: a brand-new user lands on /bootstrap automatically (no Administration yet) ---
  await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible()
  await page.getByLabel('Nombre completo').fill(FULL_NAME)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  // --- Authenticated shell now reachable ---
  await expect(page.getByTestId('app-shell')).toBeVisible()

  // --- Create the property, real form ---
  await page.goto('/properties/new')
  await page.getByRole('button', { name: 'Casa o apartamento completo' }).click()
  await page.getByLabel('Nombre del inmueble').fill(PROPERTY_NAME)
  await page.getByLabel('Dirección').fill(PROPERTY_ADDRESS)
  await page.getByLabel('Ciudad').fill(PROPERTY_CITY)
  await page.getByRole('button', { name: 'Guardar inmueble' }).click()

  await page.waitForURL('**/properties')
  await expect(page.getByText(PROPERTY_NAME)).toBeVisible()

  // --- Create the rental draft, real form, selecting the just-created property ---
  await page.goto('/rentals/new')
  await page.getByRole('button', { name: 'Inmueble completo' }).click()
  await page.getByLabel('Activo a arrendar').selectOption({ label: PROPERTY_NAME })
  await page.getByLabel('Nombre completo').fill(TENANT_NAME)
  await page.getByRole('button', { name: 'Continuar' }).click()

  // --- Success step (optional invitation, never generated here) ---
  await expect(page.getByRole('heading', { name: '¡Arriendo creado!' })).toBeVisible()
  await page.getByRole('button', { name: 'Ir a arriendos' }).click()

  // --- Final assertion: property + tenant + DRAFT status together on the same card ---
  // RentalListCard (read directly from source) renders the subject-label
  // paragraph and the tenant-name paragraph as DIRECT children of the one
  // <Card> div, with the status Badge one level deeper inside - so the
  // card itself is exactly the title paragraph's parent. This is precise
  // and stable (tied to the actual JSX structure, not a CSS class name,
  // which is hashed by the production build this suite runs against).
  await page.waitForURL('**/rentals')
  const rentalCard = page.getByText(PROPERTY_NAME, { exact: true }).locator('xpath=..')
  await expect(rentalCard).toContainText(TENANT_NAME)
  await expect(rentalCard).toContainText('Borrador')

  expectNoPageErrors(pageErrors)
})

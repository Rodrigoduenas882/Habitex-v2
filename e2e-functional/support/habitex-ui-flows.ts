import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { expect, type Page } from '@playwright/test'
import { assertDisposableSupabaseStack } from '../../scripts/local-supabase-guard.mjs'

// Shared, reusable real-UI flows for Habitex's functional E2E suite.
// Extracted from the original create-property-and-rental.spec.ts (scenario
// #1) when scenario #2 (rental activation) needed the exact same
// signup/bootstrap/property-creation prelude, plus a second, independent
// rental draft against the SAME property - duplicating that logic inline
// in a second file would have been a real maintenance risk (two copies of
// the same real-money-path UI interactions silently drifting apart).
//
// Independent review (LOW, acknowledged - not "EXACTLY" preserved):
// moving this code was not purely mechanical, and two deliberate
// tightenings were introduced along the way, both intentional and both
// stricter (never looser) than scenario #1's original inline assertions:
//   1. createProperty's property-visibility check now uses
//      `getByText(name, { exact: true })`, where the original inline code
//      used a non-exact match. Harmless given every name here carries a
//      unique RUN_ID suffix, but it IS a behavior change, not a pure move.
//   2. findRentalCard's `.filter({ hasText: tenantName })` did not exist in
//      scenario #1's original inline locator - it is REQUIRED for scenario
//      #2 (two rental cards can legitimately share one property name), but
//      it also changes scenario #1's failure mode on a missing tenant from
//      a clear content-mismatch message to a generic locator timeout. See
//      expectRentalCardTenant below, added specifically to restore that
//      clearer diagnostic without removing the filter scenario #2 needs.

export interface DisposableStack {
  url: string
  publishableKey: string
}

/**
 * Reads and verifies the target Supabase stack from process env, the same
 * way scenario #1's spec file originally did at module scope. Call this
 * once, at module scope, in every spec file in this suite (top-level
 * await) - BEFORE any test in that file can run - as a second, independent
 * layer on top of playwright.e2e-functional.config.ts's own identical
 * check (which already gates webServer/build startup). Never assume the
 * config's check alone is enough if a spec file is ever invoked a
 * different way; never skip this to avoid "duplicating" it - the
 * duplication IS the defense-in-depth.
 */
export async function verifyDisposableStack(): Promise<DisposableStack> {
  const url = process.env.VITE_SUPABASE_URL ?? ''
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''

  await assertDisposableSupabaseStack({
    url,
    declaredPort: process.env.E2E_FUNCTIONAL_SUPABASE_PORT,
    sharedConfigTomlText: readFileSync('supabase/config.toml', 'utf8'),
  })
  if (!publishableKey) {
    throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is not set.')
  }

  return { url, publishableKey }
}

/**
 * Signs up a brand-new user via a direct, non-UI supabase.auth.signUp call
 * (deliberately bypassing the real public /signup form, which DOES exist -
 * see support/habitex-auth-flows.ts's signUpThroughRealFormAndBootstrap for
 * the real-UI version that specific suite exercises), then drives the real
 * login form and the real bootstrap form. Used here purely as fast test
 * setup for suites whose actual subject is something else (invitations,
 * rentals, payments) - never as a substitute for testing signup itself.
 * Leaves `page` on the authenticated shell (`app-shell` visible), with a
 * fresh Administration created.
 */
export async function signUpAndBootstrap(
  page: Page,
  stack: DisposableStack,
  { email, password, fullName }: { email: string; password: string; fullName: string },
): Promise<void> {
  const supabase = createClient(stack.url, stack.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const signUp = await supabase.auth.signUp({ email, password })
  expect(signUp.error, signUp.error?.message).toBeNull()
  expect(signUp.data.session, 'signUp did not return an immediate session (unexpected on a local stack).').not.toBeNull()

  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()

  // A brand-new user lands on /bootstrap automatically (no Administration yet).
  await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible()
  await page.getByLabel('Nombre completo').fill(fullName)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(page.getByTestId('app-shell')).toBeVisible()
}

/** Creates a FULL_PROPERTY property through the real /properties/new form. Leaves `page` on /properties, with the new property visible. */
export async function createProperty(
  page: Page,
  { name, address, city }: { name: string; address: string; city: string },
): Promise<void> {
  await page.goto('/properties/new')
  await page.getByRole('button', { name: 'Casa o apartamento completo' }).click()
  await page.getByLabel('Nombre del inmueble').fill(name)
  await page.getByLabel('Dirección').fill(address)
  await page.getByLabel('Ciudad').fill(city)
  await page.getByRole('button', { name: 'Guardar inmueble' }).click()

  await page.waitForURL('**/properties')
  await expect(page.getByText(name, { exact: true })).toBeVisible()
}

/**
 * Creates a rental draft against an EXISTING property (selected by its
 * exact, already-visible name) through the real /rentals/new form, with a
 * brand-new tenant. By default never generates an invitation (always takes
 * the "Ir a arriendos" escape hatch) - scenario #3 (tenant invitation) opts
 * into generating one via the optional `beforeContinue` hook below, invoked
 * right after "¡Arriendo creado!" becomes visible but BEFORE the escape
 * hatch is clicked, so it can drive AddRentalDraftInvitationStep's own
 * "Generar invitación"/link-reading UI without duplicating this function's
 * draft-creation steps (same reasoning as this file's own header comment on
 * why shared flows live here, not duplicated per spec file). Leaves `page`
 * on /rentals either way.
 */
export async function createRentalDraft(
  page: Page,
  {
    propertyName,
    tenantName,
    beforeContinue,
  }: { propertyName: string; tenantName: string; beforeContinue?: () => Promise<void> },
): Promise<void> {
  await page.goto('/rentals/new')
  await page.getByRole('button', { name: 'Inmueble completo' }).click()
  await page.getByLabel('Activo a arrendar').selectOption({ label: propertyName })
  await page.getByLabel('Nombre completo').fill(tenantName)
  await page.getByRole('button', { name: 'Continuar' }).click()

  await expect(page.getByRole('heading', { name: '¡Arriendo creado!' })).toBeVisible()
  if (beforeContinue) {
    await beforeContinue()
  }
  await page.getByRole('button', { name: 'Ir a arriendos' }).click()
  await page.waitForURL('**/rentals')
}

/**
 * Locates the one rental card identified by BOTH its property name and
 * tenant name (both expected to be globally unique per test run) - see the
 * original scenario #1 comment for why `xpath=..` is precise here:
 * RentalListCard renders the subject-label paragraph and the tenant-name
 * paragraph as DIRECT children of the one <Card> div (read directly from
 * src/features/rentals/presentation/RentalListCard.tsx), with the status
 * Badge one level deeper inside - so the card itself is exactly the title
 * paragraph's parent. Not a CSS class name, which is hashed by the
 * production build this suite runs against.
 */
export function findRentalCard(page: Page, propertyName: string, tenantName: string) {
  return page
    .getByText(propertyName, { exact: true })
    .locator('xpath=..')
    .filter({ hasText: tenantName })
}

/**
 * Independent review (LOW, fixed): `findRentalCard`'s `.filter({hasText:
 * tenantName})` is necessary (two rentals can share one property name in
 * scenario #2) but means a genuinely-missing tenant now times out on an
 * empty locator instead of failing with a clear "expected this text"
 * message. Call this right after `findRentalCard` wherever a clear,
 * specific diagnostic matters (restores scenario #1's original failure
 * clarity) - it asserts the exact same thing `.filter` already requires to
 * match anything, just with a named, readable failure message instead of a
 * bare timeout.
 */
export async function expectRentalCardTenant(card: ReturnType<typeof findRentalCard>, tenantName: string): Promise<void> {
  await expect(
    card,
    `Expected to find a rental card showing tenant "${tenantName}" - none matched (the property name may be ` +
      'right but no card for this specific tenant exists, or the card never rendered).',
  ).toContainText(tenantName)
}

/**
 * Completes a DRAFT rental's required schedule+financial terms through the
 * real /rentals/:id/terms form, starting from the one specific rental
 * card identified by property+tenant (never a hardcoded/guessed relationship
 * id). Only fills the fields the backend actually requires
 * (RENTAL_TERMS_INCOMPLETE/INITIAL_TERM_VERSION_REQUIRED - see
 * activate_rental_relationship) - paymentTiming/administrationMode keep
 * their already-valid defaults, utilitiesMode stays unset. Leaves `page` on
 * /rentals after a successful save (RentalTermsPage's own onSuccess
 * navigation).
 */
export async function completeRentalTerms(
  page: Page,
  {
    propertyName,
    tenantName,
    realStartDate,
    paymentDay,
    rentAmount,
  }: { propertyName: string; tenantName: string; realStartDate: string; paymentDay: string; rentAmount: string },
): Promise<void> {
  const card = findRentalCard(page, propertyName, tenantName)
  await card.getByRole('button', { name: 'Completar términos' }).click()
  await page.waitForURL('**/terms')
  // Independent review/self-caught (not a product defect): the i18n key
  // `termsForm.title` ("Términos del arriendo") is defined but never
  // actually rendered by RentalTermsPage.tsx - the page's own <h1> is the
  // rental's identity header (property name, via RentalContextHeader), not
  // this key. Confirmed by reading the real page snapshot. "Fechas y pago"
  // (an actual, always-rendered level-2 heading unique to this page) is
  // what's really there.
  await expect(page.getByRole('heading', { name: 'Fechas y pago' })).toBeVisible()

  await page.getByLabel('Fecha real de inicio').fill(realStartDate)
  await page.getByLabel('Fecha de inicio de seguimiento').fill(realStartDate)
  await page.getByLabel('Día de pago').fill(paymentDay)
  await page.getByLabel('Valor del arriendo').fill(rentAmount)
  await page.getByRole('button', { name: 'Guardar términos' }).click()

  await page.waitForURL('**/rentals')
}

export function expectNoPageErrors(pageErrors: Error[]) {
  expect(pageErrors, `Unexpected page error(s): ${pageErrors.map((e) => e.message).join('; ')}`).toEqual([])
}

import { createClient } from '@supabase/supabase-js'
import { expect, type Page } from '@playwright/test'
import type { DisposableStack } from './habitex-ui-flows.js'

// Invitation-specific real-UI flows for scenario #3 (tenant invitation and
// linking). Kept separate from habitex-ui-flows.ts (used only by this
// scenario's own spec file, unlike signUpAndBootstrap/createProperty/etc.,
// which scenarios #1 and #2 both need) - see that file's own header comment
// for when shared extraction is warranted versus premature.
//
// There is no mocked/real email service anywhere to drive here: the
// product itself never sends the invitation - the admin's own UI renders
// the raw link in a readonly <Input>, which is exactly what these helpers
// read from the DOM, never bypassing it.

/**
 * Reads the invitation link straight from AddRentalDraftInvitationStep's own
 * readonly <Input label="Enlace de invitación">, after clicking "Generar
 * invitación para el inquilino". Call this from createRentalDraft's
 * `beforeContinue` hook, while still on the "¡Arriendo creado!" screen.
 */
export async function generateInvitationLink(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Generar invitación para el inquilino' }).click()

  const linkInput = page.getByLabel('Enlace de invitación')
  await expect(linkInput).toBeVisible()
  const link = await linkInput.inputValue()
  expect(link, 'Expected create_tenant_invitation to produce a real /invitations/<token> link').toContain(
    '/invitations/',
  )
  return link
}

/**
 * Opens an invitation link on an ALREADY-INDEPENDENT page (the caller is
 * responsible for creating a fresh `browser.newContext()` whenever this
 * must be isolated from an admin's own session - see this scenario's spec
 * file for where that isolation actually matters) and signs up a brand-new
 * tenant account through InvitationClaimPage's real "Crear cuenta" tab.
 * Leaves `page` authenticated, on the claim screen ("Aceptar invitación"
 * heading visible), token NOT yet claimed - the caller decides when to
 * click accept (see acceptInvitation below).
 */
export async function openInvitationAndSignUp(
  page: Page,
  invitationLink: string,
  { email, password }: { email: string; password: string },
): Promise<void> {
  await page.goto(invitationLink)

  await expect(page.getByRole('heading', { name: 'Únete a Habitex' })).toBeVisible()
  await page.getByRole('tab', { name: 'Crear cuenta' }).click()
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(page.getByRole('heading', { name: 'Aceptar invitación' })).toBeVisible()
}

/** Clicks the real "Aceptar invitación" button - claim_tenant_invitation's only entry point. */
export async function acceptInvitation(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Aceptar invitación' }).click()
}

/**
 * Independent review (LOW, fixed): factors out the createClient +
 * signInWithPassword boilerplate shared by readVisibleRentalRelationships
 * and readOwnAccountLink below - both need a fresh client authenticated as
 * one specific tenant (anon key + that tenant's own real credentials),
 * never service_role, never the admin's session.
 */
async function signInAsTenant(stack: DisposableStack, credentials: { email: string; password: string }) {
  const supabase = createClient(stack.url, stack.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const signIn = await supabase.auth.signInWithPassword(credentials)
  expect(signIn.error, signIn.error?.message).toBeNull()
  return supabase
}

/**
 * Independent, read-only verification using the TENANT's own real,
 * authenticated session. Mirrors supabaseRentalRepository.listByAdministration's
 * own real column shape (id, administration_id, status), just without an
 * `.eq('administration_id', ...)` filter: RLS (`rental_relationships_select`
 * -> can_view_relationship) alone decides what comes back, which is exactly
 * the point of this check (there is no dedicated tenant-facing UI to drive
 * instead - see the scenario #3 diagnostic).
 */
export async function readVisibleRentalRelationships(
  stack: DisposableStack,
  credentials: { email: string; password: string },
): Promise<Array<{ id: string; administrationId: string; status: string }>> {
  const supabase = await signInAsTenant(stack, credentials)

  const { data, error } = await supabase.from('rental_relationships').select('id, administration_id, status')
  expect(error, error?.message).toBeNull()

  return (data ?? []).map((row) => ({
    id: row.id as string,
    administrationId: row.administration_id as string,
    status: row.status as string,
  }))
}

/**
 * Independent, read-only verification of `accounts` (accounts_select_self
 * RLS: `auth_user_id = auth.uid()`), using the tenant's own real session -
 * same precedent as readVisibleRentalRelationships above. Returns null when
 * no accounts row exists yet (a claim never happened, or failed before
 * inserting one) - a legitimate, expected outcome for the negative
 * scenarios, not an error.
 */
export async function readOwnAccountLink(
  stack: DisposableStack,
  credentials: { email: string; password: string },
): Promise<{ personId: string; status: string } | null> {
  const supabase = await signInAsTenant(stack, credentials)

  const { data, error } = await supabase.from('accounts').select('person_id, status').maybeSingle()
  expect(error, error?.message).toBeNull()

  return data ? { personId: data.person_id as string, status: data.status as string } : null
}

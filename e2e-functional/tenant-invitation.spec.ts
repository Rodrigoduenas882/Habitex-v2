import { expect, test } from '@playwright/test'
import {
  acceptInvitation,
  generateInvitationLink,
  openInvitationAndSignUp,
  readOwnAccountLink,
  readVisibleRentalRelationships,
} from './support/habitex-invitation-flows.js'
import {
  createProperty,
  createRentalDraft,
  expectNoPageErrors,
  signUpAndBootstrap,
  verifyDisposableStack,
} from './support/habitex-ui-flows.js'

// Tenant invitation and linking (create_tenant_invitation / claim_tenant_invitation)
// through the REAL UI, against a disposable, isolated local Supabase stack -
// never the shared dev stack, never remote. Every business action (invitation
// generation, signup, claim) is driven through the actual app forms/buttons -
// the only non-UI step is the independent, read-only RLS verification against
// `accounts`/`rental_relationships`, performed exclusively with each tenant's
// own real, authenticated session (never service_role, never an admin
// session) - there is no dedicated tenant-facing UI to drive instead (see
// the scenario #3 diagnostic: the backend already scopes a tenant's access
// correctly, the frontend simply has no view that reads it back yet).
//
// There is no mocked/real email service anywhere to stand up: the product
// itself never sends the invitation - the admin's own UI renders the raw
// link in a readonly <Input>, which is exactly what these tests read.
//
// Each test signs up its OWN brand-new accounts (unique email/RUN_ID) and
// creates its own property/draft(s)/invitation - no shared fixtures, no
// order dependency, no reuse of data across tests or across this suite's
// other spec files. Admin and tenant sessions are always separate browser
// contexts - never the same cookies/storage.

const stack = await verifyDisposableStack()

function uniqueRunId() {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}

test('vincula a un inquilino mediante una invitación real y aísla su acceso por RLS', async ({ page, browser }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const RUN_ID = uniqueRunId()
  const OWNER_A_EMAIL = `e2e-invite-ownerA-${RUN_ID}@habitex.test`
  const OWNER_A_PASSWORD = `Habitex-E2E-InviteOwnerA-${RUN_ID}!`
  const OWNER_B_EMAIL = `e2e-invite-ownerB-${RUN_ID}@habitex.test`
  const OWNER_B_PASSWORD = `Habitex-E2E-InviteOwnerB-${RUN_ID}!`
  const TENANT_EMAIL = `e2e-invite-tenant-${RUN_ID}@habitex.test`
  const TENANT_PASSWORD = `Habitex-E2E-InviteTenant-${RUN_ID}!`
  const PROPERTY_A = `Apartamento Invitación A ${RUN_ID}`
  const PROPERTY_B = `Apartamento Invitación B ${RUN_ID}`
  const TENANT_NAME_A = `Inquilino Invitado ${RUN_ID}`
  const TENANT_NAME_B = `Inquilino Ajeno ${RUN_ID}`

  // --- Administración A: propiedad + borrador + invitación real, generada e inspeccionada desde la UI ---
  await signUpAndBootstrap(page, stack, {
    email: OWNER_A_EMAIL,
    password: OWNER_A_PASSWORD,
    fullName: 'Propietaria E2E Invitación A',
  })
  await createProperty(page, { name: PROPERTY_A, address: 'Calle 70 # 80-90', city: 'Bogotá' })

  let invitationLink = ''
  await createRentalDraft(page, {
    propertyName: PROPERTY_A,
    tenantName: TENANT_NAME_A,
    beforeContinue: async () => {
      invitationLink = await generateInvitationLink(page)
    },
  })
  expect(invitationLink, 'Expected a real invitation link to have been read from the admin UI').not.toBe('')

  // --- Administración B (ajena): segunda propiedad + borrador, sin ninguna
  // relación con el inquilino invitado arriba - únicamente "ruido" real
  // para que la prueba de aislamiento RLS no dependa de una base de datos
  // vacía (ver diagnóstico: evitar falsos positivos de RLS). ---
  const administrationBContext = await browser.newContext()
  const administrationBPage = await administrationBContext.newPage()
  administrationBPage.on('pageerror', (error) => {
    pageErrors.push(error)
  })
  await signUpAndBootstrap(administrationBPage, stack, {
    email: OWNER_B_EMAIL,
    password: OWNER_B_PASSWORD,
    fullName: 'Propietaria E2E Invitación B',
  })
  await createProperty(administrationBPage, { name: PROPERTY_B, address: 'Calle 100 # 10-20', city: 'Cartagena' })
  await createRentalDraft(administrationBPage, { propertyName: PROPERTY_B, tenantName: TENANT_NAME_B })
  await administrationBContext.close()

  // --- Inquilino: abre el enlace en un contexto Playwright independiente
  // (nunca el del administrador), se registra con Supabase Auth real a
  // través de la pestaña "Crear cuenta" y acepta la invitación. ---
  const tenantContext = await browser.newContext()
  const tenantPage = await tenantContext.newPage()
  tenantPage.on('pageerror', (error) => {
    pageErrors.push(error)
  })
  await openInvitationAndSignUp(tenantPage, invitationLink, { email: TENANT_EMAIL, password: TENANT_PASSWORD })
  await acceptInvitation(tenantPage)

  // Redirige a '/' tras el claim exitoso. No existe un portal de inquilino
  // dedicado (ver diagnóstico) - el Dashboard muestra su estado genérico
  // "sin administración", que es precisamente la evidencia de que la cuenta
  // quedó autenticada y vinculada, sin membresía de administración alguna.
  await expect(tenantPage.getByText('Todavía no tienes una administración')).toBeVisible()

  // --- Verificación de vinculación: accounts.person_id vía la sesión real
  // del inquilino (RLS accounts_select_self), nunca service_role. ---
  const linkedAccount = await readOwnAccountLink(stack, { email: TENANT_EMAIL, password: TENANT_PASSWORD })
  expect(linkedAccount, 'Expected claim_tenant_invitation to have linked a real accounts row').not.toBeNull()
  expect(linkedAccount?.status).toBe('ACTIVE')

  // --- Verificación de aislamiento RLS: el inquilino lee exactamente su
  // propia relación de arriendo (la de la Administración A) y NUNCA la de
  // la Administración B, que existe realmente en la base de datos. ---
  const visibleRelationships = await readVisibleRentalRelationships(stack, {
    email: TENANT_EMAIL,
    password: TENANT_PASSWORD,
  })
  expect(
    visibleRelationships,
    'Expected exactly the tenant\'s own relationship to be visible - never the unrelated Administration B one',
  ).toHaveLength(1)
  expect(visibleRelationships[0]?.status).toBe('DRAFT')

  await tenantContext.close()
  expectNoPageErrors(pageErrors)
})

test('rechaza un token de invitación inexistente y no crea ninguna vinculación', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const RUN_ID = uniqueRunId()
  const TENANT_EMAIL = `e2e-invite-invalid-${RUN_ID}@habitex.test`
  const TENANT_PASSWORD = `Habitex-E2E-InviteInvalid-${RUN_ID}!`
  const fakeInvitationLink = `/invitations/not-a-real-token-${RUN_ID}`

  // Ningún administrador generó este enlace - el token es enteramente
  // inventado. El registro del inquilino sí es real (Supabase Auth real),
  // únicamente el token es falso.
  await openInvitationAndSignUp(page, fakeInvitationLink, { email: TENANT_EMAIL, password: TENANT_PASSWORD })
  await acceptInvitation(page)

  await expect(page.getByText('Este enlace de invitación no es válido.')).toBeVisible()

  const linkedAccount = await readOwnAccountLink(stack, { email: TENANT_EMAIL, password: TENANT_PASSWORD })
  expect(linkedAccount, 'A rejected claim (invalid token) must never create an accounts row').toBeNull()

  expectNoPageErrors(pageErrors)
})

test('rechaza el reclamo repetido de una invitación ya utilizada y preserva la vinculación original', async ({
  page,
  browser,
}) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const RUN_ID = uniqueRunId()
  const OWNER_EMAIL = `e2e-invite-reuse-owner-${RUN_ID}@habitex.test`
  const OWNER_PASSWORD = `Habitex-E2E-InviteReuseOwner-${RUN_ID}!`
  const TENANT_A_EMAIL = `e2e-invite-reuse-tenantA-${RUN_ID}@habitex.test`
  const TENANT_A_PASSWORD = `Habitex-E2E-InviteReuseTenantA-${RUN_ID}!`
  const TENANT_B_EMAIL = `e2e-invite-reuse-tenantB-${RUN_ID}@habitex.test`
  const TENANT_B_PASSWORD = `Habitex-E2E-InviteReuseTenantB-${RUN_ID}!`
  const PROPERTY_NAME = `Apartamento Invitación Reutilizada ${RUN_ID}`
  const TENANT_NAME = `Inquilino Reutilizado ${RUN_ID}`

  await signUpAndBootstrap(page, stack, {
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    fullName: 'Propietaria E2E Invitación Reutilizada',
  })
  await createProperty(page, { name: PROPERTY_NAME, address: 'Calle 40 # 50-60', city: 'Pereira' })

  let invitationLink = ''
  await createRentalDraft(page, {
    propertyName: PROPERTY_NAME,
    tenantName: TENANT_NAME,
    beforeContinue: async () => {
      invitationLink = await generateInvitationLink(page)
    },
  })
  expect(invitationLink).not.toBe('')

  // --- Inquilino A: reclama la invitación correctamente, en su propio contexto. ---
  const tenantAContext = await browser.newContext()
  const tenantAPage = await tenantAContext.newPage()
  tenantAPage.on('pageerror', (error) => {
    pageErrors.push(error)
  })
  await openInvitationAndSignUp(tenantAPage, invitationLink, { email: TENANT_A_EMAIL, password: TENANT_A_PASSWORD })
  await acceptInvitation(tenantAPage)
  await expect(tenantAPage.getByText('Todavía no tienes una administración')).toBeVisible()

  const linkedAccountABefore = await readOwnAccountLink(stack, { email: TENANT_A_EMAIL, password: TENANT_A_PASSWORD })
  expect(linkedAccountABefore, 'Expected the first claim to have linked a real accounts row').not.toBeNull()

  // --- Inquilino B: segunda cuenta independiente, totalmente distinta de A,
  // intenta reclamar el MISMO enlace después de que ya fue usado. ---
  const tenantBContext = await browser.newContext()
  const tenantBPage = await tenantBContext.newPage()
  tenantBPage.on('pageerror', (error) => {
    pageErrors.push(error)
  })
  await openInvitationAndSignUp(tenantBPage, invitationLink, { email: TENANT_B_EMAIL, password: TENANT_B_PASSWORD })
  await acceptInvitation(tenantBPage)
  await expect(tenantBPage.getByText('Esta invitación ya fue utilizada.')).toBeVisible()

  // El segundo intento, rechazado, nunca debe crear una vinculación para B.
  const linkedAccountB = await readOwnAccountLink(stack, { email: TENANT_B_EMAIL, password: TENANT_B_PASSWORD })
  expect(linkedAccountB, 'A rejected re-claim (already used) must never create an accounts row for the second account').toBeNull()

  // La vinculación original de A debe permanecer exactamente igual (mismo person_id, misma cuenta ACTIVE).
  const linkedAccountAAfter = await readOwnAccountLink(stack, { email: TENANT_A_EMAIL, password: TENANT_A_PASSWORD })
  expect(linkedAccountAAfter?.personId).toBe(linkedAccountABefore?.personId)
  expect(linkedAccountAAfter?.status).toBe('ACTIVE')

  await tenantAContext.close()
  await tenantBContext.close()
  expectNoPageErrors(pageErrors)
})

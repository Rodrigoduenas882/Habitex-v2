import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import {
  getPasswordRecoveryHashFromEmail,
  loginThroughRealForm,
  openResetPasswordWithRecoveryHash,
  requestPasswordResetThroughRealForm,
  signUpThroughRealFormAndBootstrap,
  submitNewPasswordThroughRealForm,
} from './support/habitex-auth-flows.js'
import { expectNoPageErrors, verifyDisposableStack } from './support/habitex-ui-flows.js'

// Covers the two public-auth gaps the MVP-closure audit found: owner
// self-registration (no UI form existed at all before this change) and
// password recovery (same). Against a disposable, isolated local Supabase
// stack only - never the shared dev stack, never remote - same convention
// as every other spec in this suite.
//
// GoTrue's own /auth/v1/verify endpoint redirects to supabase/config.toml's
// site_url (http://127.0.0.1:3000 on this stack), which nothing serves
// locally. Fixing that would mean editing that config file and restarting
// the disposable stack - both explicitly out of scope for this change (see
// habitex-auth-flows.ts's own doc comment on getPasswordRecoveryHashFromEmail
// for the full reasoning). Instead, the real session tokens GoTrue issues
// are extracted from that redirect's own URL hash fragment (by following
// the redirect manually, server-side, never in the browser) and attached
// to THIS suite's own baseURL - this is still Supabase's real implicit-flow
// mechanism end to end, just pointed at the app under test instead of an
// unreachable port.

const stack = await verifyDisposableStack()

function uniqueRunId() {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}

test('un propietario nuevo se registra desde /signup, crea su administración y activa el trial de 14 días', async ({
  page,
}) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const RUN_ID = uniqueRunId()
  const EMAIL = `e2e-signup-${RUN_ID}@habitex.test`
  const PASSWORD = `Habitex-E2E-Signup-${RUN_ID}!`
  const FIRST_NAME = 'Propietario'
  const LAST_NAME = `Nuevo ${RUN_ID}`

  await signUpThroughRealFormAndBootstrap(page, {
    email: EMAIL,
    password: PASSWORD,
    firstName: FIRST_NAME,
    lastName: LAST_NAME,
  })

  // Independent, read-only verification using the owner's own real,
  // authenticated session - never service_role. RLS
  // (administration_subscriptions_select -> is_administration_member)
  // alone decides what comes back.
  const supabase = createClient(stack.url, stack.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const signIn = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  expect(signIn.error, signIn.error?.message).toBeNull()

  // Confirms the actual mechanism Stage 1 relies on end to end: signUp's
  // fullName option really did persist into auth.users' own user_metadata,
  // not just into this test's in-memory expectations.
  const getUser = await supabase.auth.getUser()
  expect(getUser.error, getUser.error?.message).toBeNull()
  expect(getUser.data.user?.user_metadata['full_name']).toBe(`${FIRST_NAME} ${LAST_NAME}`)

  const { data, error } = await supabase
    .from('administration_subscriptions')
    .select('status, plan_code, trial_started_at, trial_ends_at, management_access_until')
    .maybeSingle()
  expect(error, error?.message).toBeNull()

  expect(data?.status).toBe('TRIALING')
  expect(data?.plan_code).toBe('TRIAL')
  expect(data?.trial_started_at).toBeTruthy()
  expect(data?.trial_ends_at).toBeTruthy()
  expect(data?.management_access_until).toBeTruthy()
  const trialStarted = new Date(data?.trial_started_at as string).getTime()
  const trialEnds = new Date(data?.trial_ends_at as string).getTime()
  const managementAccessUntil = new Date(data?.management_access_until as string).getTime()
  const ONE_DAY_MS = 24 * 60 * 60 * 1000
  expect(Math.round((trialEnds - trialStarted) / ONE_DAY_MS)).toBe(14)
  expect(Math.round((managementAccessUntil - trialStarted) / ONE_DAY_MS)).toBe(44)

  // bootstrap_account persisted the name /signup actually captured into
  // people.full_name (not just auth.users' own user_metadata, already
  // checked above) - this is what the auto-provisioning path (no form, no
  // manual confirmation) is actually trusted to have carried through.
  const { data: personRow, error: personError } = await supabase.from('people').select('full_name').maybeSingle()
  expect(personError, personError?.message).toBeNull()
  expect(personRow?.full_name).toBe(`${FIRST_NAME} ${LAST_NAME}`)

  // Exactly one OWNER membership, on one Administration - the auto-fired
  // bootstrap_account call must not have run twice under the hood.
  const { data: membershipsAfterSignup, error: membershipsError } = await supabase
    .from('administration_members')
    .select('administration_id, role, status')
  expect(membershipsError, membershipsError?.message).toBeNull()
  expect(membershipsAfterSignup).toHaveLength(1)
  expect(membershipsAfterSignup?.[0]?.role).toBe('OWNER')
  expect(membershipsAfterSignup?.[0]?.status).toBe('ACTIVE')
  const administrationId = membershipsAfterSignup?.[0]?.administration_id as string

  // A reload mid-session must never re-run bootstrap_account - RLS-scoped
  // membership count must stay exactly 1, same Administration.
  await page.reload()
  await expect(page.getByTestId('app-shell')).toBeVisible()
  await expect(page).not.toHaveURL(/\/bootstrap/)
  const { data: membershipsAfterReload, error: reloadError } = await supabase
    .from('administration_members')
    .select('administration_id')
  expect(reloadError, reloadError?.message).toBeNull()
  expect(membershipsAfterReload).toHaveLength(1)
  expect(membershipsAfterReload?.[0]?.administration_id).toBe(administrationId)

  // Signing out and back in must never repeat configuration (/bootstrap)
  // or duplicate the Administration either.
  await page.getByLabel('Menú de usuario').click()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await loginThroughRealForm(page, { email: EMAIL, password: PASSWORD })
  await expect(page).not.toHaveURL(/\/bootstrap/)
  const { data: membershipsAfterRelogin, error: reloginError } = await supabase
    .from('administration_members')
    .select('administration_id')
  expect(reloginError, reloginError?.message).toBeNull()
  expect(membershipsAfterRelogin).toHaveLength(1)
  expect(membershipsAfterRelogin?.[0]?.administration_id).toBe(administrationId)

  expectNoPageErrors(pageErrors)
})

test('recupera su contraseña desde /forgot-password, abre el enlace real del correo e inicia sesión con la nueva contraseña', async ({
  page,
}) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const RUN_ID = uniqueRunId()
  const EMAIL = `e2e-recovery-${RUN_ID}@habitex.test`
  const OLD_PASSWORD = `Habitex-E2E-Recovery-Old-${RUN_ID}!`
  const NEW_PASSWORD = `Habitex-E2E-Recovery-New-${RUN_ID}!`

  await signUpThroughRealFormAndBootstrap(page, {
    email: EMAIL,
    password: OLD_PASSWORD,
    firstName: 'Propietario',
    lastName: `Recuperacion ${RUN_ID}`,
  })

  // A real visitor requesting recovery is signed OUT on this browser (that
  // is the whole reason they need recovery) - /forgot-password is wrapped
  // in RedirectIfAuthenticated (router.tsx), same as /login, so staying
  // signed in here would bounce straight back to the dashboard instead.
  // Pre-existing, unrelated to this change: "Cerrar sesión" lives inside
  // AppShell's floating user menu (a native <details>/<summary>), never
  // reachable until that menu is actually opened - this call was timing
  // out against the real app regardless of any change here.
  await page.getByLabel('Menú de usuario').click()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await requestPasswordResetThroughRealForm(page, EMAIL)

  const hashFragment = await getPasswordRecoveryHashFromEmail(EMAIL)
  await openResetPasswordWithRecoveryHash(page, hashFragment)
  await submitNewPasswordThroughRealForm(page, NEW_PASSWORD)

  // Lands on /login (never /bootstrap or the dashboard - the recovery
  // session is signed out immediately after the password update, see
  // useUpdatePassword's own doc comment).
  await expect(page).toHaveURL(/\/login$/)

  // The OLD password must no longer work.
  await page.getByLabel('Correo electrónico').fill(EMAIL)
  await page.getByLabel('Contraseña').fill(OLD_PASSWORD)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page.getByText('El correo o la contraseña no son correctos.')).toBeVisible()

  // The NEW password does.
  await loginThroughRealForm(page, { email: EMAIL, password: NEW_PASSWORD })

  expectNoPageErrors(pageErrors)
})

test('cuando el aprovisionamiento automático falla, el formulario de /bootstrap aparece con el nombre precargado editable, y lo que el dueño deja ahí es lo que persiste', async ({
  page,
}) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const RUN_ID = uniqueRunId()
  const EMAIL = `e2e-signup-edit-${RUN_ID}@habitex.test`
  const PASSWORD = `Habitex-E2E-SignupEdit-${RUN_ID}!`
  const CORRECTED_NAME = `Propietario Corregido ${RUN_ID}`

  // A self-registered owner never sees /bootstrap's form on the happy path
  // (BootstrapAccountPage auto-provisions with /signup's own captured name
  // the instant it mounts - see that component's own doc comment) - so the
  // only real way left to exercise "the pre-filled name is still editable,
  // and whatever is left there persists" is the automatic attempt's own
  // error-fallback path. This forces exactly that: the FIRST call to
  // bootstrap_account (the automatic one) fails, the real one after the
  // owner edits+resubmits goes through unmodified.
  let bootstrapCalls = 0
  await page.route('**/rest/v1/rpc/bootstrap_account', async (route) => {
    bootstrapCalls += 1
    if (bootstrapCalls === 1) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'simulated failure for e2e verification', code: 'E2E_SIMULATED_FAILURE' }),
      })
      return
    }
    await route.continue()
  })

  await page.goto('/signup')
  await page.getByLabel('Nombres').fill('Propietaria')
  await page.getByLabel('Apellidos').fill(`Con Error De Tipeo ${RUN_ID}`)
  await page.getByLabel('Correo electrónico').fill(EMAIL)
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Confirma tu contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  // The automatic attempt's failure revealed the fallback form, pre-filled
  // from the same /signup metadata the automatic attempt itself used.
  await expect(page.getByText('No pudimos crear tu cuenta. Intenta de nuevo.')).toBeVisible()
  const nameInput = page.getByLabel('Nombre completo')
  await expect(nameInput).toHaveValue(`Propietaria Con Error De Tipeo ${RUN_ID}`)
  await nameInput.fill(CORRECTED_NAME)
  await page.getByRole('button', { name: 'Continuar' }).click()

  await expect(page.getByTestId('app-shell')).toBeVisible()
  expect(bootstrapCalls).toBe(2)

  const supabase = createClient(stack.url, stack.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const signIn = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  expect(signIn.error, signIn.error?.message).toBeNull()

  // bootstrap_account persists whatever the owner actually submitted
  // (people.full_name), never the stale user_metadata value from signup -
  // confirmed via the owner's own real, authenticated session.
  const { data, error } = await supabase.from('people').select('full_name').maybeSingle()
  expect(error, error?.message).toBeNull()
  expect(data?.full_name).toBe(CORRECTED_NAME)

  expectNoPageErrors(pageErrors)
})

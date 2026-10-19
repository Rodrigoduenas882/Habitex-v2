import { expect, type Page } from '@playwright/test'

/**
 * Drives the REAL public /signup form - the exact gap the MVP-closure audit
 * found (every other spec in this suite's signUpAndBootstrap, in
 * habitex-ui-flows.ts, deliberately bypasses this form via a direct
 * supabase.auth.signUp call; that doc comment is now stale and gets fixed
 * alongside this file). Assumes signUp returns an immediate session (true
 * on every local/disposable stack - enable_confirmations is false in
 * supabase/config.toml), landing on /bootstrap exactly like
 * signUpAndBootstrap's own second half.
 */
export async function signUpThroughRealFormAndBootstrap(
  page: Page,
  { email, password, fullName }: { email: string; password: string; fullName: string },
): Promise<void> {
  await page.goto('/signup')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible()
  await page.getByLabel('Nombre completo').fill(fullName)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(page.getByTestId('app-shell')).toBeVisible()
}

/** Drives the real /login form, for an account that already has an Administration. */
export async function loginThroughRealForm(
  page: Page,
  { email, password }: { email: string; password: string },
): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()

  await expect(page.getByTestId('app-shell')).toBeVisible()
}

/** Drives the real /forgot-password form. Never asserts anything about whether the email exists - see that page's own doc comment on why. */
export async function requestPasswordResetThroughRealForm(page: Page, email: string): Promise<void> {
  await page.goto('/forgot-password')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByRole('button', { name: 'Enviar instrucciones' }).click()

  await expect(page.getByText('Revisa tu correo')).toBeVisible()
}

function requireMailpitUrl(): string {
  const url = process.env.E2E_FUNCTIONAL_MAILPIT_URL
  if (!url) {
    throw new Error(
      'E2E_FUNCTIONAL_MAILPIT_URL is not set - needed to read the real recovery email from the disposable ' +
        "stack's own Mailpit instance. Deliberately NOT derived from VITE_SUPABASE_URL by a guessed port " +
        'offset - this project never assumes infrastructure topology it has not explicitly verified (same ' +
        'philosophy as E2E_FUNCTIONAL_SUPABASE_PORT in local-supabase-guard.mjs). Set it to the stack\'s own ' +
        "Mailpit/Inbucket URL, e.g. http://127.0.0.1:55324 (from `supabase status -o env`'s MAILPIT_URL).",
    )
  }
  return url
}

interface MailpitSearchResult {
  messages: Array<{ ID: string }>
}

interface MailpitMessage {
  Text: string
}

/**
 * Polls Mailpit (retries: SMTP delivery into it is asynchronous relative to
 * the resetPasswordForEmail call that triggered it) for the newest message
 * to `email`, then extracts GoTrue's own /auth/v1/verify link from the
 * plain-text body.
 */
async function readLatestVerifyLink(email: string): Promise<string> {
  const mailpitUrl = requireMailpitUrl()
  const deadline = Date.now() + 15_000

  while (Date.now() < deadline) {
    const searchResponse = await fetch(`${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
    const searchResult = (await searchResponse.json()) as MailpitSearchResult

    const latestMessage = searchResult.messages[0]
    if (latestMessage) {
      const messageResponse = await fetch(`${mailpitUrl}/api/v1/message/${latestMessage.ID}`)
      const message = (await messageResponse.json()) as MailpitMessage
      const match = /https?:\/\/\S*\/auth\/v1\/verify\?\S*/.exec(message.Text)
      if (match) {
        return match[0]
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`No recovery email arrived for ${email} within the polling window.`)
}

/**
 * GoTrue's own verify endpoint issues a 303 redirect to whatever
 * `site_url`/`redirectTo` it was configured with (supabase/config.toml's
 * site_url on this disposable stack, http://127.0.0.1:3000 - nothing
 * actually serves that locally, and this suite must never need to touch
 * that config file or restart the disposable stack to fix it, see this
 * spec file's own module-level doc comment for the full reasoning). The
 * session tokens GoTrue issues are carried entirely in that redirect's URL
 * hash fragment, independent of which origin/path ends up reading them -
 * so this follows the redirect manually (never letting a browser actually
 * navigate to the unreachable port) and hands back just the fragment, for
 * the caller to attach to this suite's OWN baseURL instead.
 */
export async function getPasswordRecoveryHashFromEmail(email: string): Promise<string> {
  const verifyLink = await readLatestVerifyLink(email)
  const response = await fetch(verifyLink, { redirect: 'manual' })
  const location = response.headers.get('location')
  if (!location) {
    throw new Error(`GoTrue's /auth/v1/verify did not return a redirect Location for ${email}.`)
  }

  const hashIndex = location.indexOf('#')
  if (hashIndex === -1) {
    throw new Error(`GoTrue's redirect had no hash fragment (link already used, or an error instead): ${location}`)
  }
  return location.slice(hashIndex)
}

/**
 * Navigates straight to /reset-password with the real recovery hash
 * attached - this IS Supabase's actual client-side mechanism (implicit
 * flow: GoTrue never cares which origin reads the fragment, only this
 * suite's own webServer needs to be the one serving /reset-password, which
 * baseURL already guarantees), not a bypass of it.
 */
export async function openResetPasswordWithRecoveryHash(page: Page, hashFragment: string): Promise<void> {
  await page.goto(`/reset-password${hashFragment}`)
  await expect(page.getByLabel('Nueva contraseña', { exact: true })).toBeVisible()
}

/** Drives the real "set a new password" form at /reset-password. */
export async function submitNewPasswordThroughRealForm(page: Page, newPassword: string): Promise<void> {
  await page.getByLabel('Nueva contraseña', { exact: true }).fill(newPassword)
  await page.getByLabel('Confirma tu nueva contraseña').fill(newPassword)
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()

  await expect(page.getByText('Tu contraseña se actualizó. Ingresa con tu nueva contraseña.')).toBeVisible()
}

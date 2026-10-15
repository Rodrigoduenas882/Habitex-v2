import { mkdirSync } from 'node:fs'
import { expect, test as setup } from '@playwright/test'

// Real authentication through the actual /login form - the same
// application/session path the product uses, never a manually-injected
// JWT/session. Requires scripts/e2e-local-seed.mjs to have already created
// this user against the local Supabase stack.

const authFile = 'e2e-authenticated/.auth/user.json'

setup('authenticate via the real login form', async ({ page }) => {
  const email = process.env.E2E_LOCAL_USER_EMAIL
  const password = process.env.E2E_LOCAL_USER_PASSWORD
  if (!email || !password) {
    throw new Error(
      'E2E_LOCAL_USER_EMAIL/E2E_LOCAL_USER_PASSWORD are not set - see .env.e2e-local.example. ' +
        'Run scripts/e2e-local-seed.mjs first.',
    )
  }

  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()

  // Real, resolved session + Account landed on the authenticated shell -
  // never assumed from the click alone.
  await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 15_000 })

  mkdirSync('e2e-authenticated/.auth', { recursive: true })
  await page.context().storageState({ path: authFile })
})

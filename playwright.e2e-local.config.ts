import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// Separate config for the authenticated visual baseline against a LOCAL
// Supabase stack only (`pnpm exec supabase start`). Deliberately isolated
// from playwright.config.ts/e2e/ (the existing fail-closed smoke suite,
// which must keep running against its own intentionally-broken remote
// credentials, untouched by this file).

if (!existsSync('.env.e2e-local')) {
  throw new Error(
    '.env.e2e-local is missing - copy .env.e2e-local.example to .env.e2e-local and fill in your local ' +
      'Supabase values (run `pnpm exec supabase start` to get them).',
  )
}
// Node 20.6+ built-in - no new dependency. Loads into this process's env,
// inherited by the webServer/test-worker child processes below.
process.loadEnvFile('.env.e2e-local')

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? ''
if (!supabaseUrl.includes('127.0.0.1') && !supabaseUrl.includes('localhost')) {
  throw new Error(
    `VITE_SUPABASE_URL ("${supabaseUrl}") in .env.e2e-local does not look like a local Supabase stack. ` +
      'Refusing to run the authenticated E2E baseline against anything but 127.0.0.1/localhost.',
  )
}

export default defineConfig({
  testDir: './e2e-authenticated',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'authenticated',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e-authenticated/.auth/user.json' },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
  webServer: {
    command: 'pnpm build:e2e-local && pnpm preview:e2e-local',
    url: 'http://localhost:4174',
    reuseExistingServer: !process.env.CI,
  },
})

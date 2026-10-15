import { existsSync, readFileSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'
import { assertDisposableSupabaseStack } from './scripts/local-supabase-guard.mjs'

// Separate config for the functional MVP-journey suite (create a property,
// register a rental draft, both through the real UI) against a DISPOSABLE,
// isolated LOCAL Supabase stack only. Deliberately independent from
// playwright.config.ts/e2e/ (fail-closed smoke suite) and from
// playwright.e2e-local.config.ts/e2e-authenticated/ (the visual baseline,
// which reuses a pre-seeded account + storageState) - this suite creates
// its own account from scratch every run and must never reuse either.

if (!existsSync('.env.e2e-local')) {
  throw new Error(
    '.env.e2e-local is missing - copy .env.e2e-local.example to .env.e2e-local and fill in your local ' +
      'Supabase values. This file only needs to EXIST for the fail-closed check below; the real values ' +
      'for a given run are expected to be passed as real process env vars (VITE_SUPABASE_URL/' +
      'VITE_SUPABASE_PUBLISHABLE_KEY) pointing at a disposable stack, which take precedence over this file.',
  )
}
// Node 20.6+ built-in - no new dependency. Does NOT override a variable
// already present in process.env (verified empirically), so passing real
// env vars before invoking this config safely overrides this file's values
// without ever editing it.
process.loadEnvFile('.env.e2e-local')

// Independent review (HIGH, fixed): a plain "is this 127.0.0.1" check could
// not tell this disposable, single-use stack apart from the shared,
// long-running local dev stack - both are local, and .env.e2e-local already
// holds valid credentials for the shared one. This now requires a second,
// independently-sourced port confirmation, cross-checks against the real
// port committed in supabase/config.toml (explicit, named rejection of the
// shared stack), and a live health round-trip - all BEFORE Playwright even
// starts building/serving the app. See local-supabase-guard.mjs for the
// full reasoning; the spec file repeats this same check again before its
// own signUp call, as a second, independent layer.
await assertDisposableSupabaseStack({
  url: process.env.VITE_SUPABASE_URL ?? '',
  declaredPort: process.env.E2E_FUNCTIONAL_SUPABASE_PORT,
  sharedConfigTomlText: readFileSync('supabase/config.toml', 'utf8'),
})

export default defineConfig({
  testDir: './e2e-functional',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4175',
    // No storageState anywhere in this config, on purpose - every test in
    // this suite signs up and bootstraps its own fresh account; reusing a
    // prior session/seed would defeat the point of a functional journey
    // test and risk silently passing against stale data.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'functional', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Second independent review (LOW, clarified): build:e2e-functional
    // (package.json) runs `vite build --mode e2e-local`, not a dedicated
    // `e2e-functional` mode - intentional, not a leftover. A Vite mode's
    // only effect here would be which `.env.[mode]` FILE it optionally
    // loads, and no `.env.e2e-functional` file exists or should exist:
    // every real value for THIS suite is required to come from explicit
    // process env overrides (VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY/
    // E2E_FUNCTIONAL_SUPABASE_PORT, verified above), never a file, on
    // purpose - see assertDisposableSupabaseStack's own reasoning for why
    // a file-based fallback is exactly the failure mode this suite must
    // never have. Introducing a new mode name would only invite creating
    // that exact file later "for convenience", reintroducing the original
    // HIGH risk. Verified empirically (twice, across two independent
    // review rounds) that process-level env vars still correctly override
    // .env.e2e-local's own values under this shared mode - the suite only
    // ever writes to whatever stack VITE_SUPABASE_URL actually names.
    command: 'pnpm build:e2e-functional && pnpm preview:e2e-functional',
    url: 'http://localhost:4175',
    reuseExistingServer: !process.env.CI,
  },
})

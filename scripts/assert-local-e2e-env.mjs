// Fail-closed guard run before any E2E-local build/preview step.
//
// `vite build --mode e2e-local` on its own silently falls back to the base
// `.env` (the real remote Supabase project) if `.env.e2e-local` doesn't
// exist - Vite's mode-env loading is optional by design and raises no
// error. This script is the explicit check that was missing: it is chained
// with `&&` in front of `vite build`/`vite preview` in package.json's
// build:e2e-local/preview:e2e-local scripts, so neither can ever produce an
// artifact wired to production without this check failing first.

import { existsSync } from 'node:fs'

if (!existsSync('.env.e2e-local')) {
  console.error(
    '[assert-local-e2e-env] .env.e2e-local is missing - copy .env.e2e-local.example to .env.e2e-local ' +
      'and fill it in. Refusing to build/preview, which would otherwise silently fall back to the real ' +
      '.env (production) Supabase project.',
  )
  process.exit(1)
}

process.loadEnvFile('.env.e2e-local')
const url = process.env.VITE_SUPABASE_URL ?? ''
if (!url.includes('127.0.0.1') && !url.includes('localhost')) {
  console.error(
    `[assert-local-e2e-env] VITE_SUPABASE_URL ("${url}") in .env.e2e-local does not look like a local ` +
      'Supabase stack. Refusing to continue - this pipeline only ever runs against 127.0.0.1/localhost.',
  )
  process.exit(1)
}

console.log('[assert-local-e2e-env] OK - .env.e2e-local points at a local Supabase stack.')

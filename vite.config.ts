/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Third-audit P1 (PR #26, b56eb91): `loadEnv(mode, cwd, 'VITE_')` merges
// real `process.env` VITE_-prefixed vars on top of whatever `.env*` file
// matches `mode` - it does not restrict *which* vars `mode` allows through.
// A `VITE_ENABLE_PROPERTIES_PREVIEW=true` left set in the shell/CI
// environment therefore still enabled the demo chunk even during a
// `production`-mode `pnpm build`, regardless of `.env` itself never setting
// it. The flag alone was never trustworthy - only the *mode* is under this
// repo's control (chosen by which `vite build --mode …` script runs, not by
// ambient env). So the preview is now gated on an explicit mode allowlist
// first, and the flag only matters once that allowlist already says yes.
const PREVIEW_ALLOWED_MODES = new Set(['e2e'])

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // `import.meta.env['VITE_ENABLE_PROPERTIES_PREVIEW']` alone only gates
  // *rendering*: Vite inlines all VITE_* vars as members of one runtime
  // `import.meta.env` object, it does not fold an individual member access
  // into a literal, so a plain `lazy(() => import(...))` guarded that way
  // stays reachable code and Rollup still emits its chunk even when the
  // flag is unset. `__ENABLE_PROPERTIES_PREVIEW__` is a real esbuild
  // `define` substitution (textual, like `import.meta.env.DEV`/`.PROD`),
  // so it becomes a literal `true`/`false` in the bundle and esbuild's own
  // dead-code elimination can then prove the `import('./PropertiesVisualPreview')`
  // branch unreachable in a normal build, excluding that chunk from
  // `dist/assets` entirely - verified by diffing `dist` between
  // `pnpm build` and `pnpm build:e2e`.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const enablePropertiesPreview =
    PREVIEW_ALLOWED_MODES.has(mode) && env['VITE_ENABLE_PROPERTIES_PREVIEW'] === 'true'
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    define: {
      __ENABLE_PROPERTIES_PREVIEW__: JSON.stringify(enablePropertiesPreview),
    },
    // `supabase/config.toml`'s own `site_url` (committed, shared by every
    // local/disposable Supabase stack this project starts) has always been
    // `http://127.0.0.1:3000` - Vite's own unconfigured default (5173) was
    // simply never aligned with it. GoTrue treats a redirectTo under
    // site_url's own origin as implicitly trusted for any path (verified
    // empirically against the disposable stack: a recovery email's link
    // correctly carries `redirect_to=http://127.0.0.1:3000/reset-password`
    // once requestPasswordReset's `window.location.origin` is this port) -
    // so matching Vite's dev port to that existing convention is what makes
    // a real recovery/confirmation email's link land on the running app with
    // zero manual URL editing, without touching any Supabase config or
    // restarting any stack. Only affects `vite`/`vite dev` (`pnpm dev`) -
    // `vite preview`'s own port is a separate setting, untouched, and every
    // preview/build script in package.json already passes its own explicit
    // --port anyway.
    server: {
      port: 3000,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/shared/testing/setup-tests.ts'],
      css: true,
      exclude: ['node_modules', 'dist', 'e2e', 'e2e-authenticated', 'e2e-functional'],
      env: {
        // Non-functional placeholders so env validation passes in tests.
        // No network calls happen against these during unit tests.
        VITE_SUPABASE_URL: 'https://placeholder.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_placeholder',
      },
    },
  }
})

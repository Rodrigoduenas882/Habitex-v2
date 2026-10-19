/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
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
})

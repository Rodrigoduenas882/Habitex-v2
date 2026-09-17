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
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/shared/testing/setup-tests.ts'],
    css: true,
    exclude: ['node_modules', 'dist', 'e2e'],
    env: {
      // Non-functional placeholders so env validation passes in tests.
      // No network calls happen against these during unit tests.
      VITE_SUPABASE_URL: 'https://placeholder.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_placeholder',
    },
  },
})

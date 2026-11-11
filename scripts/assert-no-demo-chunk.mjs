// Fail-closed guard run after a normal `pnpm build` (chained in
// package.json's `build` script, same technique as assert-local-e2e-env.mjs).
//
// PropertiesVisualPreview is a design/QA-only view built entirely on local
// mock fixtures (fake inmuebles, addresses, parkings). Route-gating it is
// not enough: a `lazy(() => import(...))` that is merely rendered
// conditionally still leaves a reachable dynamic import, so Rollup keeps
// emitting its chunk into dist/assets - shipped, fetchable, and
// inspectable by anyone, even though no route renders it. It is excluded at
// build time instead, via the `__ENABLE_PROPERTIES_PREVIEW__` define (see
// vite.config.ts and UiPreviewPage.tsx).
//
// That exclusion depends on esbuild's dead-code elimination actually
// folding the define away, which is exactly the kind of thing a config or
// bundler change can silently break. This script verifies the real
// artifact rather than the intent: it fails the build if any demo chunk
// made it into dist/. `build:e2e` deliberately does NOT chain this - that
// review/E2E build is supposed to contain the preview.

import { readdirSync } from 'node:fs'

const ASSETS_DIR = 'dist/assets'
// Any file whose name derives from a fixture-carrying preview module.
const DEMO_CHUNK_PATTERN = /PropertiesVisualPreview/i

let entries
try {
  entries = readdirSync(ASSETS_DIR)
} catch (error) {
  console.error(
    `[assert-no-demo-chunk] Could not read ${ASSETS_DIR} (${String(error)}). This script runs after ` +
      '`vite build`; refusing to report success without inspecting the real artifact.',
  )
  process.exit(1)
}

const demoChunks = entries.filter((entry) => DEMO_CHUNK_PATTERN.test(entry))

if (demoChunks.length > 0) {
  console.error(
    `[assert-no-demo-chunk] ${ASSETS_DIR} contains demo-fixture chunk(s): ${demoChunks.join(', ')}. ` +
      'A normal production build must not emit the Properties visual preview. Check that ' +
      '__ENABLE_PROPERTIES_PREVIEW__ (vite.config.ts) is still false here and that UiPreviewPage.tsx ' +
      'still guards the import() itself, not just its rendering.',
  )
  process.exit(1)
}

console.log(`[assert-no-demo-chunk] OK - no demo-fixture chunk in ${ASSETS_DIR}.`)

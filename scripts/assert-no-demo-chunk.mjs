// Fail-closed guard run after a normal `pnpm build` (chained in
// package.json's `build` script, same technique as assert-local-e2e-env.mjs).
//
// PropertiesVisualPreview is a design/QA-only view built entirely on local
// mock fixtures (fake inmuebles, addresses, parkings). Route-gating it is
// not enough: a `lazy(() => import(...))` that is merely rendered
// conditionally still leaves a reachable dynamic import, so Rollup keeps
// emitting its chunk into dist/ - shipped, fetchable, and inspectable by
// anyone, even though no route renders it. It is excluded at build time
// instead, via the `__ENABLE_PROPERTIES_PREVIEW__` define (see
// vite.config.ts and UiPreviewPage.tsx).
//
// That exclusion depends on esbuild's dead-code elimination actually
// folding the define away, which is exactly the kind of thing a config or
// bundler change can silently break. This script verifies the real
// artifact rather than the intent - and does so by *content*, not by
// filename: the third audit of PR #26 demonstrated that a filename-pattern
// check (matching "PropertiesVisualPreview" in the chunk's name) returns a
// false "clean" if that chunk is ever renamed (e.g. `index-audit.js`) by a
// future bundler/config change, while the fixture code - and the demo
// Alert's own Spanish copy - still ships inside it. Scanning every built
// text file's actual content for these markers catches that regardless of
// what Rollup happens to name the chunk. `build:e2e` deliberately does NOT
// chain this - that review/E2E build is supposed to contain the preview.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST_DIR = 'dist'
const SCAN_EXTENSIONS = new Set(['.js', '.css', '.html'])
// String literals from PropertiesVisualPreview.tsx's own fixtures/copy -
// minifiers rename identifiers but never alter string literal contents, so
// these survive in the built output verbatim regardless of chunk naming.
const DEMO_CONTENT_MARKERS = [
  'demo-prop-1',
  'demo-parking-1',
  'Vista de demostración · Inmuebles y Parqueaderos',
]

function listFilesRecursively(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch (error) {
    throw new Error(`Could not read ${dir} (${String(error)})`)
  }

  return entries.flatMap((entry) => {
    const entryPath = join(dir, entry)
    const stats = statSync(entryPath)
    return stats.isDirectory() ? listFilesRecursively(entryPath) : [entryPath]
  })
}

let files
try {
  files = listFilesRecursively(DIST_DIR)
} catch (error) {
  console.error(
    `[assert-no-demo-chunk] ${String(error)}. This script runs after \`vite build\`; refusing to report ` +
      'success without inspecting the real artifact.',
  )
  process.exit(1)
}

const offendingFiles = []

for (const file of files) {
  const dot = file.lastIndexOf('.')
  const extension = dot === -1 ? '' : file.slice(dot)
  if (!SCAN_EXTENSIONS.has(extension)) continue

  const content = readFileSync(file, 'utf8')
  const foundMarker = DEMO_CONTENT_MARKERS.find((marker) => content.includes(marker))
  if (foundMarker) {
    offendingFiles.push({ file, marker: foundMarker })
  }
}

if (offendingFiles.length > 0) {
  const details = offendingFiles.map(({ file, marker }) => `${file} (matched "${marker}")`).join(', ')
  console.error(
    `[assert-no-demo-chunk] ${DIST_DIR} contains demo-fixture content: ${details}. ` +
      'A normal production build must not emit the Properties visual preview. Check that ' +
      '__ENABLE_PROPERTIES_PREVIEW__ (vite.config.ts) is still false here and that UiPreviewPage.tsx ' +
      'still guards the import() itself, not just its rendering.',
  )
  process.exit(1)
}

console.log(`[assert-no-demo-chunk] OK - no demo-fixture content found anywhere under ${DIST_DIR}.`)

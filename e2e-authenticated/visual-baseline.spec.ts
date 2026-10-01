import { mkdirSync, readFileSync } from 'node:fs'
import { test } from '@playwright/test'

// First authenticated visual baseline (Dashboard/Rentals/Payments only, per
// the current research phase - not a general screenshot suite). Reuses the
// storageState captured by auth.setup.ts; requires
// e2e-authenticated/.seed-output.json from scripts/e2e-local-seed.mjs.
// Screenshots are local artifacts only (gitignored) - never committed
// automatically.

interface SeedOutput {
  administrationId: string
  paidRentalRelationshipId: string
  pendingRentalRelationshipId: string
}

const seed: SeedOutput = JSON.parse(readFileSync('e2e-authenticated/.seed-output.json', 'utf-8'))

const OUT_DIR = 'e2e-authenticated/screenshots'

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const

const SCREENS = [
  { name: 'dashboard', path: '/' },
  { name: 'rentals', path: '/rentals' },
  { name: 'payments', path: `/rentals/${seed.paidRentalRelationshipId}/payments` },
] as const

test.beforeAll(() => {
  mkdirSync(OUT_DIR, { recursive: true })
})

for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
  for (const screen of SCREENS) {
    test(`${screen.name} - ${viewportName} - light`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto(screen.path, { waitUntil: 'networkidle' })
      await page.waitForTimeout(400)
      await page.screenshot({ path: `${OUT_DIR}/${screen.name}--${viewportName}--light.png`, fullPage: true })
    })
  }
}

for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
  for (const screen of SCREENS) {
    test(`${screen.name} - ${viewportName} - dark`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto(screen.path)
      await page.evaluate(() => {
        window.localStorage.setItem('habitex:theme', 'dark')
      })
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForTimeout(400)
      await page.screenshot({ path: `${OUT_DIR}/${screen.name}--${viewportName}--dark.png`, fullPage: true })
    })
  }
}

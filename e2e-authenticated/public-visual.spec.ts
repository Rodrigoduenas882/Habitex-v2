import { mkdirSync } from 'node:fs'
import { test } from '@playwright/test'

// DS-005: LoginPage must be visited unauthenticated (RedirectIfAuthenticated
// sends an authenticated session away from /login), so this runs under the
// 'public' project (no storageState) instead of visual-baseline.spec.ts's
// 'authenticated' one. Screenshots are local artifacts only (gitignored).

const OUT_DIR = 'e2e-authenticated/screenshots'

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const

test.beforeAll(() => {
  mkdirSync(OUT_DIR, { recursive: true })
})

for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
  test(`login - ${viewportName} - light`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT_DIR}/login--${viewportName}--light.png`, fullPage: true })
  })
}

for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
  test(`login - ${viewportName} - dark`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/login')
    await page.evaluate(() => {
      window.localStorage.setItem('habitex:theme', 'dark')
    })
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT_DIR}/login--${viewportName}--dark.png`, fullPage: true })
  })
}

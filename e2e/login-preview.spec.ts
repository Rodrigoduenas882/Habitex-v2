import { expect, test } from '@playwright/test'

/**
 * /login-preview is a TEMPORARY side-by-side comparison page (see
 * router.tsx and LoginPreviewPage.tsx) - not the real /login. These checks
 * exist only so the new layout doesn't silently break across breakpoints
 * while both versions are being compared.
 */
test.describe('/login-preview', () => {
  test('is reachable without authentication', async ({ page }) => {
    await page.goto('/login-preview')

    await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible()
    await expect(page.getByRole('radiogroup', { name: 'Apariencia' })).toBeVisible()
  })

  test('crossfades the hero photo when switching Light/Dark', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/login-preview')
    const html = page.locator('html')

    await page.getByRole('radio', { name: 'Usar tema Oscuro' }).click()
    await expect(html).toHaveAttribute('data-theme', 'dark')

    await page.getByRole('radio', { name: 'Usar tema Claro' }).click()
    await expect(html).toHaveAttribute('data-theme', 'light')
  })

  for (const viewport of [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 820, height: 1180 },
    { name: 'desktop', width: 1440, height: 900 },
  ]) {
    test(`has no horizontal overflow on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/login-preview')

      await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible()
      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(hasHorizontalOverflow).toBe(false)
    })
  }
})

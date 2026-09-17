import { expect, test } from '@playwright/test'

test.describe('/ui-preview', () => {
  test('is reachable without authentication and shows the design system sections', async ({
    page,
  }) => {
    await page.goto('/ui-preview')

    await expect(page).toHaveURL(/\/ui-preview$/)
    await expect(page.getByRole('heading', { name: 'Colores' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'App shell' })).toBeVisible()
  })

  test('theme control switches Light/Dark/System and persists the choice across reloads', async ({
    page,
  }) => {
    await page.goto('/ui-preview')
    const html = page.locator('html')

    await expect(page.getByRole('radiogroup', { name: 'Apariencia' })).toBeVisible()

    await page.getByRole('radio', { name: 'Usar tema Oscuro' }).click()
    await expect(html).toHaveAttribute('data-theme', 'dark')

    await page.reload()
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByRole('radio', { name: 'Usar tema Oscuro' })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    await page.getByRole('radio', { name: 'Usar tema Claro' }).click()
    await expect(html).toHaveAttribute('data-theme', 'light')
  })

  test('desktop shows the persistent sidebar, not a hamburger menu', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/ui-preview')

    await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeHidden()
  })

  test('mobile uses a hamburger + bottom nav instead of a shrunk sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/ui-preview')

    await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Más' })).toBeVisible()
  })

  test('tablet uses a hamburger menu, without a shrunk sidebar or the mobile bottom nav', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 820, height: 1180 })
    await page.goto('/ui-preview')

    await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Más' })).toBeHidden()
  })

  for (const viewport of [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 820, height: 1180 },
    { name: 'desktop', width: 1440, height: 900 },
  ]) {
    test(`no horizontal overflow on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/ui-preview')

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(hasHorizontalOverflow).toBe(false)
    })
  }
})

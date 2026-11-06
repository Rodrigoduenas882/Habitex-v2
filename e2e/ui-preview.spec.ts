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

  test('theme control switches Light/Dark and persists the choice across reloads', async ({
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

  test('theme control radiogroup: a single Tab stop, moved and selected with ArrowLeft/ArrowRight', async ({
    page,
  }) => {
    await page.goto('/ui-preview')

    const lightOption = page.getByRole('radio', { name: 'Usar tema Claro' })
    const darkOption = page.getByRole('radio', { name: 'Usar tema Oscuro' })
    const html = page.locator('html')

    await lightOption.click()
    await expect(lightOption).toHaveAttribute('tabindex', '0')
    await expect(darkOption).toHaveAttribute('tabindex', '-1')

    await lightOption.focus()
    await page.keyboard.press('ArrowRight')
    await expect(darkOption).toBeFocused()
    await expect(darkOption).toHaveAttribute('aria-checked', 'true')
    await expect(html).toHaveAttribute('data-theme', 'dark')

    // Only 2 options: ArrowRight wraps back to the first.
    await page.keyboard.press('ArrowRight')
    await expect(lightOption).toBeFocused()
    await expect(lightOption).toHaveAttribute('aria-checked', 'true')
    await expect(html).toHaveAttribute('data-theme', 'light')

    await page.keyboard.press('ArrowLeft')
    await expect(darkOption).toBeFocused()
    await expect(darkOption).toHaveAttribute('aria-checked', 'true')

    // Tab past the (now checked) dark option leaves the group entirely -
    // the unchecked option is never its own Tab stop.
    await page.keyboard.press('Tab')
    await expect(lightOption).not.toBeFocused()
    await expect(darkOption).not.toBeFocused()
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

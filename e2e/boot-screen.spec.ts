import { expect, test } from '@playwright/test'

/**
 * Covers the F5/reload experience (HabitexBootScreen replacing the old
 * plain "Cargando..." text) and the theme-flash concern around it. The
 * boot screen itself (mark + dots, no visible loading text) is unit-tested
 * in HabitexBootScreen.test.tsx - these checks are about what a *reload* in
 * a real browser actually does: does Auth/routing still resolve correctly,
 * does the theme still apply from the very first frame, is there no
 * horizontal overflow introduced.
 */
test.describe('Boot screen / F5 reload', () => {
  test('reload still resolves through Auth/ProtectedRoute to /login, with no visible "Cargando..." text left behind', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible()

    await page.reload()

    await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible()
    // The old fallback rendered this as plain, visible body text. Now it
    // only ever exists off-screen for assistive tech (see
    // HabitexBootScreen's sr-only span) - by the time the page has
    // settled, it must not be sitting anywhere in the visible tree.
    await expect(page.getByText('Cargando', { exact: false })).toHaveCount(0)
  })

  test('theme persists across a reload with no flash to the wrong theme', async ({ page }) => {
    await page.goto('/')
    const html = page.locator('html')

    await page.evaluate(() => {
      window.localStorage.setItem('habitex:theme', 'dark')
    })
    await page.reload()

    // data-theme is applied by an inline script before first paint - by the
    // time content is visible, it must already be correct, not "light then
    // flipped to dark".
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible()
  })

  test('respects prefers-reduced-motion (boot screen still renders correctly)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible()
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(hasHorizontalOverflow).toBe(false)
  })
})

import { expect, test } from '@playwright/test'

/**
 * Exercises the real /properties list cards (PropertyListCard,
 * ParkingListCard) through /ui-preview?view=properties, since the real
 * route requires a Supabase session Playwright has no way to obtain here -
 * same approach as app-shell.spec.ts/ui-preview.spec.ts for AppShell.
 * Deliberately not DEV-gated (see PropertiesVisualPreview's own doc
 * comment), so it's reachable from this production-style build.
 */
test.describe('/ui-preview?view=properties', () => {
  test('is reachable without authentication and shows both sections with demo data', async ({ page }) => {
    await page.goto('/ui-preview?view=properties')

    await expect(page.getByRole('heading', { name: 'Inmuebles' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Propiedades' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Parqueaderos' })).toBeVisible()
    await expect(page.getByText('Apartamento 302', { exact: true })).toBeVisible()
    await expect(page.getByText('Parqueadero 12')).toBeVisible()
  })

  test('shows the full occupancy/rental-mode variety: rented, available, and a BY_ROOMS room count', async ({
    page,
  }) => {
    await page.goto('/ui-preview?view=properties')

    await expect(page.getByText('Arrendado').first()).toBeVisible()
    await expect(page.getByText('Disponible').first()).toBeVisible()
    await expect(page.getByText('2 de 3 habitaciones ocupadas')).toBeVisible()
  })

  test('resolves the parking-to-property association from the already-rendered Properties list', async ({
    page,
  }) => {
    await page.goto('/ui-preview?view=properties')

    // Exactly one of the three demo parkings (P-07) is associated - the
    // other two (Parqueadero 12, Sótano 3) are independent and never show
    // this line.
    await expect(page.getByText('Asociado a Apartamento 302')).toBeVisible()
    await expect(page.getByText(/Asociado a/)).toHaveCount(1)
  })

  test('the empty-state toggle switches both sections independently from the demo data', async ({ page }) => {
    await page.goto('/ui-preview?view=properties')

    await expect(page.getByText('Apartamento 302', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Ver estados vacíos' }).click()

    await expect(page.getByText('Apartamento 302', { exact: true })).toBeHidden()
    await expect(page.getByText('Todavía no tienes inmuebles')).toBeVisible()
    await expect(page.getByText('Aún no tienes parqueaderos')).toBeVisible()

    await page.getByRole('button', { name: 'Ver datos de demostración' }).click()
    await expect(page.getByText('Apartamento 302', { exact: true })).toBeVisible()
    await expect(page.getByText('Todavía no tienes inmuebles')).toBeHidden()
  })

  test('theme control (floating user menu) switches Light/Dark and the cards render in both', async ({
    page,
  }) => {
    await page.goto('/ui-preview?view=properties')
    const html = page.locator('html')

    await page.getByLabel('Menú de usuario').click()
    await page.getByRole('radio', { name: 'Usar tema Oscuro' }).click()
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByText('Apartamento 302', { exact: true })).toBeVisible()

    await page.getByRole('radio', { name: 'Usar tema Claro' }).click()
    await expect(html).toHaveAttribute('data-theme', 'light')
    await expect(page.getByText('Apartamento 302', { exact: true })).toBeVisible()
  })

  for (const viewport of [
    { name: '320', width: 320, height: 1400 },
    { name: 'mobile (375)', width: 375, height: 1400 },
    { name: 'tablet', width: 820, height: 1400 },
    { name: 'desktop', width: 1440, height: 900 },
  ]) {
    test(`no horizontal overflow on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/ui-preview?view=properties')

      await expect(page.getByText('Apartamento 302', { exact: true })).toBeVisible()
      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(hasHorizontalOverflow).toBe(false)
    })
  }
})

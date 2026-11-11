import { expect, test } from '@playwright/test'

/**
 * Exercises the real /properties presentation (PropertiesSection,
 * ParkingsSection - the table/compact-card/row split) through
 * /ui-preview?view=properties, since the real route requires a Supabase
 * session Playwright has no way to obtain here - same approach as
 * app-shell.spec.ts/ui-preview.spec.ts for AppShell. Gated by UiPreviewPage
 * behind `VITE_ENABLE_PROPERTIES_PREVIEW`, which `.env.e2e` sets - see
 * PropertiesVisualPreview's own doc comment.
 *
 * Properties now render twice at once (the desktop table and the mobile/
 * tablet compact list - CSS, not JS, picks one per breakpoint). Assertions
 * about a property's content scope to the compact list, the one canonical
 * rendering used throughout this file, instead of the bare `page` (which
 * would otherwise find two matches and fail Playwright's strict mode).
 * Parking is unaffected - it only ever renders once.
 */
test.describe('/ui-preview?view=properties', () => {
  // Mobile width by default, so the compact list (not the table) is the
  // visible rendering throughout this file - the "responsive presentation"
  // describe block below sets its own explicit viewport per test and
  // overrides this.
  test.use({ viewport: { width: 375, height: 1400 } })

  test('is reachable without authentication and shows both sections with demo data', async ({ page }) => {
    await page.goto('/ui-preview?view=properties')

    await expect(page.getByRole('heading', { name: 'Inmuebles' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Propiedades' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Parqueaderos' })).toBeVisible()
    const compactList = page.getByTestId('properties-compact-list')
    await expect(compactList.getByText('Apartamento 302', { exact: true })).toBeVisible()
    await expect(page.getByText('Parqueadero 12')).toBeVisible()
  })

  test('shows the full occupancy/rental-mode variety: rented, available, and a BY_ROOMS room count', async ({
    page,
  }) => {
    await page.goto('/ui-preview?view=properties')

    const compactList = page.getByTestId('properties-compact-list')
    // Two demo properties resolve to "rented": demo-prop-1 (FULL_PROPERTY,
    // isOccupied) and demo-prop-3 (BY_ROOMS, occupiedRooms > 0) - hence
    // `.first()` here too, same as the "Disponible" query below.
    await expect(compactList.getByText('Arrendado').first()).toBeVisible()
    await expect(compactList.getByText('Disponible').first()).toBeVisible()
    await expect(compactList.getByText('2 de 3 habitaciones ocupadas')).toBeVisible()
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

    const compactList = page.getByTestId('properties-compact-list')
    await expect(compactList.getByText('Apartamento 302', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Ver estados vacíos' }).click()

    await expect(page.getByText('Apartamento 302', { exact: true })).toBeHidden()
    await expect(page.getByText('Todavía no tienes inmuebles')).toBeVisible()
    await expect(page.getByText('Aún no tienes parqueaderos')).toBeVisible()

    await page.getByRole('button', { name: 'Ver datos de demostración' }).click()
    await expect(page.getByTestId('properties-compact-list').getByText('Apartamento 302', { exact: true })).toBeVisible()
    await expect(page.getByText('Todavía no tienes inmuebles')).toBeHidden()
  })

  test('theme control (floating user menu) switches Light/Dark and the cards render in both', async ({
    page,
  }) => {
    await page.goto('/ui-preview?view=properties')
    const html = page.locator('html')
    const compactList = page.getByTestId('properties-compact-list')

    await page.getByLabel('Menú de usuario').click()
    await page.getByRole('radio', { name: 'Usar tema Oscuro' }).click()
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await expect(compactList.getByText('Apartamento 302', { exact: true })).toBeVisible()

    await page.getByRole('radio', { name: 'Usar tema Claro' }).click()
    await expect(html).toHaveAttribute('data-theme', 'light')
    await expect(compactList.getByText('Apartamento 302', { exact: true })).toBeVisible()
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

      await expect(page.getByText('Parqueadero 12')).toBeVisible()
      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(hasHorizontalOverflow).toBe(false)
    })
  }

  test.describe('responsive presentation - desktop table / compact cards / parking rows (Figma candidate, node 353:2)', () => {
    test('desktop (>=1024px) shows Propiedades as a real table with accessible column headers, not the compact cards', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto('/ui-preview?view=properties')

      const table = page.getByTestId('properties-table')
      await expect(table).toBeVisible()
      // Real browser (unlike jsdom, see PropertiesPage.test.tsx's own note)
      // correctly exposes the implicit table/columnheader roles here.
      await expect(table.getByRole('columnheader', { name: 'Inmueble' })).toBeVisible()
      await expect(table.getByRole('columnheader', { name: 'Tipo' })).toBeVisible()
      await expect(table.getByRole('columnheader', { name: 'Modalidad' })).toBeVisible()
      await expect(table.getByRole('columnheader', { name: 'Estado' })).toBeVisible()
      await expect(table.getByRole('row')).not.toHaveCount(0)

      await expect(page.getByTestId('properties-compact-list')).toBeHidden()
    })

    test('mobile (<1024px) shows the compact cards instead of the table', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 1400 })
      await page.goto('/ui-preview?view=properties')

      await expect(page.getByTestId('properties-compact-list')).toBeVisible()
      await expect(page.getByTestId('properties-table')).toBeHidden()
    })

    test('Parqueaderos always renders as one bordered list of compact rows, at every width', async ({ page }) => {
      for (const width of [375, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/ui-preview?view=properties')

        const list = page.getByTestId('parking-list')
        await expect(list).toBeVisible()
        await expect(list.getByText('Parqueadero 12')).toBeVisible()
        await expect(list.getByText('P-07')).toBeVisible()
      }
    })
  })
})

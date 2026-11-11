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
    // The compact card now carries units/occupancy for both rental modes,
    // not just BY_ROOMS (docs/DESIGN.md §15).
    await expect(compactList.getByText('2 de 3 unidades ocupadas')).toBeVisible()
    await expect(compactList.getByText('1 de 1 unidades ocupadas')).toBeVisible()
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
    // The two sides of the single 1024px breakpoint this page switches on.
    { name: 'just below desktop (1023)', width: 1023, height: 900 },
    { name: 'desktop boundary (1024)', width: 1024, height: 900 },
    { name: 'desktop (1440)', width: 1440, height: 900 },
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

    test(`no horizontal overflow on ${viewport.name} in dark theme`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/ui-preview?view=properties')

      await page.getByLabel('Menú de usuario').click()
      await page.getByRole('radio', { name: 'Usar tema Oscuro' }).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

      await expect(page.getByText('Parqueadero 12')).toBeVisible()
      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(hasHorizontalOverflow).toBe(false)
    })
  }

  test.describe('local filters (Ciudad, Tipo, Ocupación) - the real controls, not a preview copy', () => {
    test('offers only the cities present in the rendered list', async ({ page }) => {
      await page.goto('/ui-preview?view=properties')

      await expect(page.getByLabel('Ciudad').locator('option')).toHaveText([
        'Todas las ciudades',
        'Bogotá',
        'Cali',
        'Medellín',
      ])
    })

    test('filters by Ciudad, and combining it with Tipo narrows further', async ({ page }) => {
      await page.goto('/ui-preview?view=properties')
      const compactList = page.getByTestId('properties-compact-list')

      await page.getByLabel('Ciudad').selectOption('Bogotá')
      await expect(compactList.getByText('Apartamento 302', { exact: true })).toBeVisible()
      await expect(compactList.getByText('Apartamento 501', { exact: true })).toBeVisible()
      await expect(page.getByText('Casa 14', { exact: true })).toBeHidden()

      // Both Bogotá demo properties are apartments, so adding Tipo = Casa
      // leaves nothing - the filters-only empty state, not the "no data" one.
      await page.getByLabel('Tipo').selectOption('HOUSE')
      await expect(page.getByText('Ningún inmueble coincide con los filtros')).toBeVisible()
      await expect(page.getByText('Todavía no tienes inmuebles')).toBeHidden()
    })

    test('combines a filter with the text search, and clearing both restores the list', async ({ page }) => {
      await page.goto('/ui-preview?view=properties')
      const compactList = page.getByTestId('properties-compact-list')

      await page.getByLabel('Ciudad').selectOption('Bogotá')
      await page.getByLabel('Buscar inmuebles').fill('501')
      await expect(compactList.getByText('Apartamento 501', { exact: true })).toBeVisible()
      await expect(page.getByText('Apartamento 302', { exact: true })).toBeHidden()

      await page.getByLabel('Buscar inmuebles').fill('')
      // "" is the sentinel for "no city filter" - "all" is reserved for a
      // literal city value now (see propertyFilters.ts's own doc comment).
      await page.getByLabel('Ciudad').selectOption('')
      await expect(compactList.getByText('Apartamento 302', { exact: true })).toBeVisible()
      await expect(compactList.getByText('Casa 14', { exact: true })).toBeVisible()
      await expect(compactList.getByText('Casa 22', { exact: true })).toBeVisible()
    })

    test('filters by Ocupación using the same statuses the badges show', async ({ page }) => {
      await page.goto('/ui-preview?view=properties')
      const compactList = page.getByTestId('properties-compact-list')

      await page.getByLabel('Ocupación').selectOption('rented')
      await expect(compactList.getByText('Apartamento 302', { exact: true })).toBeVisible()
      await expect(compactList.getByText('Apartamento 501', { exact: true })).toBeVisible()
      await expect(page.getByText('Casa 14', { exact: true })).toBeHidden()

      await page.getByLabel('Ocupación').selectOption('available')
      await expect(compactList.getByText('Casa 14', { exact: true })).toBeVisible()
      await expect(page.getByText('Apartamento 302', { exact: true })).toBeHidden()
    })

    test('announces the search result count in a live region that was already mounted', async ({ page }) => {
      await page.goto('/ui-preview?view=properties')

      // Mounted and empty before the first term - only its text changes.
      // (Addressed by testid, not by role: the preview's own "Vista de
      // demostración" Alert is an info Alert, which is also role="status".)
      const status = page.getByTestId('properties-search-status')
      await expect(status).toHaveAttribute('role', 'status')
      await expect(status).toHaveText('')

      await page.getByLabel('Buscar inmuebles').fill('apartamento')
      await expect(status).toHaveText('Se encontraron 2 resultados.')

      await page.getByLabel('Buscar inmuebles').fill('')
      await expect(status).toHaveText('')
    })
  })

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
      await expect(table.getByRole('columnheader')).toHaveText([
        'Inmueble',
        'Dirección',
        'Tipo',
        'Unidades',
        'Ocupación',
      ])
      await expect(table.getByRole('row')).not.toHaveCount(0)

      await expect(page.getByTestId('properties-compact-list')).toBeHidden()
    })

    test('the desktop table carries the real Unidades/Ocupación values per rental mode', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto('/ui-preview?view=properties')

      const table = page.getByTestId('properties-table')
      // demo-prop-1: FULL_PROPERTY, occupied -> one unit, fully occupied.
      const fullProperty = table.getByRole('row').filter({ hasText: 'Apartamento 302' })
      await expect(fullProperty.getByText('1/1')).toBeVisible()
      await expect(fullProperty.getByText('Inmueble completo')).toBeVisible()

      // demo-prop-3: BY_ROOMS with 2 of 3 enabled rooms occupied.
      const byRooms = table.getByRole('row').filter({ hasText: 'Apartamento 501' })
      await expect(byRooms.getByText('2/3')).toBeVisible()
      await expect(byRooms.getByText('Por habitaciones')).toBeVisible()
    })

    test('switches presentation exactly at the 1024px breakpoint, not before', async ({ page }) => {
      await page.setViewportSize({ width: 1023, height: 900 })
      await page.goto('/ui-preview?view=properties')
      await expect(page.getByTestId('properties-compact-list')).toBeVisible()
      await expect(page.getByTestId('properties-table')).toBeHidden()

      await page.setViewportSize({ width: 1024, height: 900 })
      await expect(page.getByTestId('properties-table')).toBeVisible()
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

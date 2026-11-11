import { expect, test } from '@playwright/test'

/**
 * Exercises the real /rentals list presentation (RentalListCard) and the
 * real /rentals/:id/contracts contract rows (ContractCard) through
 * /ui-preview?view=rentals, since both real routes require a Supabase
 * session Playwright has no way to obtain here - same approach as
 * properties-preview.spec.ts. Gated by UiPreviewPage behind
 * `VITE_ENABLE_RENTALS_PREVIEW`, which `.env.e2e` sets - see
 * RentalsVisualPreview's own doc comment.
 */
test.describe('/ui-preview?view=rentals', () => {
  test.use({ viewport: { width: 375, height: 1600 } })

  test('is reachable without authentication and shows both sections with demo data', async ({ page }) => {
    await page.goto('/ui-preview?view=rentals')

    await expect(page.getByRole('heading', { name: 'Arriendos' }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Contratos' })).toBeVisible()
    const rentals = page.getByTestId('rentals-preview-grid')
    await expect(rentals.getByText('Apartamento 302')).toBeVisible()
    const contracts = page.getByTestId('contracts-preview-grid')
    // Three of the four demo contracts share origin HABITEX - .first() is
    // deliberate, same reasoning as properties-preview.spec.ts's own
    // repeated-status queries.
    await expect(contracts.getByText('Generado en Habitex').first()).toBeVisible()
  })

  test('shows the full rental lifecycle variety: DRAFT, ACTIVE, ENDING, ENDED and CANCELLED', async ({ page }) => {
    await page.goto('/ui-preview?view=rentals')

    const rentals = page.getByTestId('rentals-preview-grid')
    await expect(rentals.getByText('Borrador').first()).toBeVisible()
    await expect(rentals.getByText('Activo')).toBeVisible()
    await expect(rentals.getByText('Finalizando')).toBeVisible()
    await expect(rentals.getByText('Finalizado')).toBeVisible()
    await expect(rentals.getByText('Cancelado')).toBeVisible()

    // One DRAFT card is activation-ready, the other is explicitly blocked
    // (termsIncomplete) - both states visible at once, not just the happy path.
    await expect(rentals.getByRole('button', { name: 'Activar' }).first()).toBeEnabled()
    await expect(page.getByText('Completa los términos de este arriendo para poder activarlo.')).toBeVisible()
  })

  test('shows the full contract lifecycle variety: GENERATED, SHARED, SIGNED and TERMINATED', async ({ page }) => {
    await page.goto('/ui-preview?view=rentals')

    // { exact: true } throughout - each of these also exists as a substring
    // of a longer caption ("Generado en Habitex", "Compartido el {{date}}",
    // etc.) elsewhere on the same card, so a plain substring match would
    // hit Playwright's strict mode.
    const contracts = page.getByTestId('contracts-preview-grid')
    await expect(contracts.getByText('Generado', { exact: true })).toBeVisible()
    await expect(contracts.getByText('Compartido', { exact: true })).toBeVisible()
    await expect(contracts.getByText('Firmado', { exact: true })).toBeVisible()
    await expect(contracts.getByText('Terminado', { exact: true })).toBeVisible()
    await expect(contracts.getByText('Externo', { exact: true })).toBeVisible()

    // Status-exact action sets, same as the real page.
    await expect(contracts.getByRole('button', { name: 'Marcar como compartido' })).toBeVisible()
    await expect(contracts.getByRole('button', { name: 'Terminar contrato' })).toBeVisible()
  })

  test('never renders any raw UUID or advanced-signature copy anywhere on the page', async ({ page }) => {
    await page.goto('/ui-preview?view=rentals')

    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    expect(bodyText).not.toMatch(/firma electrónica|firma digital|OTP|biométric/i)
  })

  test('theme control (floating user menu) switches Light/Dark and both grids render in both', async ({ page }) => {
    await page.goto('/ui-preview?view=rentals')
    const html = page.locator('html')
    const rentals = page.getByTestId('rentals-preview-grid')

    await page.getByLabel('Menú de usuario').click()
    await page.getByRole('radio', { name: 'Usar tema Oscuro' }).click()
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await expect(rentals.getByText('Apartamento 302')).toBeVisible()

    await page.getByRole('radio', { name: 'Usar tema Claro' }).click()
    await expect(html).toHaveAttribute('data-theme', 'light')
    await expect(rentals.getByText('Apartamento 302')).toBeVisible()
  })

  for (const viewport of [
    { name: '320', width: 320, height: 1800 },
    { name: 'mobile (375)', width: 375, height: 1800 },
    { name: 'tablet (768)', width: 768, height: 1600 },
    { name: 'desktop (1024)', width: 1024, height: 1000 },
    { name: 'desktop (1440)', width: 1440, height: 1000 },
  ]) {
    test(`no horizontal overflow on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/ui-preview?view=rentals')

      await expect(page.getByTestId('rentals-preview-grid').getByText('Apartamento 302')).toBeVisible()
      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(hasHorizontalOverflow).toBe(false)
    })

    test(`no horizontal overflow on ${viewport.name} in dark theme`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/ui-preview?view=rentals')

      await page.getByLabel('Menú de usuario').click()
      await page.getByRole('radio', { name: 'Usar tema Oscuro' }).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

      await expect(page.getByTestId('rentals-preview-grid').getByText('Apartamento 302')).toBeVisible()
      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(hasHorizontalOverflow).toBe(false)
    })
  }

  test('irreversible lifecycle actions (Cancelar, Terminar arriendo, Terminar contrato) require a second confirmation click', async ({
    page,
  }) => {
    await page.goto('/ui-preview?view=rentals')

    const rentals = page.getByTestId('rentals-preview-grid')
    await rentals.getByRole('button', { name: 'Cancelar' }).click()
    await expect(rentals.getByRole('button', { name: 'Confirmar cancelación' })).toBeVisible()
    await expect(rentals.getByRole('button', { name: 'Volver' })).toBeVisible()

    await rentals.getByRole('button', { name: 'Terminar arriendo' }).click()
    await expect(rentals.getByRole('button', { name: 'Confirmar terminación' })).toBeVisible()

    const contracts = page.getByTestId('contracts-preview-grid')
    await contracts.getByRole('button', { name: 'Terminar contrato' }).click()
    await expect(contracts.getByRole('button', { name: 'Confirmar terminación' })).toBeVisible()
  })
})

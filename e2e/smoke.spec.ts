import { expect, test } from '@playwright/test'

test('unauthenticated visitor is redirected to login instead of granted access', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
})

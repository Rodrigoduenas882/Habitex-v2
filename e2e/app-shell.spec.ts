import { expect, test } from '@playwright/test'

/**
 * Exercises the shared AppShell (shared/ui/AppShell) through /ui-preview,
 * since it renders the exact same component the real authenticated app
 * uses (see AppShellPreview.tsx) and doesn't require a real Supabase
 * session, which Playwright has no way to obtain here.
 */
test.describe('AppShell scroll containment (desktop)', () => {
  test('sidebar and floating menu stay fixed while main content scrolls, no double scrollbar, no horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/ui-preview')

    const shell = page.getByTestId('app-shell')
    const sidebar = page.getByTestId('app-shell-sidebar')
    const userMenu = page.getByTestId('app-shell-user-menu')
    const main = page.getByTestId('app-shell-main')

    await expect(sidebar).toBeVisible()
    await expect(userMenu).toBeVisible()

    // Force main to overflow regardless of how tall the preview's own
    // content happens to be, so this verifies the scroll-containment
    // mechanism deterministically instead of depending on content length.
    await main.evaluate((el) => {
      const spacer = document.createElement('div')
      spacer.style.height = '1600px'
      el.appendChild(spacer)
    })

    const sidebarBoxBefore = await sidebar.boundingBox()
    const userMenuBoxBefore = await userMenu.boundingBox()

    await main.evaluate((el) => {
      el.scrollTo(0, el.scrollHeight)
    })

    const mainScrollTop = await main.evaluate((el) => el.scrollTop)
    expect(mainScrollTop).toBeGreaterThan(0)

    await expect(sidebar).toBeVisible()
    await expect(userMenu).toBeVisible()

    const sidebarBoxAfter = await sidebar.boundingBox()
    const userMenuBoxAfter = await userMenu.boundingBox()
    expect(sidebarBoxAfter).toEqual(sidebarBoxBefore)
    expect(userMenuBoxAfter).toEqual(userMenuBoxBefore)

    // No double vertical scrollbar: the shell frame itself must never
    // overflow - only .main is allowed to be the scrolling element.
    const shellOverflowsVertically = await shell.evaluate(
      (el) => el.scrollHeight > el.clientHeight + 1,
    )
    expect(shellOverflowsVertically).toBe(false)

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(hasHorizontalOverflow).toBe(false)
  })
})

test.describe('AppShell collapsible sidebar (desktop)', () => {
  test('hovering or focusing inside the collapsed sidebar temporarily reveals labels again', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/ui-preview')

    const sidebar = page.getByTestId('app-shell-sidebar')
    const homeLabel = sidebar.getByText('Inicio', { exact: true })

    await expect(homeLabel).toBeVisible()
    await sidebar.getByRole('button', { name: 'Contraer panel lateral' }).click()
    // Right after this click, the pointer is still over the sidebar (that's
    // where the collapse button lives) and the button itself keeps focus -
    // both of which are themselves a "peek" trigger - so clicking elsewhere
    // clears both before observing the actual collapsed/idle state.
    await page.mouse.click(800, 450)
    await expect(homeLabel).toBeHidden()

    // Mouse hover peek.
    await sidebar.hover()
    await expect(homeLabel).toBeVisible()
    await page.mouse.click(800, 450)
    await expect(homeLabel).toBeHidden()

    // Keyboard focus peek: tabbing onto a nav link inside the rail widens
    // it back out too, not just mouse hover.
    await page.getByRole('link', { name: 'Inicio' }).focus()
    await expect(homeLabel).toBeVisible()
  })
})

test.describe('AppShell mobile drawer focus management (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  // /ui-preview's own design-system sections (e.g. ButtonsSection) happen to
  // demo buttons with the same visible labels used elsewhere on the page -
  // scoping every query to the real AppShell instance keeps these tests
  // pointed at the actual drawer instead of an unrelated demo button.
  test('opening the drawer moves focus inside it, and Tab/Shift+Tab never reach controls behind the overlay', async ({
    page,
  }) => {
    await page.goto('/ui-preview')
    const shell = page.getByTestId('app-shell')

    const trigger = shell.getByRole('button', { name: 'Abrir menú' })
    await trigger.click()

    const closeButton = shell.getByRole('button', { name: 'Cerrar menú' })
    await expect(closeButton).toBeFocused()

    // The floating user menu trigger sits behind the overlay - reproduces
    // the audited bug ("Tab alcanza Menú de usuario") if it ever regresses.
    const userMenuTrigger = shell.getByLabel('Menú de usuario')

    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      await expect(userMenuTrigger).not.toBeFocused()
    }

    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+Tab')
      await expect(userMenuTrigger).not.toBeFocused()
    }
  })

  test('Escape closes the drawer and restores focus to the trigger that opened it', async ({ page }) => {
    await page.goto('/ui-preview')
    const shell = page.getByTestId('app-shell')

    const trigger = shell.getByRole('button', { name: 'Abrir menú' })
    await trigger.click()
    await expect(shell.getByRole('button', { name: 'Cerrar menú' })).toBeFocused()

    await page.keyboard.press('Escape')

    // Closed slides the drawer off-canvas via transform (not display/
    // visibility), so a viewport-intersection check is what actually proves
    // it closed.
    await expect(shell.getByTestId('app-shell-drawer')).not.toBeInViewport()
    await expect(trigger).toBeFocused()
  })

  test('the close button also restores focus to the trigger', async ({ page }) => {
    await page.goto('/ui-preview')
    const shell = page.getByTestId('app-shell')

    const trigger = shell.getByRole('button', { name: 'Abrir menú' })
    await trigger.click()
    await shell.getByRole('button', { name: 'Cerrar menú' }).click()

    await expect(trigger).toBeFocused()
  })

  test('an outside (backdrop) click also closes the drawer and restores focus to the trigger', async ({
    page,
  }) => {
    await page.goto('/ui-preview')
    const shell = page.getByTestId('app-shell')

    const trigger = shell.getByRole('button', { name: 'Abrir menú' })
    await trigger.click()
    await expect(shell.getByRole('button', { name: 'Cerrar menú' })).toBeFocused()

    // Outside the 280px-wide drawer, still inside the 375px viewport.
    await page.mouse.click(350, 400)

    await expect(shell.getByTestId('app-shell-drawer')).not.toBeInViewport()
    await expect(trigger).toBeFocused()
  })

  test('the "Más" bottom-nav trigger gets its own focus back, not a hardcoded one', async ({ page }) => {
    await page.goto('/ui-preview')
    const shell = page.getByTestId('app-shell')

    const trigger = shell.getByRole('button', { name: 'Más' })
    await trigger.click()
    await expect(shell.getByRole('button', { name: 'Cerrar menú' })).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
  })
})

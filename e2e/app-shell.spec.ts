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

test.describe('AppShell drawer auto-close when resizing past the desktop breakpoint (375 → 1024 → 375)', () => {
  for (const openWith of ['Abrir menú', 'Más'] as const) {
    test(`drawer opened via "${openWith}": widening to desktop closes it, lifts the content lock, and leaves focus on something visible`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 })
      await page.goto('/ui-preview')
      const shell = page.getByTestId('app-shell')

      const trigger = shell.getByRole('button', { name: openWith })
      await trigger.click()
      const closeButton = shell.getByRole('button', { name: 'Cerrar menú' })
      await expect(closeButton).toBeFocused()

      const userMenuTrigger = shell.getByLabel('Menú de usuario')
      const main = shell.getByTestId('app-shell-main')

      await page.setViewportSize({ width: 1440, height: 900 })
      // Lets the width/transform transitions this resize triggers (sidebar,
      // drawer, and the rest of this long design-system page reflowing)
      // settle before interacting, so the click below lands on the real
      // target instead of a mid-transition layout.
      await page.waitForTimeout(400)

      // Drawer is gone, not just CSS-hidden-but-still-"open" in state.
      await expect(shell.getByTestId('app-shell-drawer')).not.toBeInViewport()

      // Focus landed on a visible desktop control - the main content
      // landmark - never the now-hidden mobile trigger and never BODY.
      // Checked before touching anything else, since the user menu's own
      // (pre-existing, unrelated) Escape handling moves focus to itself.
      await expect(main).toBeFocused()
      const activeElementTag = await page.evaluate(() => document.activeElement?.tagName)
      expect(activeElementTag).not.toBe('BODY')

      // The `inert` lock on the rest of the shell is lifted: the floating
      // user menu is reachable again - the concrete symptom the audit
      // reproduced.
      await userMenuTrigger.click()
      await expect(shell.getByTestId('app-shell-user-menu')).toHaveAttribute('open')
      await page.keyboard.press('Escape')
      await expect(shell.getByTestId('app-shell-user-menu')).not.toHaveAttribute('open')

      // Shrinking back down doesn't resurrect the drawer, and the real
      // mobile trigger opens a fresh one normally.
      await page.setViewportSize({ width: 375, height: 812 })
      await expect(shell.getByTestId('app-shell-drawer')).not.toBeInViewport()

      await trigger.click()
      await expect(closeButton).toBeFocused()
      await expect(shell.getByTestId('app-shell-drawer')).toBeInViewport()
    })
  }

  test('rapid 375 → 1024 → 375 → 1024 resizes settle on a single consistent state with no runtime errors', async ({
    page,
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/ui-preview')
    const shell = page.getByTestId('app-shell')

    await shell.getByRole('button', { name: 'Abrir menú' }).click()
    await expect(shell.getByRole('button', { name: 'Cerrar menú' })).toBeFocused()

    for (const width of [1440, 375, 1440, 375, 1440]) {
      await page.setViewportSize({ width, height: 900 })
    }
    await page.waitForTimeout(400)

    // Settled at desktop width: closed, not inert, no stuck state from the
    // rapid back-and-forth.
    await expect(shell.getByTestId('app-shell-drawer')).not.toBeInViewport()
    await expect(shell.getByTestId('app-shell-main')).toBeFocused()

    const userMenuTrigger = shell.getByLabel('Menú de usuario')
    await userMenuTrigger.click()
    await expect(shell.getByTestId('app-shell-user-menu')).toHaveAttribute('open')

    expect(pageErrors).toEqual([])
  })

  for (const openWith of ['Abrir menú', 'Más'] as const) {
    test(`a desktop crossing while closed does not hijack the next real close (closed 375 → 1024 → 375 → open via "${openWith}" → Escape)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 })
      await page.goto('/ui-preview')
      const shell = page.getByTestId('app-shell')
      // Waits for AppShell to actually mount (and its matchMedia listener
      // to subscribe) before the first resize below - resizing too early
      // races the component's own effect setup and would silently miss the
      // very breakpoint crossing this test depends on.
      await shell.getByRole('button', { name: 'Abrir menú' }).waitFor({ state: 'visible' })

      // The drawer stays closed through this whole round trip - this is the
      // exact reproduction from the third audit: a breakpoint crossing with
      // nothing open left a stale "breakpoint close" reason that hijacked
      // the *next* real close below.
      await page.setViewportSize({ width: 1024, height: 900 })
      await page.waitForTimeout(400)
      await page.setViewportSize({ width: 375, height: 812 })
      await page.waitForTimeout(400)

      const trigger = shell.getByRole('button', { name: openWith })
      await trigger.click()
      const closeButton = shell.getByRole('button', { name: 'Cerrar menú' })
      await expect(closeButton).toBeFocused()

      await page.keyboard.press('Escape')

      // Must be the real trigger, not <main> (the breakpoint-close target)
      // and not BODY.
      await expect(trigger).toBeFocused()
      const activeElementTag = await page.evaluate(() => document.activeElement?.tagName)
      expect(activeElementTag).not.toBe('BODY')
      expect(activeElementTag).not.toBe('MAIN')
    })
  }

  test('the same holds after several rapid crossings while closed, for both triggers in sequence', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/ui-preview')
    const shell = page.getByTestId('app-shell')
    await shell.getByRole('button', { name: 'Abrir menú' }).waitFor({ state: 'visible' })

    for (const width of [1024, 375, 1024, 375, 1024, 375]) {
      await page.setViewportSize({ width, height: 900 })
    }
    await page.waitForTimeout(400)

    for (const openWith of ['Abrir menú', 'Más'] as const) {
      const trigger = shell.getByRole('button', { name: openWith })
      await trigger.click()
      await expect(shell.getByRole('button', { name: 'Cerrar menú' })).toBeFocused()

      await page.keyboard.press('Escape')
      await expect(trigger).toBeFocused()
    }
  })
})

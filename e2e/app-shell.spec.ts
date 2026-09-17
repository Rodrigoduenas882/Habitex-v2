import { expect, test } from '@playwright/test'

/**
 * Exercises the shared AppShell (shared/ui/AppShell) through /ui-preview,
 * since it renders the exact same component the real authenticated app
 * uses (see AppShellPreview.tsx) and doesn't require a real Supabase
 * session, which Playwright has no way to obtain here.
 */
test.describe('AppShell scroll containment (desktop)', () => {
  test('sidebar and topbar stay fixed while main content scrolls, no double scrollbar, no horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/ui-preview')

    const shell = page.getByTestId('app-shell')
    const sidebar = page.getByTestId('app-shell-sidebar')
    const topbar = page.getByTestId('app-shell-topbar')
    const main = page.getByTestId('app-shell-main')

    await expect(sidebar).toBeVisible()
    await expect(topbar).toBeVisible()

    // Force main to overflow regardless of how tall the preview's own
    // content happens to be, so this verifies the scroll-containment
    // mechanism deterministically instead of depending on content length.
    await main.evaluate((el) => {
      const spacer = document.createElement('div')
      spacer.style.height = '1600px'
      el.appendChild(spacer)
    })

    const sidebarBoxBefore = await sidebar.boundingBox()
    const topbarBoxBefore = await topbar.boundingBox()

    await main.evaluate((el) => {
      el.scrollTo(0, el.scrollHeight)
    })

    const mainScrollTop = await main.evaluate((el) => el.scrollTop)
    expect(mainScrollTop).toBeGreaterThan(0)

    await expect(sidebar).toBeVisible()
    await expect(topbar).toBeVisible()

    const sidebarBoxAfter = await sidebar.boundingBox()
    const topbarBoxAfter = await topbar.boundingBox()
    expect(sidebarBoxAfter).toEqual(sidebarBoxBefore)
    expect(topbarBoxAfter).toEqual(topbarBoxBefore)

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

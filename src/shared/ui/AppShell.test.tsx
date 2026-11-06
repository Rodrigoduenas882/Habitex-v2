import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppShell, type AppShellNavItem } from './AppShell'

const NAV_ITEMS: AppShellNavItem[] = [
  { key: 'home', label: 'Inicio', icon: <span aria-hidden="true">H</span>, to: '/', active: true },
  { key: 'rentals', label: 'Arriendos', icon: <span aria-hidden="true">R</span>, to: '/rentals' },
  { key: 'finances', label: 'Finanzas', icon: <span aria-hidden="true">F</span> },
]

interface RenderShellOptions {
  overrides?: Partial<Omit<Parameters<typeof AppShell>[0], 'comingSoonLabel'>>
  /** exactOptionalPropertyTypes forbids passing `comingSoonLabel: undefined`
   * through a generic overrides object - this flag is the clean way to
   * render the "prop omitted entirely" case instead. */
  includeComingSoonLabel?: boolean
}

function renderShell({ overrides = {}, includeComingSoonLabel = true }: RenderShellOptions = {}) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/*"
          element={
            <AppShell
              brandName="Habitex"
              navItems={NAV_ITEMS}
              bottomNavKeys={['home', 'rentals', 'finances']}
              moreLabel="Más"
              openNavLabel="Abrir menú"
              closeNavLabel="Cerrar menú"
              userEmail="a@habitex.app"
              logoutLabel="Cerrar sesión"
              onLogout={vi.fn()}
              {...(includeComingSoonLabel ? { comingSoonLabel: 'Próximamente' } : {})}
              {...overrides}
            >
              <div>Contenido</div>
            </AppShell>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppShell navigation items with a real route', () => {
  it('renders as a link and marks the active one with aria-current', () => {
    renderShell()
    const sidebar = within(screen.getByTestId('app-shell-sidebar'))

    const rentals = sidebar.getByRole('link', { name: 'Arriendos' })
    expect(rentals).not.toHaveAttribute('aria-current')
    expect(sidebar.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page')
  })

  it('is never disabled', () => {
    renderShell()
    const sidebar = within(screen.getByTestId('app-shell-sidebar'))

    expect(sidebar.getByRole('link', { name: 'Arriendos' })).not.toHaveAttribute('aria-disabled')
  })
})

describe('AppShell navigation items without a route ("Próximamente")', () => {
  it('renders as a disabled button, never a link', () => {
    renderShell()
    const sidebar = within(screen.getByTestId('app-shell-sidebar'))

    expect(sidebar.queryByRole('link', { name: /Finanzas/ })).not.toBeInTheDocument()
    const button = sidebar.getByRole('button', { name: 'Finanzas' })
    expect(button).toBeDisabled()
  })

  it('shows the visible "Próximamente" label in the sidebar without changing the accessible name', () => {
    renderShell()
    const sidebar = within(screen.getByTestId('app-shell-sidebar'))

    // One visible badge + one sr-only description - both read "Próximamente".
    expect(sidebar.getAllByText('Próximamente').length).toBeGreaterThan(0)
    // The accessible name stays exactly "Finanzas" - the visible label is
    // aria-hidden and the coming-soon state is exposed as a description
    // instead, so existing consumers that query by the plain item name
    // (e.g. AuthenticatedLayout.test.tsx) keep working.
    expect(sidebar.getByRole('button', { name: 'Finanzas' })).toBeInTheDocument()
  })

  it('never receives the active styling/attribute, even if the item happened to be marked active', () => {
    renderShell({
      overrides: {
        navItems: [{ key: 'finances', label: 'Finanzas', icon: <span aria-hidden="true">F</span>, active: true }],
        bottomNavKeys: [],
      },
    })
    const sidebar = within(screen.getByTestId('app-shell-sidebar'))

    expect(sidebar.getByRole('button', { name: 'Finanzas' })).not.toHaveAttribute('aria-current')
  })

  it('does not navigate or fire a click handler when clicked', async () => {
    const user = userEvent.setup()
    renderShell()
    const sidebar = within(screen.getByTestId('app-shell-sidebar'))

    await user.click(sidebar.getByRole('button', { name: 'Finanzas' }))

    expect(screen.getByText('Contenido')).toBeInTheDocument()
  })

  it('is not reachable by keyboard (native disabled removes it from the tab order)', () => {
    renderShell()
    const sidebar = within(screen.getByTestId('app-shell-sidebar'))

    sidebar.getByRole('button', { name: 'Finanzas' }).focus()
    expect(sidebar.getByRole('button', { name: 'Finanzas' })).not.toHaveFocus()
  })

  it('omits the visible label and badge entirely when comingSoonLabel is not provided', () => {
    renderShell({ includeComingSoonLabel: false })
    const sidebar = within(screen.getByTestId('app-shell-sidebar'))

    expect(sidebar.queryByText('Próximamente')).not.toBeInTheDocument()
    expect(sidebar.getByRole('button', { name: 'Finanzas' })).toBeDisabled()
  })

  it('exposes the coming-soon state as an accessible description in the compact mobile bottom nav, with no visible text', () => {
    renderShell()
    // The bottom nav is CSS-hidden at the default (desktop-width) jsdom
    // viewport (mobile-only via @media max-width:639px) - `hidden: true`
    // queries it anyway, same as the real mobile layout would render it.
    const bottomNav = within(screen.getByTestId('app-shell-bottom-nav'))

    const button = bottomNav.getByRole('button', { name: 'Finanzas', hidden: true })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription('Próximamente')
  })
})


describe('AppShell account and sidebar controls', () => {
  it('keeps navigation available when the sidebar collapses', async () => {
    const user = userEvent.setup()
    renderShell()
    const sidebar = within(screen.getByTestId('app-shell-sidebar'))
    await user.click(sidebar.getByRole('button', { name: 'Contraer panel lateral' }))
    expect(sidebar.getByRole('button', { name: 'Expandir panel lateral' })).toHaveAttribute('aria-expanded', 'false')
    expect(sidebar.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page')
  })

  it('closes the floating menu on an outside click and a route change', async () => {
    const user = userEvent.setup()
    renderShell()
    const menu = screen.getByTestId('app-shell-user-menu')
    const trigger = screen.getByLabelText('Menú de usuario')
    await user.click(trigger)
    expect(menu).toHaveAttribute('open')
    await user.click(screen.getByText('Contenido'))
    expect(menu).not.toHaveAttribute('open')
    await user.click(trigger)
    // Keyboard activation changes route without the outside pointer handler.
    const link = within(screen.getByTestId('app-shell-sidebar')).getByRole('link', { name: 'Arriendos' })
    link.focus()
    await user.keyboard('{Enter}')
    expect(menu).not.toHaveAttribute('open')
  })

  it('opens the account controls and returns focus after Escape', async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn()
    renderShell({ overrides: { onLogout, userName: 'Rodrigo' } })
    const menu = screen.getByTestId('app-shell-user-menu')
    const trigger = screen.getByLabelText('Menú de usuario')
    await user.click(trigger)
    expect(menu).toHaveAttribute('open')
    await user.click(within(menu).getByRole('button', { name: 'Cerrar sesión' }))
    expect(onLogout).toHaveBeenCalledOnce()
    await user.keyboard('{Escape}')
    expect(menu).not.toHaveAttribute('open')
    expect(trigger).toHaveFocus()
  })
})

describe('AppShell mobile drawer focus management', () => {
  it('moves focus into the drawer on open and marks the rest of the shell inert', async () => {
    const user = userEvent.setup()
    renderShell()
    const bodyWrapper = screen.getByTestId('app-shell-main').parentElement as HTMLElement
    expect(bodyWrapper).not.toHaveAttribute('inert')

    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))

    expect(screen.getByRole('button', { name: 'Cerrar menú' })).toHaveFocus()
    expect(bodyWrapper).toHaveAttribute('inert')
  })

  it('restores focus to the trigger that opened it when closed via the close button', async () => {
    const user = userEvent.setup()
    renderShell()
    const trigger = screen.getByRole('button', { name: 'Abrir menú' })

    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'Cerrar menú' }))

    expect(trigger).toHaveFocus()
  })

  it('restores focus to the trigger when closed via Escape, and clears the inert lock', async () => {
    const user = userEvent.setup()
    renderShell()
    const trigger = screen.getByRole('button', { name: 'Abrir menú' })
    const bodyWrapper = screen.getByTestId('app-shell-main').parentElement as HTMLElement

    await user.click(trigger)
    await user.keyboard('{Escape}')

    expect(trigger).toHaveFocus()
    expect(bodyWrapper).not.toHaveAttribute('inert')
  })

  it('restores focus to the trigger when closed via an outside (backdrop) click', async () => {
    const user = userEvent.setup()
    renderShell()
    const trigger = screen.getByRole('button', { name: 'Abrir menú' })

    await user.click(trigger)
    const backdrop = screen.getByTestId('app-shell').querySelector('[class*="backdropOpen"]') as HTMLElement
    await user.click(backdrop)

    expect(trigger).toHaveFocus()
  })

  it('restores focus to the "more" bottom-nav button when that is what opened it', async () => {
    const user = userEvent.setup()
    renderShell()
    // The bottom nav is CSS-hidden at the default (desktop-width) jsdom
    // viewport, same as the other bottom-nav assertions in this file.
    const trigger = screen.getByRole('button', { name: 'Más', hidden: true })

    await user.click(trigger)
    expect(screen.getByRole('button', { name: 'Cerrar menú' })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
  })
})

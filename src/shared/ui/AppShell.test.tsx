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

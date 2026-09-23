import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { AuthenticatedLayout } from './AuthenticatedLayout'

const { getSession, onAuthStateChange } = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(() => () => {}),
}))

vi.mock('@/features/auth/infrastructure/supabase-session.repository', () => ({
  supabaseSessionRepository: {
    getSession,
    signInWithPassword: vi.fn(),
    onAuthStateChange,
    signOut: vi.fn(),
  },
}))

// SubscriptionStatusBanner (mounted inside AuthenticatedLayout) reaches
// these two administration repositories - mocked the same way
// PropertiesPage.test.tsx mocks them, so navigation tests below stay
// unaffected by the banner instead of hitting the real Supabase client.
const { listAccessibleAdministrations } = vi.hoisted(() => ({
  listAccessibleAdministrations: vi.fn(),
}))
const { getSubscription } = vi.hoisted(() => ({ getSubscription: vi.fn() }))

vi.mock('@/features/administration/infrastructure/supabase-administration.repository', () => ({
  supabaseAdministrationRepository: { listAccessibleAdministrations },
}))

vi.mock('@/features/administration/infrastructure/supabase-subscription.repository', () => ({
  supabaseSubscriptionRepository: { getSubscription },
}))

beforeEach(() => {
  // Default: no accessible administration -> SubscriptionStatusBanner stays
  // silent (status 'none'), same as before it existed. Individual tests
  // override this when they need to exercise the banner itself.
  listAccessibleAdministrations.mockResolvedValue([])
})

function renderLayout(initialPath: string) {
  const client = createTestQueryClient()
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<AuthenticatedLayout />}>
            <Route index element={<div>Home page</div>} />
            <Route path="properties" element={<div>Properties page</div>} />
            <Route path="rentals" element={<div>Rentals page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return within(screen.getByTestId('app-shell-sidebar'))
}

describe('AuthenticatedLayout navigation', () => {
  it('navigates to /properties when "Inmuebles" is clicked, and marks it active', async () => {
    getSession.mockResolvedValueOnce({ userId: 'user-1', email: 'a@habitex.app', expiresAtUnix: null })
    const user = userEvent.setup()
    const sidebar = renderLayout('/')
    await screen.findByText('Home page')

    await user.click(sidebar.getByRole('link', { name: 'Inmuebles' }))

    expect(await screen.findByText('Properties page')).toBeInTheDocument()
    expect(sidebar.getByRole('link', { name: 'Inmuebles' })).toHaveAttribute('aria-current', 'page')
  })

  it('keeps "Inicio" working and marks it active on the index route', async () => {
    getSession.mockResolvedValueOnce({ userId: 'user-1', email: 'a@habitex.app', expiresAtUnix: null })
    const sidebar = renderLayout('/')
    await screen.findByText('Home page')

    expect(sidebar.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page')
  })

  it('navigates to /rentals when "Arriendos" is clicked, and marks it active', async () => {
    getSession.mockResolvedValueOnce({ userId: 'user-1', email: 'a@habitex.app', expiresAtUnix: null })
    const user = userEvent.setup()
    const sidebar = renderLayout('/')
    await screen.findByText('Home page')

    await user.click(sidebar.getByRole('link', { name: 'Arriendos' }))

    expect(await screen.findByText('Rentals page')).toBeInTheDocument()
    expect(sidebar.getByRole('link', { name: 'Arriendos' })).toHaveAttribute('aria-current', 'page')
  })

  it('keeps a route-less item ("Personas") inert as a plain button, not a link', async () => {
    getSession.mockResolvedValueOnce({ userId: 'user-1', email: 'a@habitex.app', expiresAtUnix: null })
    const sidebar = renderLayout('/')
    await screen.findByText('Home page')

    expect(sidebar.queryByRole('link', { name: 'Personas' })).not.toBeInTheDocument()
    expect(sidebar.getByRole('button', { name: 'Personas' })).toBeInTheDocument()
  })
})

describe('AuthenticatedLayout SubscriptionStatusBanner wiring', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the trial banner above the routed page once an administration and its subscription resolve', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-09-22T00:00:00Z'))

    getSession.mockResolvedValueOnce({ userId: 'user-1', email: 'a@habitex.app', expiresAtUnix: null })
    listAccessibleAdministrations.mockResolvedValue([
      { id: 'admin-1', name: 'Edificio Central', status: 'ACTIVE' },
    ])
    getSubscription.mockResolvedValue({
      id: 'sub-1',
      administrationId: 'admin-1',
      status: 'TRIALING',
      planCode: 'starter',
      trialStartedAt: '2026-09-08T00:00:00Z',
      trialEndsAt: '2026-09-25T00:00:00Z',
      currentPeriodStartsAt: null,
      currentPeriodEndsAt: null,
      managementAccessUntil: null,
      activeRelationshipLimit: 10,
    })

    renderLayout('/')
    await screen.findByText('Home page')

    expect(await screen.findByText('Tu prueba gratuita termina en 3 días.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver planes' })).toBeDisabled()
  })

  it('renders nothing from the banner when there is no accessible administration', async () => {
    getSession.mockResolvedValueOnce({ userId: 'user-1', email: 'a@habitex.app', expiresAtUnix: null })

    renderLayout('/')
    await screen.findByText('Home page')

    expect(screen.queryByRole('button', { name: 'Ver planes' })).not.toBeInTheDocument()
    expect(getSubscription).not.toHaveBeenCalled()
  })
})

import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import RentalsPage from './RentalsPage'
import { RentalActivationError } from '../domain/rental.types'

const { listAccessibleAdministrations } = vi.hoisted(() => ({
  listAccessibleAdministrations: vi.fn(),
}))
const { listByAdministration } = vi.hoisted(() => ({ listByAdministration: vi.fn() }))
const { getSubscription } = vi.hoisted(() => ({ getSubscription: vi.fn() }))
const { activate } = vi.hoisted(() => ({ activate: vi.fn() }))

vi.mock('@/features/administration/infrastructure/supabase-administration.repository', () => ({
  supabaseAdministrationRepository: { listAccessibleAdministrations },
}))

vi.mock('@/features/administration/infrastructure/supabase-subscription.repository', () => ({
  supabaseSubscriptionRepository: { getSubscription },
}))

vi.mock('../infrastructure/supabase-rental.repository', () => ({
  supabaseRentalRepository: { listByAdministration, createDraft: vi.fn(), activate },
}))

const RENTAL_1 = {
  id: 'rental-1',
  administrationId: 'admin-1',
  status: 'ACTIVE' as const,
  jurisdictionCountry: 'CO',
  realStartDate: null,
  trackingStartDate: null,
  expectedEndDate: null,
  actualEndDate: null,
  paymentDay: null,
  paymentTiming: null,
}

const RENTAL_DRAFT = { ...RENTAL_1, id: 'rental-draft-1', status: 'DRAFT' as const }

/** Grants management access, no capacity limit - the "everything allowed" default most tests rely on. */
const UNLIMITED_SUBSCRIPTION = {
  id: 'sub-1',
  administrationId: 'admin-1',
  status: 'ACTIVE' as const,
  planCode: 'starter',
  trialStartedAt: null,
  trialEndsAt: null,
  currentPeriodStartsAt: null,
  currentPeriodEndsAt: null,
  managementAccessUntil: null,
  activeRelationshipLimit: null,
}

function renderPage() {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/rentals']}>
        <Routes>
          <Route path="/rentals" element={<RentalsPage />} />
          <Route path="/rentals/new" element={<div>Add rental page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function resolveOneAdministration() {
  listAccessibleAdministrations.mockResolvedValueOnce([
    { id: 'admin-1', name: 'Administración Uno', status: 'ACTIVE' },
  ])
}

describe('RentalsPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    getSubscription.mockResolvedValue(UNLIMITED_SUBSCRIPTION)
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('shows a loading state while the current administration is still resolving', () => {
    listAccessibleAdministrations.mockReturnValueOnce(new Promise(() => {}))
    renderPage()

    expect(screen.getByTestId('rentals-loading')).toBeInTheDocument()
    expect(listByAdministration).not.toHaveBeenCalled()
  })

  it('shows an error state when resolving the current administration fails', async () => {
    listAccessibleAdministrations.mockRejectedValueOnce(new Error('boom'))
    renderPage()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(listByAdministration).not.toHaveBeenCalled()
  })

  it('shows an explicit state (not an empty list) when the account has no administrations', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([])
    renderPage()

    expect(await screen.findByText('Todavía no tienes una administración')).toBeInTheDocument()
    expect(listByAdministration).not.toHaveBeenCalled()
  })

  it('shows the AdministrationPicker for multiple administrations, without auto-selecting one', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([
      { id: 'admin-1', name: 'Administración Uno', status: 'ACTIVE' },
      { id: 'admin-2', name: 'Administración Dos', status: 'ACTIVE' },
    ])
    renderPage()

    expect(await screen.findByText('Selecciona una administración')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Administración Uno, Activa' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Administración Dos, Activa' })).toBeInTheDocument()
    expect(listByAdministration).not.toHaveBeenCalled()
  })

  it('selecting an administration from the picker resolves the page to that administration', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([
      { id: 'admin-1', name: 'Administración Uno', status: 'ACTIVE' },
      { id: 'admin-2', name: 'Administración Dos', status: 'ACTIVE' },
    ])
    listByAdministration.mockResolvedValueOnce([RENTAL_1])
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('radio', { name: 'Administración Dos, Activa' }))

    expect(await screen.findByText('Arriendo en curso')).toBeInTheDocument()
    expect(listByAdministration).toHaveBeenCalledWith('admin-2')
  })

  it('shows a loading state for rentals once the administration resolves, before rentals settle', async () => {
    resolveOneAdministration()
    listByAdministration.mockReturnValueOnce(new Promise(() => {}))
    renderPage()

    await waitFor(() => {
      expect(listByAdministration).toHaveBeenCalledWith('admin-1')
    })
    expect(screen.getByTestId('rentals-loading')).toBeInTheDocument()
  })

  it('shows an error state when fetching rentals fails', async () => {
    resolveOneAdministration()
    listByAdministration.mockRejectedValueOnce(new Error('boom'))
    renderPage()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('shows the empty state when the administration has no rentals', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([])
    renderPage()

    expect(await screen.findByText('Aún no tienes arriendos')).toBeInTheDocument()
  })

  it('shows the real rentals once the administration and rentals both resolve', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RENTAL_1])
    renderPage()

    expect(await screen.findByText('Arriendo en curso')).toBeInTheDocument()
    expect(listByAdministration).toHaveBeenCalledWith('admin-1')
  })

  it('never fetches rentals without a resolved administrationId', () => {
    listAccessibleAdministrations.mockReturnValueOnce(new Promise(() => {}))
    renderPage()

    expect(listByAdministration).not.toHaveBeenCalled()
  })

  it('the "Registrar arriendo" CTA navigates to /rentals/new', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RENTAL_1])
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Arriendo en curso')

    await user.click(screen.getByRole('button', { name: 'Registrar arriendo' }))

    expect(await screen.findByText('Add rental page')).toBeInTheDocument()
  })

  it('shows an enabled Activate button for a DRAFT rental when access and capacity both allow it', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RENTAL_DRAFT])
    renderPage()

    expect(await screen.findByRole('button', { name: 'Activar' })).toBeEnabled()
  })

  it('disables Activate and shows the management-access reason when the subscription denies access', async () => {
    resolveOneAdministration()
    getSubscription.mockResolvedValueOnce({ ...UNLIMITED_SUBSCRIPTION, status: 'EXPIRED' })
    listByAdministration.mockResolvedValueOnce([RENTAL_DRAFT])
    renderPage()

    expect(await screen.findByRole('button', { name: 'Activar' })).toBeDisabled()
    expect(
      await screen.findByText('Tu acceso de administración venció. Elige un plan para seguir gestionando tu cuenta.'),
    ).toBeInTheDocument()
  })

  it('disables Activate and shows the capacity reason when the active count already meets the limit', async () => {
    resolveOneAdministration()
    getSubscription.mockResolvedValueOnce({ ...UNLIMITED_SUBSCRIPTION, activeRelationshipLimit: 1 })
    listByAdministration.mockResolvedValueOnce([RENTAL_1, RENTAL_DRAFT])
    renderPage()

    expect(await screen.findByRole('button', { name: 'Activar' })).toBeDisabled()
    expect(await screen.findByText('Alcanzaste el límite de relaciones activas de tu plan.')).toBeInTheDocument()
  })

  it('clicking Activate calls activate_rental_relationship with the real relationshipId', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RENTAL_DRAFT])
    activate.mockReturnValueOnce(new Promise(() => {}))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Activar' }))

    expect(activate).toHaveBeenCalledWith('rental-draft-1')
  })

  it('shows a mapped error message scoped to the failed rental when activation is rejected', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RENTAL_DRAFT])
    activate.mockRejectedValueOnce(new RentalActivationError('capacity_reached'))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Activar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Alcanzaste el límite de relaciones activas de tu plan.',
    )
  })
})

import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import RentalTermsPage from './RentalTermsPage'

const { listAccessibleAdministrations } = vi.hoisted(() => ({
  listAccessibleAdministrations: vi.fn(),
}))
const { getSubscription } = vi.hoisted(() => ({ getSubscription: vi.fn() }))
const { listByAdministration, updateSchedule } = vi.hoisted(() => ({
  listByAdministration: vi.fn(),
  updateSchedule: vi.fn(),
}))
const { create, getCurrent } = vi.hoisted(() => ({ create: vi.fn(), getCurrent: vi.fn() }))

vi.mock('@/features/administration/infrastructure/supabase-administration.repository', () => ({
  supabaseAdministrationRepository: { listAccessibleAdministrations },
}))

vi.mock('@/features/administration/infrastructure/supabase-subscription.repository', () => ({
  supabaseSubscriptionRepository: { getSubscription },
}))

vi.mock('../infrastructure/supabase-rental.repository', () => ({
  supabaseRentalRepository: {
    listByAdministration,
    createDraft: vi.fn(),
    activate: vi.fn(),
    updateSchedule,
  },
}))

vi.mock('../infrastructure/supabase-rental-terms.repository', () => ({
  supabaseRentalTermsRepository: { create, getCurrent },
}))

const RENTAL_DRAFT = {
  id: 'rental-1',
  administrationId: 'admin-1',
  status: 'DRAFT' as const,
  jurisdictionCountry: 'CO',
  realStartDate: null,
  trackingStartDate: null,
  expectedEndDate: null,
  actualEndDate: null,
  paymentDay: null,
  paymentTiming: null,
}

const UPDATED_RELATIONSHIP = {
  ...RENTAL_DRAFT,
  realStartDate: '2026-01-01',
  trackingStartDate: '2026-01-01',
  paymentDay: 5,
  paymentTiming: 'ADVANCE' as const,
}

const TERM_VERSION = {
  id: 'term-1',
  rentalRelationshipId: 'rental-1',
  versionNumber: 1,
  effectiveFrom: '2026-01-01',
  effectiveUntil: null,
  rentAmount: 1000000,
  administrationMode: 'NONE' as const,
  utilitiesMode: null,
  createdAt: '2026-01-01T00:00:00Z',
}

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

function renderPage(entry = '/rentals/rental-1/terms') {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/rentals/:id/terms" element={<RentalTermsPage />} />
          <Route path="/rentals" element={<div>Rentals page</div>} />
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

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Fecha real de inicio'), '2026-01-01')
  await user.type(screen.getByLabelText('Fecha de inicio de seguimiento'), '2026-01-01')
  await user.type(screen.getByLabelText('Día de pago'), '5')
  await user.type(screen.getByLabelText('Valor del arriendo'), '1000000')
}

describe('RentalTermsPage', () => {
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

    expect(screen.getByTestId('rental-terms-loading')).toBeInTheDocument()
  })

  it('shows a loading state while rentals/term version are still resolving', async () => {
    resolveOneAdministration()
    listByAdministration.mockReturnValueOnce(new Promise(() => {}))
    getCurrent.mockReturnValueOnce(new Promise(() => {}))
    renderPage()

    await waitFor(() => {
      expect(listByAdministration).toHaveBeenCalledWith('admin-1')
    })
    expect(screen.getByTestId('rental-terms-loading')).toBeInTheDocument()
  })

  it('shows an error when the relationshipId in the URL does not match any rental of this administration', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([])
    getCurrent.mockResolvedValueOnce(null)
    renderPage()

    expect(await screen.findByText('No encontramos este arriendo en tu administración.')).toBeInTheDocument()
  })

  it('renders the editable form when no term version exists yet', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RENTAL_DRAFT])
    getCurrent.mockResolvedValueOnce(null)
    renderPage()

    expect(await screen.findByRole('button', { name: 'Guardar términos' })).toBeInTheDocument()
    expect(screen.getByLabelText('Fecha real de inicio')).toBeEnabled()
  })

  it('renders a read-only, pre-filled view when a term version already exists', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([UPDATED_RELATIONSHIP])
    getCurrent.mockResolvedValueOnce(TERM_VERSION)
    renderPage()

    expect(
      await screen.findByText('Estos términos ya fueron registrados y no se pueden editar todavía.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Valor del arriendo')).toBeDisabled()
    expect(screen.getByLabelText('Valor del arriendo')).toHaveValue(1000000)
    expect(screen.queryByRole('button', { name: 'Guardar términos' })).not.toBeInTheDocument()
  })

  it('renders the read-only view (not the editable form) for a non-DRAFT relationship even when no term version exists yet', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([{ ...UPDATED_RELATIONSHIP, status: 'ACTIVE' as const }])
    getCurrent.mockResolvedValueOnce(null)
    renderPage()

    expect(
      await screen.findByText('Estos términos ya fueron registrados y no se pueden editar todavía.'),
    ).toBeInTheDocument()
    expect(screen.getByText('No hay condiciones financieras registradas para este arriendo.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Valor del arriendo')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar términos' })).not.toBeInTheDocument()
  })

  it('calls updateSchedule then rentalTermsRepository.create, in that order, and navigates to /rentals on success', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RENTAL_DRAFT])
    getCurrent.mockResolvedValueOnce(null)
    const calls: string[] = []
    updateSchedule.mockImplementationOnce(() => {
      calls.push('updateSchedule')
      return Promise.resolve(UPDATED_RELATIONSHIP)
    })
    create.mockImplementationOnce(() => {
      calls.push('create')
      return Promise.resolve(TERM_VERSION)
    })
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('button', { name: 'Guardar términos' })

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Guardar términos' }))

    expect(await screen.findByText('Rentals page')).toBeInTheDocument()
    expect(calls).toEqual(['updateSchedule', 'create'])
  })

  it('shows the generic error when updateSchedule itself fails - nothing was saved', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RENTAL_DRAFT])
    getCurrent.mockResolvedValueOnce(null)
    updateSchedule.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('button', { name: 'Guardar términos' })

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Guardar términos' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos guardar los términos de este arriendo. Intenta de nuevo.',
    )
  })

  it('shows the distinguishable partial-failure error when updateSchedule succeeds but create fails', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RENTAL_DRAFT])
    getCurrent.mockResolvedValueOnce(null)
    updateSchedule.mockResolvedValueOnce(UPDATED_RELATIONSHIP)
    create.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('button', { name: 'Guardar términos' })

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Guardar términos' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Guardamos las fechas y el pago, pero no pudimos guardar el valor del arriendo. Intenta de nuevo para completarlo.',
    )
  })

  it('disables the submit button and shows the shared management-access reason when blocked', async () => {
    resolveOneAdministration()
    getSubscription.mockResolvedValueOnce({ ...UNLIMITED_SUBSCRIPTION, status: 'EXPIRED' })
    listByAdministration.mockResolvedValueOnce([RENTAL_DRAFT])
    getCurrent.mockResolvedValueOnce(null)
    renderPage()

    expect(await screen.findByRole('button', { name: 'Guardar términos' })).toBeDisabled()
    expect(
      await screen.findByText('Tu acceso de administración venció. Elige un plan para seguir gestionando tu cuenta.'),
    ).toBeInTheDocument()
  })
})

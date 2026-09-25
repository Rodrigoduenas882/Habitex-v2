import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import type { Charge, ChargeFinancialStatus } from '../domain/charge.types'
import RentalChargesPage from './RentalChargesPage'

const { listAccessibleAdministrations } = vi.hoisted(() => ({
  listAccessibleAdministrations: vi.fn(),
}))
const { getSubscription } = vi.hoisted(() => ({ getSubscription: vi.fn() }))
const { listByAdministration } = vi.hoisted(() => ({ listByAdministration: vi.fn() }))
const { listByRelationship, generateRentCharges } = vi.hoisted(() => ({
  listByRelationship: vi.fn(),
  generateRentCharges: vi.fn(),
}))

vi.mock('@/features/administration/infrastructure/supabase-administration.repository', () => ({
  supabaseAdministrationRepository: { listAccessibleAdministrations },
}))

vi.mock('@/features/administration/infrastructure/supabase-subscription.repository', () => ({
  supabaseSubscriptionRepository: { getSubscription },
}))

vi.mock('@/features/rentals/infrastructure/supabase-rental.repository', () => ({
  supabaseRentalRepository: {
    listByAdministration,
    createDraft: vi.fn(),
    activate: vi.fn(),
    updateSchedule: vi.fn(),
    cancelDraft: vi.fn(),
    startEnding: vi.fn(),
    end: vi.fn(),
  },
}))

vi.mock('../infrastructure/supabase-charge.repository', () => ({
  supabaseChargeRepository: {
    listByRelationship,
    generateRentCharges,
  },
}))

function baseRelationship(status: 'DRAFT' | 'ACTIVE' | 'ENDING' | 'ENDED' | 'CANCELLED') {
  return {
    id: 'rel-1',
    administrationId: 'admin-1',
    status,
    jurisdictionCountry: 'CO',
    realStartDate: '2026-01-01',
    trackingStartDate: '2026-01-01',
    expectedEndDate: null,
    actualEndDate: null,
    paymentDay: 5,
    paymentTiming: 'ADVANCE' as const,
  }
}

function makeCharge(overrides: Partial<Charge> = {}): Charge {
  return {
    id: 'charge-1',
    administrationId: 'admin-1',
    rentalRelationshipId: 'rel-1',
    chargeType: 'RENT',
    origin: 'SYSTEM',
    description: 'Renta de enero',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    dueDate: '2026-01-05',
    amount: 1_000_000,
    currency: 'COP',
    sourceType: null,
    sourceId: null,
    createdAt: '2026-01-01T00:00:00Z',
    paidAmount: 0,
    balance: 1_000_000,
    financialStatus: 'PENDING',
    ...overrides,
  }
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

function renderPage(entry = '/rentals/rel-1/charges') {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/rentals/:id/charges" element={<RentalChargesPage />} />
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

describe('RentalChargesPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    getSubscription.mockResolvedValue(UNLIMITED_SUBSCRIPTION)
  })

  afterEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it('shows an error when the relationship id in the URL does not belong to this administration', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([])
    listByRelationship.mockResolvedValueOnce([])
    renderPage()

    expect(await screen.findByText('No encontramos este arriendo en tu administración.')).toBeInTheDocument()
  })

  it('shows the loading state while resolving', () => {
    // Every dependency hangs forever (never resolves) so nothing progresses
    // past the outer 'loading' branch during this test - a resolving mock
    // here would leak into later tests, since this synchronous test returns
    // before the query settles (see the equivalent hung-promise pattern
    // used for RentalsGridSkeleton in RentalsPage.test.tsx).
    listAccessibleAdministrations.mockReturnValueOnce(new Promise(() => {}))
    renderPage()

    expect(screen.getByTestId('rental-charges-loading')).toBeInTheDocument()
  })

  it('shows an error alert when the charges query fails', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
    listByRelationship.mockRejectedValueOnce(new Error('boom'))
    renderPage()

    expect(await screen.findByText('No pudimos cargar los cargos')).toBeInTheDocument()
  })

  it('shows the empty state when the relationship has no charges yet', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
    listByRelationship.mockResolvedValueOnce([])
    renderPage()

    expect(await screen.findByText('Todavía no hay cargos para este arriendo')).toBeInTheDocument()
  })

  it('lists a charge with type, description, period, due date, amount, paid amount and balance', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
    listByRelationship.mockResolvedValueOnce([
      makeCharge({ paidAmount: 400_000, balance: 600_000, financialStatus: 'PARTIAL' }),
    ])
    renderPage()

    expect(await screen.findByText('Renta')).toBeInTheDocument()
    expect(screen.getByText('Renta de enero')).toBeInTheDocument()
    expect(screen.getByText(/Periodo:/)).toBeInTheDocument()
    expect(screen.getByText(/Vence el/)).toBeInTheDocument()
    expect(screen.getByText('Valor: $1.000.000')).toBeInTheDocument()
    expect(screen.getByText('Pagado: $400.000')).toBeInTheDocument()
    expect(screen.getByText('Saldo: $600.000')).toBeInTheDocument()
  })

  it('omits the period line when periodStart/periodEnd are null', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
    listByRelationship.mockResolvedValueOnce([makeCharge({ periodStart: null, periodEnd: null })])
    renderPage()

    await screen.findByText('Renta de enero')
    expect(screen.queryByText(/Periodo:/)).not.toBeInTheDocument()
  })

  const STATUS_BADGE: Record<ChargeFinancialStatus, string> = {
    PENDING: 'Pendiente',
    OVERDUE: 'Vencido',
    PARTIAL: 'Pago parcial',
    PAID: 'Pagado',
  }

  for (const status of Object.keys(STATUS_BADGE) as ChargeFinancialStatus[]) {
    it(`renders the expected badge copy for financial status ${status}`, async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
      listByRelationship.mockResolvedValueOnce([makeCharge({ financialStatus: status })])
      renderPage()

      expect(await screen.findByText(STATUS_BADGE[status])).toBeInTheDocument()
    })
  }

  it('shows the "Generar cargos de renta" action for ACTIVE, ENDING and ENDED relationships', async () => {
    for (const status of ['ACTIVE', 'ENDING', 'ENDED'] as const) {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([baseRelationship(status)])
      listByRelationship.mockResolvedValueOnce([])
      const { unmount } = renderPage()

      expect(await screen.findByRole('button', { name: 'Generar cargos de renta' })).toBeInTheDocument()
      unmount()
      vi.clearAllMocks()
      getSubscription.mockResolvedValue(UNLIMITED_SUBSCRIPTION)
    }
  })

  it('hides the "Generar cargos de renta" action for DRAFT and CANCELLED relationships', async () => {
    for (const status of ['DRAFT', 'CANCELLED'] as const) {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([baseRelationship(status)])
      listByRelationship.mockResolvedValueOnce([])
      const { unmount } = renderPage()

      await screen.findByText('Cargos')
      expect(screen.queryByRole('button', { name: 'Generar cargos de renta' })).not.toBeInTheDocument()
      unmount()
      vi.clearAllMocks()
      getSubscription.mockResolvedValue(UNLIMITED_SUBSCRIPTION)
    }
  })

  it('disables generation and shows the management-access reason when blocked, without hiding the charge list', async () => {
    resolveOneAdministration()
    getSubscription.mockResolvedValueOnce({ ...UNLIMITED_SUBSCRIPTION, status: 'EXPIRED' })
    listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
    listByRelationship.mockResolvedValueOnce([makeCharge({ financialStatus: 'PAID' })])
    renderPage()

    const generateButton = await screen.findByRole('button', { name: 'Generar cargos de renta' })
    expect(generateButton).toBeDisabled()
    expect(
      await screen.findByText('Tu acceso de administración venció. Elige un plan para seguir gestionando tu cuenta.'),
    ).toBeInTheDocument()
    // The read-only charge list remains fully visible.
    expect(screen.getByText('Pagado')).toBeInTheDocument()
    expect(screen.getByText('Renta de enero')).toBeInTheDocument()
  })

  it('disables the generate button while the mutation is pending, preventing a duplicate submission', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
    listByRelationship.mockResolvedValue([])
    let resolveGenerate: (value: { createdCount: number }) => void = () => {}
    generateRentCharges.mockImplementationOnce(
      () =>
        new Promise<{ createdCount: number }>((resolve) => {
          resolveGenerate = resolve
        }),
    )
    const user = userEvent.setup()
    renderPage()

    const generateButton = await screen.findByRole('button', { name: 'Generar cargos de renta' })
    await user.click(generateButton)

    await waitFor(() => {
      expect(generateButton).toBeDisabled()
    })
    // A second click while pending must not queue a second call.
    await user.click(generateButton)
    expect(generateRentCharges).toHaveBeenCalledTimes(1)

    resolveGenerate({ createdCount: 0 })
    await waitFor(() => {
      expect(generateRentCharges).toHaveBeenCalledTimes(1)
    })
  })

  it('calls generateRentCharges with only the relationship id and refetches the charges list on success', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
    listByRelationship.mockResolvedValueOnce([])
    listByRelationship.mockResolvedValueOnce([makeCharge()])
    generateRentCharges.mockResolvedValueOnce({ createdCount: 1 })
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Todavía no hay cargos para este arriendo')
    await user.click(await screen.findByRole('button', { name: 'Generar cargos de renta' }))

    await waitFor(() => {
      expect(generateRentCharges).toHaveBeenCalledWith('rel-1')
    })
    await waitFor(() => {
      expect(listByRelationship).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('Renta de enero')).toBeInTheDocument()
  })

  it('shows a positive "N cargo(s) generado(s)" message when createdCount > 0', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
    listByRelationship.mockResolvedValue([])
    generateRentCharges.mockResolvedValueOnce({ createdCount: 3 })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Generar cargos de renta' }))

    expect(await screen.findByText('3 cargo(s) generado(s).')).toBeInTheDocument()
  })

  it('shows the "no había cargos nuevos" message when createdCount is 0 - a successful outcome, not an error', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
    listByRelationship.mockResolvedValue([])
    generateRentCharges.mockResolvedValueOnce({ createdCount: 0 })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Generar cargos de renta' }))

    expect(await screen.findByText('No había cargos nuevos por generar.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the mapped error copy when generation fails', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
    listByRelationship.mockResolvedValue([])
    const { ChargeRepositoryError } = await import('../domain/charge.types')
    generateRentCharges.mockRejectedValueOnce(new ChargeRepositoryError('billing_configuration_incomplete'))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Generar cargos de renta' }))

    expect(
      await screen.findByText('Completa las fechas y el día de pago de este arriendo antes de generar cargos.'),
    ).toBeInTheDocument()
  })

  it('never renders any manual charge creation UI', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
    listByRelationship.mockResolvedValueOnce([makeCharge()])
    renderPage()

    await screen.findByText('Renta de enero')
    expect(screen.queryByRole('button', { name: /agregar cargo|nuevo cargo|crear cargo|registrar cargo/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/valor del cargo|tipo de cargo/i)).not.toBeInTheDocument()
  })

  it('never renders any edit/delete/void action for a charge', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
    listByRelationship.mockResolvedValueOnce([makeCharge()])
    renderPage()

    await screen.findByText('Renta de enero')
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /anular/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })
})

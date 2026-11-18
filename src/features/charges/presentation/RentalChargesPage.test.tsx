import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
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
// Cross-feature mock (this page's new "historial de pagos" section reads
// usePayments, P1 remediation on PR #31) - mirrors
// RentalPaymentsPage.test.tsx's own supabase-payment.repository mock
// shape exactly, never touching features/payments' real adapter. Defaults
// to an empty list in beforeEach below so every existing test (none of
// which cares about payments data) stays deterministic without having to
// mock it individually.
const {
  listPaymentsByRelationship,
  reportPayment,
  confirmPayment,
  rejectPayment,
  listAllocationsForPayment,
  allocatePayment,
  getReceiptForPayment,
  issueReceipt,
} = vi.hoisted(() => ({
  listPaymentsByRelationship: vi.fn(),
  reportPayment: vi.fn(),
  confirmPayment: vi.fn(),
  rejectPayment: vi.fn(),
  listAllocationsForPayment: vi.fn(),
  allocatePayment: vi.fn(),
  getReceiptForPayment: vi.fn(),
  issueReceipt: vi.fn(),
}))

vi.mock('@/features/payments/infrastructure/supabase-payment.repository', () => ({
  supabasePaymentRepository: {
    listByRelationship: listPaymentsByRelationship,
    reportPayment,
    confirmPayment,
    rejectPayment,
    listAllocationsForPayment,
    allocatePayment,
    getReceiptForPayment,
    issueReceipt,
  },
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

// RentalContextHeader (DS-002) resolves its own identity via
// useRentalIdentities - mocked to resolve empty/no-op so this page's own
// header falls back to the honest "not yet resolved" placeholder, keeping
// this file's existing assertions (none of which assert on identity)
// deterministic and fast.
vi.mock('@/features/rentals/infrastructure/supabase-rental-subject.repository', () => ({
  supabaseRentalSubjectRepository: {
    listByAdministration: vi.fn().mockResolvedValue([]),
    listRelationshipLinksByAdministration: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@/features/rentals/infrastructure/supabase-rental-participant.repository', () => ({
  supabaseRentalParticipantRepository: {
    listActiveTenantNamesByRelationshipIds: vi.fn().mockResolvedValue(new Map()),
  },
}))

vi.mock('@/features/rentals/infrastructure/supabase-rental-terms.repository', () => ({
  supabaseRentalTermsRepository: {
    create: vi.fn(),
    getCurrent: vi.fn(),
    listRelationshipIdsWithTerms: vi.fn(),
    listCurrentRentAmountsByRelationshipIds: vi.fn().mockResolvedValue(new Map()),
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
          <Route path="/rentals/:id/payments" element={<div>Payments page</div>} />
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
    listPaymentsByRelationship.mockResolvedValue([])
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

  it('renders the shared context header (heading + nav) above the page\'s own description and body (DS-002)', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
    listByRelationship.mockResolvedValueOnce([])
    renderPage()

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cargos' })).toHaveAttribute('aria-current', 'page')
    expect(
      screen.getByText('Consulta los cargos generados para este arriendo y su estado de pago.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Todavía no hay cargos para este arriendo')).toBeInTheDocument()
  })

  it('lists a charge with type, description, period, due date, amount, paid amount and balance', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
    listByRelationship.mockResolvedValueOnce([
      makeCharge({ paidAmount: 400_000, balance: 600_000, financialStatus: 'PARTIAL' }),
    ])
    renderPage()

    // Scoped to the compact-card list: the same charge also renders in the
    // desktop table (P1 remediation on PR #31, "filas compactas para
    // escritorio") - both always exist in the DOM, CSS picks one per
    // breakpoint (docs/DESIGN.md §15.1/§15.3 precedent), so an unscoped
    // query would hit "multiple elements found" for type/description.
    const compactList = within(await screen.findByTestId('charges-compact-list'))
    const title = compactList.getByText('Renta')
    const description = compactList.getByText('Renta de enero')
    expect(description).toBeInTheDocument()
    expect(compactList.getByText(/Periodo:/)).toBeInTheDocument()
    expect(compactList.getByText(/Vence el/)).toBeInTheDocument()
    expect(compactList.getByText('Valor: $1.000.000')).toBeInTheDocument()
    expect(compactList.getByText('Pagado: $400.000')).toBeInTheDocument()
    expect(compactList.getByText('Saldo: $600.000')).toBeInTheDocument()
    // The IconBadge+identity header (P1 visual increment, Sprint 4) pairs
    // the type title with the description as its own secondary line -
    // never two unrelated nodes that merely happen to coexist on the page.
    expect(title.parentElement).toContainElement(description)

    // Same charge also reaches the desktop table, with real values (not a
    // second, independently-computed source of truth).
    const table = within(screen.getByTestId('charges-table'))
    expect(table.getByText('Renta')).toBeInTheDocument()
    expect(table.getByText('Renta de enero')).toBeInTheDocument()
    expect(table.getByText('$1.000.000')).toBeInTheDocument()
    expect(table.getByText('$400.000')).toBeInTheDocument()
    expect(table.getByText('$600.000')).toBeInTheDocument()
  })

  it('omits the period line when periodStart/periodEnd are null', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
    listByRelationship.mockResolvedValueOnce([makeCharge({ periodStart: null, periodEnd: null })])
    renderPage()

    const compactList = within(await screen.findByTestId('charges-compact-list'))
    await compactList.findByText('Renta de enero')
    expect(compactList.queryByText(/Periodo:/)).not.toBeInTheDocument()
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

      // The same Badge text renders once in the compact card and once in
      // the desktop table (both always in the DOM, see charges-table/
      // charges-compact-list above) - exactly 2 matches confirms neither
      // render dropped the status, without picking one arbitrarily.
      expect(await screen.findAllByText(STATUS_BADGE[status])).toHaveLength(2)
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
    // The read-only charge list remains fully visible (table + compact
    // card, both always in the DOM - see charges-table/charges-compact-list).
    expect(screen.getAllByText('Pagado')).toHaveLength(2)
    expect(screen.getAllByText('Renta de enero')).toHaveLength(2)
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
    expect(await screen.findAllByText('Renta de enero')).toHaveLength(2)
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

    await screen.findAllByText('Renta de enero')
    expect(screen.queryByRole('button', { name: /agregar cargo|nuevo cargo|crear cargo|registrar cargo/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/valor del cargo|tipo de cargo/i)).not.toBeInTheDocument()
  })

  it('never renders any edit/delete/void action for a charge', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
    listByRelationship.mockResolvedValueOnce([makeCharge()])
    renderPage()

    await screen.findAllByText('Renta de enero')
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /anular/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  describe('resumen financiero (P1 remediation, Codex NO-GO on PR #31 - Figma 372:3/372:330)', () => {
    it('sums real per-charge amount/paidAmount/balance across multiple charges - never a fabricated or re-derived total', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
      listByRelationship.mockResolvedValueOnce([
        makeCharge({ id: 'charge-1', amount: 1_000_000, paidAmount: 400_000, balance: 600_000 }),
        makeCharge({ id: 'charge-2', amount: 200_000, paidAmount: 120_000, balance: 80_000, financialStatus: 'PARTIAL' }),
      ])
      renderPage()

      await screen.findByText('Resumen financiero')
      // 1.000.000 + 200.000 = 1.200.000; 400.000 + 120.000 = 520.000;
      // 600.000 + 80.000 = 680.000 - plain sums of the already-fetched,
      // server-derived per-charge fields, nothing recomputed from payments.
      // None of these totals collide with either individual charge's own
      // displayed amount/paidAmount/balance, so each match below is
      // unambiguously the summary tile, not a per-charge row.
      expect(screen.getByText('$1.200.000')).toBeInTheDocument()
      expect(screen.getByText('$520.000')).toBeInTheDocument()
      expect(screen.getByText('$680.000')).toBeInTheDocument()
    })

    it('never renders the financial summary when there are zero charges - no fabricated $0', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
      listByRelationship.mockResolvedValueOnce([])
      renderPage()

      await screen.findByText('Todavía no hay cargos para este arriendo')
      expect(screen.queryByText('Resumen financiero')).not.toBeInTheDocument()
    })

    it('the "Saldo pendiente" tile links to this relationship\'s own /payments route - the only contextual navigation to payment detail, never a duplicated action here', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
      listByRelationship.mockResolvedValueOnce([makeCharge()])
      renderPage()

      await screen.findByText('Resumen financiero')
      const balanceLink = screen.getByText('Saldo pendiente').closest('a')
      expect(balanceLink).toHaveAttribute('href', '/rentals/rel-1/payments')
    })
  })

  describe('historial de pagos (P1 remediation, Codex NO-GO on PR #31 - Figma 372:3/372:330)', () => {
    function makePayment(overrides: Record<string, unknown> = {}) {
      return {
        id: 'payment-1',
        administrationId: 'admin-1',
        rentalRelationshipId: 'rel-1',
        reportedByPersonId: 'person-1',
        confirmedByPersonId: null,
        status: 'CONFIRMED' as const,
        amount: 500_000,
        currency: 'COP' as const,
        paymentDate: '2026-01-05',
        paymentMethod: null,
        externalReference: null,
        proofFileId: null,
        notes: null,
        reportedAt: '2026-01-05T10:00:00Z',
        confirmedAt: '2026-01-05T12:00:00Z',
        rejectedAt: null,
        rejectionReason: null,
        createdAt: '2026-01-05T10:00:00Z',
        updatedAt: '2026-01-05T12:00:00Z',
        ...overrides,
      }
    }

    it('shows each real payment\'s status/amount/date, with a link to the full Payments page - never an action here', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
      listByRelationship.mockResolvedValueOnce([])
      listPaymentsByRelationship.mockResolvedValueOnce([makePayment({ status: 'REPORTED', amount: 750_000 })])
      renderPage()

      expect(await screen.findByText('Reportado')).toBeInTheDocument()
      expect(screen.getByText('Valor: $750.000')).toBeInTheDocument()
      // No confirm/reject/allocate/receipt action anywhere in this preview -
      // those stay exclusively on /rentals/:id/payments.
      expect(screen.queryByRole('button', { name: 'Confirmar pago' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Rechazar pago' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Aplicar a cargos' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Emitir recibo' })).not.toBeInTheDocument()
    })

    it('navigating via "Ver todos los pagos" goes to this relationship\'s real /payments route', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
      listByRelationship.mockResolvedValueOnce([])
      listPaymentsByRelationship.mockResolvedValueOnce([makePayment()])
      const user = userEvent.setup()
      renderPage()

      await screen.findByText('Historial de pagos')
      await user.click(screen.getByRole('button', { name: 'Ver todos los pagos' }))

      expect(await screen.findByText('Payments page')).toBeInTheDocument()
    })

    it('shows the real "no payments" message, reusing payments.json\'s own empty copy - never a fabricated one', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
      listByRelationship.mockResolvedValueOnce([])
      listPaymentsByRelationship.mockResolvedValueOnce([])
      renderPage()

      expect(await screen.findByText('Todavía no hay pagos reportados para este arriendo')).toBeInTheDocument()
    })

    it('shows an error alert when the payments history query fails, independent of the charges list above it', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
      listByRelationship.mockResolvedValueOnce([makeCharge()])
      listPaymentsByRelationship.mockRejectedValueOnce(new Error('boom'))
      renderPage()

      await screen.findAllByText('Renta de enero')
      expect(
        await screen.findByText('Ocurrió un error al consultar los pagos de este arriendo. Intenta de nuevo más tarde.'),
      ).toBeInTheDocument()
    })

    it('shows the payments history even when the relationship has zero charges yet', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([baseRelationship('ACTIVE')])
      listByRelationship.mockResolvedValueOnce([])
      listPaymentsByRelationship.mockResolvedValueOnce([makePayment()])
      renderPage()

      await screen.findByText('Todavía no hay cargos para este arriendo')
      expect(await screen.findByText('Valor: $500.000')).toBeInTheDocument()
    })
  })
})

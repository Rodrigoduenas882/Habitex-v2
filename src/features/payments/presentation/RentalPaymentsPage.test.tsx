import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { administrationQueryKeys } from '@/features/administration/application/administration-query-keys'
import type { Charge } from '@/features/charges/domain/charge.types'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { PaymentRepositoryError, type Payment, type PaymentAllocation, type Receipt } from '../domain/payment.types'
import RentalPaymentsPage from './RentalPaymentsPage'

const { listAccessibleAdministrations } = vi.hoisted(() => ({
  listAccessibleAdministrations: vi.fn(),
}))
const { getSubscription } = vi.hoisted(() => ({ getSubscription: vi.fn() }))
const { listByAdministration } = vi.hoisted(() => ({ listByAdministration: vi.fn() }))
const {
  listByRelationship,
  reportPayment,
  confirmPayment,
  rejectPayment,
  listAllocationsForPayment,
  allocatePayment,
  getReceiptForPayment,
  issueReceipt,
} = vi.hoisted(() => ({
  listByRelationship: vi.fn(),
  reportPayment: vi.fn(),
  confirmPayment: vi.fn(),
  rejectPayment: vi.fn(),
  listAllocationsForPayment: vi.fn(),
  allocatePayment: vi.fn(),
  getReceiptForPayment: vi.fn(),
  issueReceipt: vi.fn(),
}))
const { listChargesByRelationship } = vi.hoisted(() => ({ listChargesByRelationship: vi.fn() }))
const { uploadFile, getFileById, downloadFile } = vi.hoisted(() => ({
  uploadFile: vi.fn(),
  getFileById: vi.fn(),
  downloadFile: vi.fn(),
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

vi.mock('../infrastructure/supabase-payment.repository', () => ({
  supabasePaymentRepository: {
    listByRelationship,
    reportPayment,
    confirmPayment,
    rejectPayment,
    listAllocationsForPayment,
    allocatePayment,
    getReceiptForPayment,
    issueReceipt,
  },
}))

// Cross-feature mock for useCharges' own adapter (used by the inline
// allocation section's eligible-charges list) - mirrors this file's own
// supabase-payment.repository mock, never touching features/charges' real
// code.
vi.mock('@/features/charges/infrastructure/supabase-charge.repository', () => ({
  supabaseChargeRepository: {
    listByRelationship: listChargesByRelationship,
    generateRentCharges: vi.fn(),
  },
}))

vi.mock('@/features/documents/infrastructure/supabase-file.repository', () => ({
  supabaseFileRepository: {
    getById: getFileById,
    upload: uploadFile,
    download: downloadFile,
    remove: vi.fn(),
  },
}))

const RELATIONSHIP_ACTIVE = {
  id: 'rel-1',
  administrationId: 'admin-1',
  status: 'ACTIVE' as const,
  jurisdictionCountry: 'CO',
  realStartDate: '2026-01-01',
  trackingStartDate: '2026-01-01',
  expectedEndDate: null,
  actualEndDate: null,
  paymentDay: 5,
  paymentTiming: 'ADVANCE' as const,
}

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'payment-1',
    administrationId: 'admin-1',
    rentalRelationshipId: 'rel-1',
    reportedByPersonId: 'person-1',
    confirmedByPersonId: null,
    status: 'REPORTED',
    amount: 500_000,
    currency: 'COP',
    paymentDate: '2026-01-05',
    paymentMethod: null,
    externalReference: null,
    proofFileId: null,
    notes: null,
    reportedAt: '2026-01-05T10:00:00Z',
    confirmedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    createdAt: '2026-01-05T10:00:00Z',
    updatedAt: '2026-01-05T10:00:00Z',
    ...overrides,
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
    amount: 500_000,
    currency: 'COP',
    sourceType: null,
    sourceId: null,
    createdAt: '2026-01-01T00:00:00Z',
    paidAmount: 0,
    balance: 500_000,
    financialStatus: 'PENDING',
    ...overrides,
  }
}

function makeAllocation(overrides: Partial<PaymentAllocation> = {}): PaymentAllocation {
  return {
    id: 'allocation-1',
    administrationId: 'admin-1',
    paymentId: 'payment-1',
    chargeId: 'charge-1',
    amount: 100_000,
    createdAt: '2026-01-06T00:00:00Z',
    ...overrides,
  }
}

function makeReceipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    id: 'receipt-1',
    administrationId: 'admin-1',
    rentalRelationshipId: 'rel-1',
    paymentId: 'payment-1',
    receiptNumber: 42,
    status: 'ISSUED',
    fileId: null,
    issuedAt: '2026-01-07T10:00:00Z',
    voidedAt: null,
    voidReason: null,
    createdAt: '2026-01-07T10:00:00Z',
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

// Returns the render result merged with its own QueryClient - some tests
// (e.g. a management-access gate flipping mid-session) simulate a cache
// change directly via client.setQueryData, the same technique already used
// by auth-reactivity.test.tsx, rather than inventing a new mechanism.
function renderPage(entry = '/rentals/rel-1/payments') {
  const client = createTestQueryClient()
  const result = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/rentals/:id/payments" element={<RentalPaymentsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...result, client }
}

function resolveOneAdministration() {
  listAccessibleAdministrations.mockResolvedValueOnce([
    { id: 'admin-1', name: 'Administración Uno', status: 'ACTIVE' },
  ])
}

describe('RentalPaymentsPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    getSubscription.mockResolvedValue(UNLIMITED_SUBSCRIPTION)
    getFileById.mockResolvedValue(null)
    // Default to "no allocations yet"/"no charges yet" - usePaymentAllocations
    // only ever fires for a CONFIRMED payment and useCharges only once the
    // inline allocation section opens, so most tests never depend on these,
    // but a CONFIRMED payment appearing anywhere (including via a refetch
    // after confirmPayment succeeds) must never see rejected/undefined data.
    listAllocationsForPayment.mockResolvedValue([])
    listChargesByRelationship.mockResolvedValue([])
    // Default to "no receipt issued yet" - usePaymentReceipt only ever fires
    // for a CONFIRMED payment, but a CONFIRMED payment appearing anywhere
    // (including via a refetch after confirmPayment succeeds) must never see
    // rejected/undefined data.
    getReceiptForPayment.mockResolvedValue(null)
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

  it('shows the empty-state message when the relationship has no payments yet', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
    listByRelationship.mockResolvedValueOnce([])
    renderPage()

    expect(await screen.findByText('Todavía no hay pagos reportados para este arriendo')).toBeInTheDocument()
  })

  it('renders the shared context header (heading + nav) above the page\'s own description and body (DS-002)', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
    listByRelationship.mockResolvedValueOnce([])
    renderPage()

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pagos' })).toHaveAttribute('aria-current', 'page')
    expect(
      screen.getByText(
        'Consulta los pagos reportados para este arriendo y confirma o rechaza los que estén pendientes.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Todavía no hay pagos reportados para este arriendo')).toBeInTheDocument()
  })

  describe('report form', () => {
    it('shows both amount and payment date validation errors on an empty submit, without calling reportPayment', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([])
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Reportar pago' }))

      expect(await screen.findByText('Ingresa un valor de pago válido.')).toBeInTheDocument()
      expect(screen.getByText('Ingresa la fecha de pago.')).toBeInTheDocument()
      expect(reportPayment).not.toHaveBeenCalled()
    })

    it('reports a payment with only the required fields, omitting optional ones', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([])
      reportPayment.mockResolvedValueOnce(makePayment())
      const user = userEvent.setup()
      renderPage()

      await user.type(await screen.findByLabelText('Valor pagado'), '500000')
      await user.type(screen.getByLabelText('Fecha de pago'), '2026-01-05')
      await user.click(screen.getByRole('button', { name: 'Reportar pago' }))

      await waitFor(() => {
        expect(reportPayment).toHaveBeenCalledTimes(1)
      })
      expect(reportPayment).toHaveBeenCalledWith({
        administrationId: 'admin-1',
        rentalRelationshipId: 'rel-1',
        amount: 500000,
        paymentDate: '2026-01-05',
      })
    })

    it('uploads the selected proof file (PAYMENT_PROOF) then reports the payment with its id', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([])
      const uploadedProof = {
        id: 'file-9',
        administrationId: 'admin-1',
        rentalRelationshipId: 'rel-1',
        purpose: 'PAYMENT_PROOF' as const,
        storageBucket: 'documents' as const,
        storagePath: 'admin-1/comprobante.png',
        originalName: 'comprobante.png',
        mimeType: 'image/png',
        sizeBytes: 4,
        sha256: null,
        uploadedByPersonId: null,
        createdAt: '2026-01-01T00:00:00Z',
      }
      uploadFile.mockResolvedValueOnce(uploadedProof)
      reportPayment.mockResolvedValueOnce(makePayment({ proofFileId: 'file-9' }))
      const user = userEvent.setup()
      renderPage()

      await user.type(await screen.findByLabelText('Valor pagado'), '500000')
      await user.type(screen.getByLabelText('Fecha de pago'), '2026-01-05')
      const fileInput = screen.getByLabelText('Comprobante de pago')
      const file = new File(['contenido'], 'comprobante.png', { type: 'image/png' })
      await user.upload(fileInput, file)
      await user.click(screen.getByRole('button', { name: 'Reportar pago' }))

      await waitFor(() => {
        expect(uploadFile).toHaveBeenCalledTimes(1)
      })
      expect(uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          administrationId: 'admin-1',
          rentalRelationshipId: 'rel-1',
          purpose: 'PAYMENT_PROOF',
        }),
      )
      await waitFor(() => {
        expect(reportPayment).toHaveBeenCalledWith(expect.objectContaining({ proofFileId: 'file-9' }))
      })
    })

    it('never re-uploads the proof file on a retry after reportPayment fails, reusing the same proofFileId on the second call', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([])
      const uploadedProof = {
        id: 'file-9',
        administrationId: 'admin-1',
        rentalRelationshipId: 'rel-1',
        purpose: 'PAYMENT_PROOF' as const,
        storageBucket: 'documents' as const,
        storagePath: 'admin-1/comprobante.png',
        originalName: 'comprobante.png',
        mimeType: 'image/png',
        sizeBytes: 4,
        sha256: null,
        uploadedByPersonId: null,
        createdAt: '2026-01-01T00:00:00Z',
      }
      uploadFile.mockResolvedValueOnce(uploadedProof)
      reportPayment.mockRejectedValueOnce(new Error('boom'))
      reportPayment.mockResolvedValueOnce(makePayment({ proofFileId: 'file-9' }))
      const user = userEvent.setup()
      renderPage()

      await user.type(await screen.findByLabelText('Valor pagado'), '500000')
      await user.type(screen.getByLabelText('Fecha de pago'), '2026-01-05')
      const fileInput = screen.getByLabelText('Comprobante de pago')
      const file = new File(['contenido'], 'comprobante.png', { type: 'image/png' })
      await user.upload(fileInput, file)

      const submitButton = screen.getByRole('button', { name: 'Reportar pago' })
      await user.click(submitButton)

      await waitFor(() => {
        expect(uploadFile).toHaveBeenCalledTimes(1)
      })
      await waitFor(() => {
        expect(reportPayment).toHaveBeenCalledTimes(1)
      })

      await user.click(screen.getByRole('button', { name: 'Reportar pago' }))

      await waitFor(() => {
        expect(reportPayment).toHaveBeenCalledTimes(2)
      })
      expect(uploadFile).toHaveBeenCalledTimes(1)
      expect(reportPayment).toHaveBeenNthCalledWith(2, expect.objectContaining({ proofFileId: 'file-9' }))
    })

    it('stays fully enabled and submittable for a participant/viewer whose management access is expired', async () => {
      resolveOneAdministration()
      getSubscription.mockResolvedValueOnce({ ...UNLIMITED_SUBSCRIPTION, status: 'EXPIRED' })
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([])
      reportPayment.mockResolvedValueOnce(makePayment())
      const user = userEvent.setup()
      renderPage()

      const submitButton = await screen.findByRole('button', { name: 'Reportar pago' })
      expect(submitButton).toBeEnabled()

      await user.type(screen.getByLabelText('Valor pagado'), '500000')
      await user.type(screen.getByLabelText('Fecha de pago'), '2026-01-05')
      await user.click(submitButton)

      await waitFor(() => {
        expect(reportPayment).toHaveBeenCalledTimes(1)
      })
    })

    it('does not hide the payment history or the report form when management access is expired', async () => {
      resolveOneAdministration()
      getSubscription.mockResolvedValueOnce({ ...UNLIMITED_SUBSCRIPTION, status: 'EXPIRED' })
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment()])
      renderPage()

      expect(await screen.findByText('Reportado')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reportar pago' })).toBeInTheDocument()
    })
  })

  describe('proof download', () => {
    it('shows a proof download button only when proofFileId is present', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([
        makePayment({ id: 'payment-a', proofFileId: 'file-1' }),
        makePayment({ id: 'payment-b', proofFileId: null }),
      ])
      renderPage()

      expect(await screen.findAllByRole('button', { name: 'Descargar comprobante' })).toHaveLength(1)
    })
  })

  describe('payment allocation', () => {
    for (const status of ['REPORTED', 'REJECTED', 'CANCELLED'] as const) {
      it(`shows no allocation action or allocated/remaining display for a ${status} payment`, async () => {
        resolveOneAdministration()
        listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
        listByRelationship.mockResolvedValueOnce([makePayment({ status })])
        renderPage()

        await screen.findByText('Pagos')
        expect(screen.queryByText(/^Aplicado:/)).not.toBeInTheDocument()
        expect(screen.queryByText(/^Pendiente por aplicar:/)).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Aplicar a cargos' })).not.toBeInTheDocument()
        expect(screen.queryByText('Pago aplicado completamente')).not.toBeInTheDocument()
      })
    }

    it('shows the allocated/remaining amounts and an enabled "Aplicar a cargos" for a CONFIRMED payment with a remaining balance', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValueOnce([makeAllocation({ amount: 100_000 })])
      renderPage()

      expect(await screen.findByText('Aplicado: $100.000')).toBeInTheDocument()
      expect(screen.getByText('Pendiente por aplicar: $400.000')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Aplicar a cargos' })).toBeEnabled()
    })

    it('disables "Aplicar a cargos" and shows the management-access reason when the gate denies, without hiding the amounts', async () => {
      resolveOneAdministration()
      getSubscription.mockResolvedValueOnce({ ...UNLIMITED_SUBSCRIPTION, status: 'EXPIRED' })
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValueOnce([])
      renderPage()

      expect(await screen.findByText('Aplicado: $0')).toBeInTheDocument()
      expect(screen.getByText('Pendiente por aplicar: $500.000')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Aplicar a cargos' })).toBeDisabled()
      expect(
        await screen.findAllByText('Tu acceso de administración venció. Elige un plan para seguir gestionando tu cuenta.'),
      ).not.toHaveLength(0)
    })

    it('shows "Pago aplicado completamente" and no "Aplicar a cargos" for a fully-allocated CONFIRMED payment', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValueOnce([makeAllocation({ amount: 500_000 })])
      renderPage()

      expect(await screen.findByText('Pago aplicado completamente')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Aplicar a cargos' })).not.toBeInTheDocument()
    })

    it('excludes a fully-paid charge and a charge already allocated by this payment, but includes an eligible same-relationship charge', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValueOnce([makeAllocation({ chargeId: 'charge-allocated', amount: 50_000 })])
      listChargesByRelationship.mockResolvedValueOnce([
        makeCharge({ id: 'charge-paid', description: 'Cargo pagado', balance: 0, financialStatus: 'PAID' }),
        makeCharge({ id: 'charge-allocated', description: 'Cargo ya aplicado', balance: 450_000 }),
        makeCharge({ id: 'charge-eligible', description: 'Cargo elegible', balance: 200_000 }),
      ])
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Aplicar a cargos' }))

      const select = await screen.findByLabelText('Cargo')
      const optionLabels = within(select)
        .getAllByRole('option')
        .map((option) => option.textContent)

      expect(optionLabels.some((label) => label.includes('Cargo elegible'))).toBe(true)
      expect(optionLabels.some((label) => label.includes('Cargo pagado'))).toBe(false)
      expect(optionLabels.some((label) => label.includes('Cargo ya aplicado'))).toBe(false)
    })

    it('shows an empty-state message when there are no eligible charges', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValueOnce([])
      listChargesByRelationship.mockResolvedValueOnce([makeCharge({ balance: 0, financialStatus: 'PAID' })])
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Aplicar a cargos' }))

      expect(await screen.findByText('No hay cargos elegibles para aplicar este pago.')).toBeInTheDocument()
    })

    it('shows the maximum applicable amount as min(paymentRemaining, charge.balance)', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      // remaining = 500_000 - 400_000 = 100_000, below the charge's own 300_000 balance
      listAllocationsForPayment.mockResolvedValueOnce([makeAllocation({ amount: 400_000 })])
      listChargesByRelationship.mockResolvedValueOnce([
        makeCharge({ id: 'charge-eligible', description: 'Cargo elegible', balance: 300_000 }),
      ])
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Aplicar a cargos' }))
      await user.selectOptions(await screen.findByLabelText('Cargo'), 'charge-eligible')

      expect(await screen.findByText('Máximo aplicable: $100.000')).toBeInTheDocument()
    })

    it('rejects an amount <= 0 client-side without calling allocatePayment', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValueOnce([])
      listChargesByRelationship.mockResolvedValueOnce([
        makeCharge({ id: 'charge-eligible', description: 'Cargo elegible', balance: 300_000 }),
      ])
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Aplicar a cargos' }))
      await user.selectOptions(await screen.findByLabelText('Cargo'), 'charge-eligible')
      await user.type(await screen.findByLabelText('Valor a aplicar'), '0')
      await user.click(screen.getByRole('button', { name: 'Aplicar' }))

      expect(await screen.findByText('Ingresa un valor válido para aplicar.')).toBeInTheDocument()
      expect(allocatePayment).not.toHaveBeenCalled()
    })

    it('rejects an amount above the maximum client-side without calling allocatePayment', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValueOnce([])
      listChargesByRelationship.mockResolvedValueOnce([
        makeCharge({ id: 'charge-eligible', description: 'Cargo elegible', balance: 300_000 }),
      ])
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Aplicar a cargos' }))
      await user.selectOptions(await screen.findByLabelText('Cargo'), 'charge-eligible')
      await user.type(await screen.findByLabelText('Valor a aplicar'), '999999')
      await user.click(screen.getByRole('button', { name: 'Aplicar' }))

      expect(await screen.findByText('El valor no puede superar el máximo aplicable a este cargo.')).toBeInTheDocument()
      expect(allocatePayment).not.toHaveBeenCalled()
    })

    it('allocates successfully, invalidating both the allocations and charges queries so the UI reflects fresh data', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValueOnce([])
      listAllocationsForPayment.mockResolvedValueOnce([makeAllocation({ amount: 150_000 })])
      listChargesByRelationship.mockResolvedValueOnce([
        makeCharge({ id: 'charge-eligible', description: 'Cargo elegible', balance: 300_000 }),
      ])
      listChargesByRelationship.mockResolvedValueOnce([
        makeCharge({
          id: 'charge-eligible',
          description: 'Cargo elegible',
          balance: 150_000,
          paidAmount: 150_000,
          financialStatus: 'PARTIAL',
        }),
      ])
      allocatePayment.mockResolvedValueOnce(makeAllocation({ amount: 150_000 }))
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Aplicar a cargos' }))
      await user.selectOptions(await screen.findByLabelText('Cargo'), 'charge-eligible')
      await user.type(await screen.findByLabelText('Valor a aplicar'), '150000')
      await user.click(screen.getByRole('button', { name: 'Aplicar' }))

      await waitFor(() => {
        expect(allocatePayment).toHaveBeenCalledWith({ paymentId: 'payment-1', chargeId: 'charge-eligible', amount: 150000 })
      })
      await waitFor(() => {
        expect(listAllocationsForPayment).toHaveBeenCalledTimes(2)
      })
      await waitFor(() => {
        expect(listChargesByRelationship).toHaveBeenCalledTimes(2)
      })
      expect(await screen.findByText('Aplicado: $150.000')).toBeInTheDocument()
      expect(screen.getByText('Pendiente por aplicar: $350.000')).toBeInTheDocument()
    })

    it('shows a friendly stale-state message and refetches allocations/charges on ALLOCATION_EXCEEDS_PAYMENT/ALLOCATION_EXCEEDS_CHARGE', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValueOnce([])
      // A concurrent allocation took most (not all) of the remaining amount
      // between this client's `maximum` computation and its own submit -
      // remainingAmount stays > 0 after the refetch, so the section (and its
      // error message) stays mounted instead of switching to "fully applied".
      listAllocationsForPayment.mockResolvedValueOnce([makeAllocation({ amount: 450_000 })])
      listChargesByRelationship.mockResolvedValueOnce([
        makeCharge({ id: 'charge-eligible', description: 'Cargo elegible', balance: 300_000 }),
      ])
      listChargesByRelationship.mockResolvedValueOnce([
        makeCharge({ id: 'charge-eligible', description: 'Cargo elegible', balance: 50_000 }),
      ])
      allocatePayment.mockRejectedValueOnce(new PaymentRepositoryError('allocation_exceeds_payment'))
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Aplicar a cargos' }))
      await user.selectOptions(await screen.findByLabelText('Cargo'), 'charge-eligible')
      await user.type(await screen.findByLabelText('Valor a aplicar'), '100000')
      await user.click(screen.getByRole('button', { name: 'Aplicar' }))

      expect(await screen.findByText('Ese valor ya no está disponible en este pago. Actualizando…')).toBeInTheDocument()
      await waitFor(() => {
        expect(listAllocationsForPayment).toHaveBeenCalledTimes(2)
      })
      await waitFor(() => {
        expect(listChargesByRelationship).toHaveBeenCalledTimes(2)
      })
    })

    it('maps a forbidden allocate_payment error to its own copy', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValueOnce([])
      listChargesByRelationship.mockResolvedValueOnce([
        makeCharge({ id: 'charge-eligible', description: 'Cargo elegible', balance: 300_000 }),
      ])
      allocatePayment.mockRejectedValueOnce(new PaymentRepositoryError('forbidden'))
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Aplicar a cargos' }))
      await user.selectOptions(await screen.findByLabelText('Cargo'), 'charge-eligible')
      await user.type(await screen.findByLabelText('Valor a aplicar'), '100000')
      await user.click(screen.getByRole('button', { name: 'Aplicar' }))

      expect(await screen.findByText('No tienes permiso para aplicar este pago a un cargo.')).toBeInTheDocument()
    })

    it('disables the amount input and submit button live, and never submits, once the management gate becomes blocked while the section is already open', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValueOnce([])
      listChargesByRelationship.mockResolvedValueOnce([
        makeCharge({ id: 'charge-eligible', description: 'Cargo elegible', balance: 300_000 }),
      ])
      const user = userEvent.setup()
      const { client } = renderPage()

      await user.click(await screen.findByRole('button', { name: 'Aplicar a cargos' }))
      await user.selectOptions(await screen.findByLabelText('Cargo'), 'charge-eligible')
      const amountInput = await screen.findByLabelText('Valor a aplicar')
      const submitButton = screen.getByRole('button', { name: 'Aplicar' })
      expect(amountInput).toBeEnabled()
      expect(submitButton).toBeEnabled()
      await user.type(amountInput, '100000')

      // Simulates the subscription expiring mid-session (e.g. the
      // subscription query refetching in the background) - same technique as
      // auth-reactivity.test.tsx's own direct client.setQueryData usage,
      // rather than a real refetch/timer.
      client.setQueryData(administrationQueryKeys.subscription('admin-1'), {
        ...UNLIMITED_SUBSCRIPTION,
        status: 'EXPIRED',
      })

      await waitFor(() => {
        expect(submitButton).toBeDisabled()
      })
      expect(amountInput).toBeDisabled()
      expect(
        await screen.findAllByText('Tu acceso de administración venció. Elige un plan para seguir gestionando tu cuenta.'),
      ).not.toHaveLength(0)

      await user.click(submitButton)
      expect(allocatePayment).not.toHaveBeenCalled()
    })

    describe.each([
      ['allocation_exceeds_payment', 'Ese valor ya no está disponible en este pago. Actualizando…'] as const,
      ['allocation_exceeds_charge', 'Ese valor ya no está disponible para este cargo. Actualizando…'] as const,
    ])('a stale %s failure whose refetch reports the payment as fully applied', (code, expectedMessage) => {
      it('keeps the failure message visible alongside the "fully applied" success state, instead of one silently replacing the other', async () => {
        resolveOneAdministration()
        listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
        listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
        listAllocationsForPayment.mockResolvedValueOnce([])
        // A concurrent allocation won the race and, by the time this
        // client's own failed attempt triggers a refetch, fully applies the
        // payment - remainingAmount becomes 0 after the refetch.
        listAllocationsForPayment.mockResolvedValueOnce([makeAllocation({ amount: 500_000 })])
        listChargesByRelationship.mockResolvedValueOnce([
          makeCharge({ id: 'charge-eligible', description: 'Cargo elegible', balance: 300_000 }),
        ])
        listChargesByRelationship.mockResolvedValueOnce([
          makeCharge({
            id: 'charge-eligible',
            description: 'Cargo elegible',
            balance: 0,
            paidAmount: 300_000,
            financialStatus: 'PAID',
          }),
        ])
        allocatePayment.mockRejectedValueOnce(new PaymentRepositoryError(code))
        const user = userEvent.setup()
        renderPage()

        await user.click(await screen.findByRole('button', { name: 'Aplicar a cargos' }))
        await user.selectOptions(await screen.findByLabelText('Cargo'), 'charge-eligible')
        await user.type(await screen.findByLabelText('Valor a aplicar'), '100000')
        await user.click(screen.getByRole('button', { name: 'Aplicar' }))

        expect(await screen.findByText(expectedMessage)).toBeInTheDocument()
        expect(await screen.findByText('Pago aplicado completamente')).toBeInTheDocument()
      })
    })

    it('clears a previous stale-allocation error once "Aplicar a cargos" is opened again for a fresh attempt', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValueOnce([])
      // The refetch after the stale failure still reports a remaining
      // balance > 0, so the trigger button re-appears instead of "fully
      // applied" - the scenario where the cleared-on-reopen behavior is
      // actually observable.
      listAllocationsForPayment.mockResolvedValueOnce([makeAllocation({ amount: 450_000 })])
      listChargesByRelationship.mockResolvedValueOnce([
        makeCharge({ id: 'charge-eligible', description: 'Cargo elegible', balance: 300_000 }),
      ])
      listChargesByRelationship.mockResolvedValueOnce([
        makeCharge({ id: 'charge-eligible', description: 'Cargo elegible', balance: 50_000 }),
      ])
      allocatePayment.mockRejectedValueOnce(new PaymentRepositoryError('allocation_exceeds_payment'))
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Aplicar a cargos' }))
      await user.selectOptions(await screen.findByLabelText('Cargo'), 'charge-eligible')
      await user.type(await screen.findByLabelText('Valor a aplicar'), '100000')
      await user.click(screen.getByRole('button', { name: 'Aplicar' }))

      const staleMessage = await screen.findByText('Ese valor ya no está disponible en este pago. Actualizando…')
      expect(staleMessage).toBeInTheDocument()

      // remainingAmount stays > 0 after the refetch, so the section stays
      // open (isOpen is untouched by onStaleAllocationState) - closing it
      // manually and reopening is the actual "fresh attempt" boundary.
      await user.click(screen.getByRole('button', { name: 'Cancelar' }))
      await user.click(await screen.findByRole('button', { name: 'Aplicar a cargos' }))

      expect(screen.queryByText('Ese valor ya no está disponible en este pago. Actualizando…')).not.toBeInTheDocument()
    })

    it('clears a previous stale-allocation error once a second, distinct attempt succeeds without closing the section', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      // 1) initial load, 2) refetch triggered by the first (failed) attempt's
      // stale-state handling, 3) refetch triggered by the second (succeeded)
      // attempt's own invalidation.
      listAllocationsForPayment.mockResolvedValueOnce([])
      listAllocationsForPayment.mockResolvedValueOnce([])
      listAllocationsForPayment.mockResolvedValueOnce([makeAllocation({ chargeId: 'charge-b', amount: 50_000 })])
      listChargesByRelationship.mockResolvedValueOnce([
        makeCharge({ id: 'charge-a', description: 'Cargo A', balance: 300_000 }),
        makeCharge({ id: 'charge-b', description: 'Cargo B', balance: 200_000 }),
      ])
      listChargesByRelationship.mockResolvedValueOnce([
        makeCharge({ id: 'charge-a', description: 'Cargo A', balance: 300_000 }),
        makeCharge({ id: 'charge-b', description: 'Cargo B', balance: 200_000 }),
      ])
      listChargesByRelationship.mockResolvedValueOnce([
        makeCharge({ id: 'charge-a', description: 'Cargo A', balance: 300_000 }),
        makeCharge({
          id: 'charge-b',
          description: 'Cargo B',
          balance: 150_000,
          paidAmount: 50_000,
          financialStatus: 'PARTIAL',
        }),
      ])
      allocatePayment.mockRejectedValueOnce(new PaymentRepositoryError('allocation_exceeds_payment'))
      allocatePayment.mockResolvedValueOnce(makeAllocation({ chargeId: 'charge-b', amount: 50_000 }))
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Aplicar a cargos' }))
      await user.selectOptions(await screen.findByLabelText('Cargo'), 'charge-a')
      await user.type(await screen.findByLabelText('Valor a aplicar'), '100000')
      await user.click(screen.getByRole('button', { name: 'Aplicar' }))

      expect(await screen.findByText('Ese valor ya no está disponible en este pago. Actualizando…')).toBeInTheDocument()

      // Without closing the section, submit a second, distinct attempt (a
      // different charge) that succeeds this time.
      await user.selectOptions(await screen.findByLabelText('Cargo'), 'charge-b')
      await user.type(await screen.findByLabelText('Valor a aplicar'), '50000')
      await user.click(screen.getByRole('button', { name: 'Aplicar' }))

      await waitFor(() => {
        expect(allocatePayment).toHaveBeenCalledWith({ paymentId: 'payment-1', chargeId: 'charge-b', amount: 50000 })
      })
      await waitFor(() => {
        expect(
          screen.queryByText('Ese valor ya no está disponible en este pago. Actualizando…'),
        ).not.toBeInTheDocument()
      })
      expect(await screen.findByText('Aplicado: $50.000')).toBeInTheDocument()
    })

    it('never renders an allocation edit/delete/reversal control', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([
        makePayment({ id: 'payment-a', status: 'CONFIRMED', amount: 500_000 }),
        makePayment({ id: 'payment-b', status: 'REPORTED' }),
      ])
      listAllocationsForPayment.mockResolvedValueOnce([makeAllocation({ paymentId: 'payment-a', amount: 200_000 })])
      renderPage()

      await screen.findByText('Aplicado: $200.000')
      expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /revertir/i })).not.toBeInTheDocument()
    })
  })

  describe('receipt issuance', () => {
    for (const status of ['REPORTED', 'REJECTED', 'CANCELLED'] as const) {
      it(`shows no receipt UI at all for a ${status} payment`, async () => {
        resolveOneAdministration()
        listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
        listByRelationship.mockResolvedValueOnce([makePayment({ status })])
        renderPage()

        await screen.findByText('Pagos')
        expect(screen.queryByRole('button', { name: 'Emitir recibo' })).not.toBeInTheDocument()
        expect(screen.queryByText(/^Recibo No\./)).not.toBeInTheDocument()
        expect(getReceiptForPayment).not.toHaveBeenCalled()
      })
    }

    it('shows no issue action for a CONFIRMED payment with zero allocations', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValueOnce([])
      renderPage()

      await screen.findByText('Aplicado: $0')
      expect(screen.queryByRole('button', { name: 'Emitir recibo' })).not.toBeInTheDocument()
      expect(screen.getByText('Aplica este pago a un cargo antes de emitir un recibo.')).toBeInTheDocument()
    })

    it('shows the issue action for a CONFIRMED payment with exactly one partial allocation (remaining > 0) - full allocation is not required', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValueOnce([makeAllocation({ amount: 100_000 })])
      renderPage()

      expect(await screen.findByText('Pendiente por aplicar: $400.000')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Emitir recibo' })).toBeEnabled()
    })

    it('renders the read-only issued number/date for an already-issued receipt, and never a trigger button', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValueOnce([makeAllocation({ amount: 500_000 })])
      getReceiptForPayment.mockResolvedValueOnce(makeReceipt({ receiptNumber: 42 }))
      renderPage()

      expect(await screen.findByText('Recibo No. 42')).toBeInTheDocument()
      expect(screen.getByText((content) => content.startsWith('Emitido el'))).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Emitir recibo' })).not.toBeInTheDocument()
    })

    it('keeps an already-issued receipt visible even when the management gate is blocked', async () => {
      resolveOneAdministration()
      getSubscription.mockResolvedValueOnce({ ...UNLIMITED_SUBSCRIPTION, status: 'EXPIRED' })
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValueOnce([makeAllocation({ amount: 500_000 })])
      getReceiptForPayment.mockResolvedValueOnce(makeReceipt({ receiptNumber: 7 }))
      renderPage()

      expect(await screen.findByText('Recibo No. 7')).toBeInTheDocument()
    })

    it('disables the issue action and shows the management-access reason when the gate denies', async () => {
      resolveOneAdministration()
      getSubscription.mockResolvedValueOnce({ ...UNLIMITED_SUBSCRIPTION, status: 'EXPIRED' })
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValueOnce([makeAllocation({ amount: 100_000 })])
      renderPage()

      const trigger = await screen.findByRole('button', { name: 'Emitir recibo' })
      expect(trigger).toBeDisabled()
      expect(
        await screen.findAllByText('Tu acceso de administración venció. Elige un plan para seguir gestionando tu cuenta.'),
      ).not.toHaveLength(0)
      expect(issueReceipt).not.toHaveBeenCalled()
    })

    it('disables the issue action live once the management gate flips to blocked while mounted', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValueOnce([makeAllocation({ amount: 100_000 })])
      const { client } = renderPage()

      const trigger = await screen.findByRole('button', { name: 'Emitir recibo' })
      expect(trigger).toBeEnabled()

      // Same technique as the allocation section's own live-gate test -
      // simulates the subscription expiring mid-session via a direct cache
      // write rather than a real refetch/timer.
      client.setQueryData(administrationQueryKeys.subscription('admin-1'), {
        ...UNLIMITED_SUBSCRIPTION,
        status: 'EXPIRED',
      })

      await waitFor(() => {
        expect(trigger).toBeDisabled()
      })
      expect(issueReceipt).not.toHaveBeenCalled()
    })

    it('disables the issue button while the mutation is pending', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValueOnce([makeAllocation({ amount: 100_000 })])
      let resolveIssue: (value: Receipt) => void = () => {}
      issueReceipt.mockImplementationOnce(
        () =>
          new Promise<Receipt>((resolve) => {
            resolveIssue = resolve
          }),
      )
      const user = userEvent.setup()
      renderPage()

      const trigger = await screen.findByRole('button', { name: 'Emitir recibo' })
      await user.click(trigger)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Emitiendo…' })).toBeDisabled()
      })
      expect(issueReceipt).toHaveBeenCalledTimes(1)

      resolveIssue(makeReceipt())
      await waitFor(() => {
        expect(issueReceipt).toHaveBeenCalledTimes(1)
      })
    })

    it('issues a receipt successfully, refetching the receipt query and rendering the read-only state - without ever invalidating the charges query', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValue([makeAllocation({ amount: 100_000 })])
      getReceiptForPayment.mockResolvedValueOnce(null)
      getReceiptForPayment.mockResolvedValueOnce(makeReceipt({ receiptNumber: 99 }))
      issueReceipt.mockResolvedValueOnce(makeReceipt({ receiptNumber: 99 }))
      const user = userEvent.setup()
      renderPage()

      const trigger = await screen.findByRole('button', { name: 'Emitir recibo' })
      const chargesCallsBeforeIssuance = listChargesByRelationship.mock.calls.length
      await user.click(trigger)

      await waitFor(() => {
        expect(issueReceipt).toHaveBeenCalledWith('payment-1')
      })
      await waitFor(() => {
        expect(getReceiptForPayment).toHaveBeenCalledTimes(2)
      })
      expect(await screen.findByText('Recibo No. 99')).toBeInTheDocument()
      // issue_receipt's only write is a single INSERT INTO receipts - it
      // never touches charges/charge_balances, so a successful issuance must
      // never trigger a charges-query call beyond whatever already ran
      // before this click (in this test, none, since the allocation section
      // was never opened).
      expect(listChargesByRelationship.mock.calls.length).toBe(chargesCallsBeforeIssuance)
    })

    it('shows a friendly stale-state message and refetches the receipt on a receipt_already_issued (23505) failure, keeping the message visible alongside the now-real receipt instead of one silently replacing the other', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValue([makeAllocation({ amount: 100_000 })])
      // No receipt yet when this client renders its own "Emitir recibo" -
      // but another session/tab already issued one by the time this client's
      // own attempt reaches the server, so the refetch triggered by the
      // stale failure reveals the real, already-existing receipt.
      getReceiptForPayment.mockResolvedValueOnce(null)
      getReceiptForPayment.mockResolvedValueOnce(makeReceipt({ receiptNumber: 55 }))
      issueReceipt.mockRejectedValueOnce(new PaymentRepositoryError('receipt_already_issued'))
      const user = userEvent.setup()
      renderPage()

      const trigger = await screen.findByRole('button', { name: 'Emitir recibo' })
      await user.click(trigger)

      expect(await screen.findByText('Ya existe un recibo para este pago. Actualizando…')).toBeInTheDocument()
      expect(await screen.findByText('Recibo No. 55')).toBeInTheDocument()
      // Both remain visible simultaneously - the failure message is not
      // silently replaced by the refetch's own correct success state.
      expect(screen.getByText('Ya existe un recibo para este pago. Actualizando…')).toBeInTheDocument()
      expect(screen.getByText('Recibo No. 55')).toBeInTheDocument()
    })

    it('never renders a download/file/PDF affordance for a receipt', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValueOnce([makeAllocation({ amount: 500_000 })])
      getReceiptForPayment.mockResolvedValueOnce(makeReceipt())
      renderPage()

      await screen.findByText('Recibo No. 42')
      expect(screen.queryByRole('button', { name: /descargar/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /descargar|pdf/i })).not.toBeInTheDocument()
      expect(screen.queryByText(/pdf/i)).not.toBeInTheDocument()
    })

    it('never renders a receipt edit/void/reissue control for any receipt state', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', amount: 500_000 })])
      listAllocationsForPayment.mockResolvedValueOnce([makeAllocation({ amount: 500_000 })])
      getReceiptForPayment.mockResolvedValueOnce(makeReceipt())
      renderPage()

      await screen.findByText('Recibo No. 42')
      expect(screen.queryByRole('button', { name: /anular|editar|reemitir|eliminar/i })).not.toBeInTheDocument()
    })
  })

  describe('lifecycle actions', () => {
    it('shows Confirm and Reject only for REPORTED, never for CONFIRMED/REJECTED/CANCELLED', async () => {
      for (const status of ['CONFIRMED', 'REJECTED', 'CANCELLED'] as const) {
        resolveOneAdministration()
        listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
        listByRelationship.mockResolvedValueOnce([makePayment({ status })])
        const { unmount } = renderPage()

        await screen.findByText('Pagos')
        expect(screen.queryByRole('button', { name: 'Confirmar pago' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Rechazar pago' })).not.toBeInTheDocument()
        unmount()
        vi.clearAllMocks()
        getSubscription.mockResolvedValue(UNLIMITED_SUBSCRIPTION)
        getFileById.mockResolvedValue(null)
      }
    })

    it('renders a defensively-rendered CANCELLED payment without crashing and with no lifecycle actions', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CANCELLED' })])
      renderPage()

      expect(await screen.findByText('Cancelado')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Confirmar pago' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Rechazar pago' })).not.toBeInTheDocument()
    })

    it('disables Confirm and Reject and shows the management-access reason when the gate denies', async () => {
      resolveOneAdministration()
      getSubscription.mockResolvedValueOnce({ ...UNLIMITED_SUBSCRIPTION, status: 'EXPIRED' })
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment()])
      renderPage()

      const confirmButton = await screen.findByRole('button', { name: 'Confirmar pago' })
      const rejectButton = screen.getByRole('button', { name: 'Rechazar pago' })
      expect(confirmButton).toBeDisabled()
      expect(rejectButton).toBeDisabled()
      expect(
        await screen.findAllByText('Tu acceso de administración venció. Elige un plan para seguir gestionando tu cuenta.'),
      ).not.toHaveLength(0)
    })

    it('calls confirmPayment exactly once when Confirm is clicked', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment()])
      confirmPayment.mockResolvedValueOnce(makePayment({ status: 'CONFIRMED' }))
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Confirmar pago' }))

      await waitFor(() => {
        expect(confirmPayment).toHaveBeenCalledTimes(1)
      })
      expect(confirmPayment).toHaveBeenCalledWith('payment-1')
    })

    it('does not call rejectPayment on the first "Rechazar pago" click - it only enters confirmation state', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment()])
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Rechazar pago' }))

      expect(rejectPayment).not.toHaveBeenCalled()
      expect(await screen.findByRole('button', { name: 'Confirmar rechazo' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Rechazar pago' })).not.toBeInTheDocument()
    })

    it('calls rejectPayment exactly once when the confirmation action is clicked', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment()])
      rejectPayment.mockResolvedValueOnce(makePayment({ status: 'REJECTED' }))
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Rechazar pago' }))
      await user.click(await screen.findByRole('button', { name: 'Confirmar rechazo' }))

      await waitFor(() => {
        expect(rejectPayment).toHaveBeenCalledTimes(1)
      })
      expect(rejectPayment).toHaveBeenCalledWith('payment-1')
    })

    it('"Volver" leaves confirmation state without calling rejectPayment', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment()])
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Rechazar pago' }))
      await user.click(await screen.findByRole('button', { name: 'Volver' }))

      expect(rejectPayment).not.toHaveBeenCalled()
      expect(await screen.findByRole('button', { name: 'Rechazar pago' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Confirmar rechazo' })).not.toBeInTheDocument()
    })

    it('disables the confirm-reject button while pending, preventing a duplicate submission', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment()])
      let resolveReject: (value: Payment) => void = () => {}
      rejectPayment.mockImplementationOnce(
        () =>
          new Promise<Payment>((resolve) => {
            resolveReject = resolve
          }),
      )
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Rechazar pago' }))
      const confirmButton = await screen.findByRole('button', { name: 'Confirmar rechazo' })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(confirmButton).toBeDisabled()
      })
      await user.click(confirmButton)
      expect(rejectPayment).toHaveBeenCalledTimes(1)

      resolveReject(makePayment({ status: 'REJECTED' }))
      await waitFor(() => {
        expect(rejectPayment).toHaveBeenCalledTimes(1)
      })
    })

    it('disables Reject for the same card while Confirm is pending, and vice versa', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment()])
      let resolveConfirm: (value: Payment) => void = () => {}
      confirmPayment.mockImplementationOnce(
        () =>
          new Promise<Payment>((resolve) => {
            resolveConfirm = resolve
          }),
      )
      const user = userEvent.setup()
      renderPage()

      const confirmButton = await screen.findByRole('button', { name: 'Confirmar pago' })
      const rejectButton = screen.getByRole('button', { name: 'Rechazar pago' })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(confirmButton).toBeDisabled()
      })
      expect(rejectButton).toBeDisabled()

      resolveConfirm(makePayment({ status: 'CONFIRMED' }))
      await waitFor(() => {
        expect(confirmPayment).toHaveBeenCalledTimes(1)
      })
    })

    it('reflects a successful confirm in the list (invalidation refetches and the badge updates)', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment()])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', confirmedAt: '2026-01-06T00:00:00Z' })])
      confirmPayment.mockResolvedValueOnce(makePayment({ status: 'CONFIRMED' }))
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Confirmar pago' }))

      await waitFor(() => {
        expect(listByRelationship).toHaveBeenCalledTimes(2)
      })
      expect(await screen.findByText('Confirmado')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Confirmar pago' })).not.toBeInTheDocument()
    })

    it('reflects a successful reject in the list (invalidation refetches and the badge updates)', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment()])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'REJECTED', rejectedAt: '2026-01-06T00:00:00Z' })])
      rejectPayment.mockResolvedValueOnce(makePayment({ status: 'REJECTED' }))
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Rechazar pago' }))
      await user.click(await screen.findByRole('button', { name: 'Confirmar rechazo' }))

      await waitFor(() => {
        expect(listByRelationship).toHaveBeenCalledTimes(2)
      })
      expect(await screen.findByText('Rechazado')).toBeInTheDocument()
    })

    it('reflects a successful report in the list', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([])
      listByRelationship.mockResolvedValueOnce([makePayment()])
      reportPayment.mockResolvedValueOnce(makePayment())
      const user = userEvent.setup()
      renderPage()

      await screen.findByText('Todavía no hay pagos reportados para este arriendo')
      await user.type(screen.getByLabelText('Valor pagado'), '500000')
      await user.type(screen.getByLabelText('Fecha de pago'), '2026-01-05')
      await user.click(screen.getByRole('button', { name: 'Reportar pago' }))

      await waitFor(() => {
        expect(listByRelationship).toHaveBeenCalledTimes(2)
      })
      expect(await screen.findByText('Reportado')).toBeInTheDocument()
    })
  })

  describe('card layout (DS-003)', () => {
    it('renders every data point across the header/details/application/receipt zones for a CONFIRMED payment with a receipt', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([
        makePayment({
          status: 'CONFIRMED',
          amount: 500_000,
          paymentMethod: 'BANK_TRANSFER',
          externalReference: 'REF-0001-ABC-LONG-EXTERNAL-REFERENCE-VALUE',
          notes: 'Pago parcial de enero, el resto se reporta la próxima semana.',
          proofFileId: 'file-1',
        }),
      ])
      listAllocationsForPayment.mockResolvedValueOnce([makeAllocation({ amount: 100_000 })])
      getReceiptForPayment.mockResolvedValueOnce(makeReceipt())
      renderPage()

      expect(await screen.findByText('Confirmado')).toBeInTheDocument()
      expect(screen.getByText('Valor: $500.000')).toBeInTheDocument()
      expect(screen.getByText(/^Fecha de pago:/)).toBeInTheDocument()
      expect(screen.getByText('Método de pago: Transferencia bancaria')).toBeInTheDocument()
      expect(screen.getByText('Referencia: REF-0001-ABC-LONG-EXTERNAL-REFERENCE-VALUE')).toBeInTheDocument()
      expect(
        screen.getByText('Notas: Pago parcial de enero, el resto se reporta la próxima semana.'),
      ).toBeInTheDocument()
      expect(screen.getByText(/^Reportado el/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Descargar comprobante' })).toBeInTheDocument()
      expect(await screen.findByText('Aplicado: $100.000')).toBeInTheDocument()
      expect(screen.getByText('Pendiente por aplicar: $400.000')).toBeInTheDocument()
      expect(await screen.findByText('Recibo No. 42')).toBeInTheDocument()
      expect(screen.getByText(/^Emitido el/)).toBeInTheDocument()
    })

    it('renders a large 7-digit amount in the header without truncating or hiding it', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ amount: 12_500_000 })])
      renderPage()

      expect(await screen.findByText('Valor: $12.500.000')).toBeInTheDocument()
    })

    it('renders a REPORTED payment with every optional field absent (no method/reference/notes/proof) cleanly', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment()])
      renderPage()

      expect(await screen.findByText('Reportado')).toBeInTheDocument()
      expect(screen.getByText('Valor: $500.000')).toBeInTheDocument()
      expect(screen.getByText(/^Fecha de pago:/)).toBeInTheDocument()
      expect(screen.getByText(/^Reportado el/)).toBeInTheDocument()
      expect(screen.queryByText(/^Método de pago:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/^Referencia:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/^Notas:/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Descargar comprobante' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Confirmar pago' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Rechazar pago' })).toBeInTheDocument()
    })
  })
})

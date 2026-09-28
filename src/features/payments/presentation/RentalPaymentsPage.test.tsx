import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import type { Payment } from '../domain/payment.types'
import RentalPaymentsPage from './RentalPaymentsPage'

const { listAccessibleAdministrations } = vi.hoisted(() => ({
  listAccessibleAdministrations: vi.fn(),
}))
const { getSubscription } = vi.hoisted(() => ({ getSubscription: vi.fn() }))
const { listByAdministration } = vi.hoisted(() => ({ listByAdministration: vi.fn() }))
const { listByRelationship, reportPayment, confirmPayment, rejectPayment } = vi.hoisted(() => ({
  listByRelationship: vi.fn(),
  reportPayment: vi.fn(),
  confirmPayment: vi.fn(),
  rejectPayment: vi.fn(),
}))
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

vi.mock('../infrastructure/supabase-payment.repository', () => ({
  supabasePaymentRepository: {
    listByRelationship,
    reportPayment,
    confirmPayment,
    rejectPayment,
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

function renderPage(entry = '/rentals/rel-1/payments') {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/rentals/:id/payments" element={<RentalPaymentsPage />} />
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

describe('RentalPaymentsPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    getSubscription.mockResolvedValue(UNLIMITED_SUBSCRIPTION)
    getFileById.mockResolvedValue(null)
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

  describe('confirmed disclaimer', () => {
    it('shows the not-yet-applied disclaimer for a CONFIRMED payment', async () => {
      resolveOneAdministration()
      listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
      listByRelationship.mockResolvedValueOnce([makePayment({ status: 'CONFIRMED', confirmedAt: '2026-01-06T00:00:00Z' })])
      renderPage()

      expect(
        await screen.findByText('Este pago fue confirmado, pero todavía no se ha aplicado a un cargo específico.'),
      ).toBeInTheDocument()
    })

    for (const status of ['REPORTED', 'REJECTED', 'CANCELLED'] as const) {
      it(`does not show the confirmed-not-applied disclaimer for a ${status} payment`, async () => {
        resolveOneAdministration()
        listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
        listByRelationship.mockResolvedValueOnce([makePayment({ status })])
        renderPage()

        await screen.findByText('Pagos')
        expect(
          screen.queryByText('Este pago fue confirmado, pero todavía no se ha aplicado a un cargo específico.'),
        ).not.toBeInTheDocument()
      })
    }
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
})

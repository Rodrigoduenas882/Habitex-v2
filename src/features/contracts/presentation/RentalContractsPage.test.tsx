import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import type { Contract } from '../domain/contract.types'
import RentalContractsPage from './RentalContractsPage'

const { listAccessibleAdministrations } = vi.hoisted(() => ({
  listAccessibleAdministrations: vi.fn(),
}))
const { getSubscription } = vi.hoisted(() => ({ getSubscription: vi.fn() }))
const { listByAdministration } = vi.hoisted(() => ({ listByAdministration: vi.fn() }))
const { getCurrent } = vi.hoisted(() => ({ getCurrent: vi.fn() }))
const {
  listByRelationship,
  registerHabitexGenerated,
  registerExternalSigned,
  attachSignedCopy,
  markShared,
  terminate,
} = vi.hoisted(() => ({
  listByRelationship: vi.fn(),
  registerHabitexGenerated: vi.fn(),
  registerExternalSigned: vi.fn(),
  attachSignedCopy: vi.fn(),
  markShared: vi.fn(),
  terminate: vi.fn(),
}))
const { uploadFile, getFileById } = vi.hoisted(() => ({
  uploadFile: vi.fn(),
  getFileById: vi.fn(),
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

vi.mock('@/features/rentals/infrastructure/supabase-rental-terms.repository', () => ({
  supabaseRentalTermsRepository: { create: vi.fn(), getCurrent, listRelationshipIdsWithTerms: vi.fn() },
}))

vi.mock('../infrastructure/supabase-contract.repository', () => ({
  supabaseContractRepository: {
    listByRelationship,
    registerHabitexGenerated,
    registerExternalSigned,
    attachSignedCopy,
    markShared,
    terminate,
  },
}))

vi.mock('@/features/documents/infrastructure/supabase-file.repository', () => ({
  supabaseFileRepository: {
    getById: getFileById,
    upload: uploadFile,
    download: vi.fn().mockResolvedValue(new Blob(['bytes'])),
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

const RELATIONSHIP_ENDED = { ...RELATIONSHIP_ACTIVE, status: 'ENDED' as const }

const TERM_VERSION = {
  id: 'term-1',
  rentalRelationshipId: 'rel-1',
  versionNumber: 1,
  effectiveFrom: '2026-01-01',
  effectiveUntil: null,
  rentAmount: 1_000_000,
  administrationMode: 'NONE' as const,
  utilitiesMode: null,
  createdAt: '2026-01-01T00:00:00Z',
}

const TERMS_SNAPSHOT = {
  rentAmount: 1_000_000,
  administrationMode: 'NONE' as const,
  utilitiesMode: null,
  effectiveFrom: '2026-01-01',
  realStartDate: '2026-01-01',
  trackingStartDate: '2026-01-01',
  paymentDay: 5,
  paymentTiming: 'ADVANCE' as const,
  expectedEndDate: null,
}

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return { ...CONTRACT_BASE, ...overrides }
}

const CONTRACT_BASE: Contract = {
  id: 'contract-1',
  administrationId: 'admin-1',
  rentalRelationshipId: 'rel-1',
  origin: 'HABITEX',
  status: 'GENERATED',
  versionNumber: 1,
  documentFileId: 'file-1',
  signedFileId: null as string | null,
  termsSnapshot: TERMS_SNAPSHOT,
  documentHash: 'a'.repeat(64),
  generatedAt: '2026-01-01T00:00:00Z',
  sharedAt: null as string | null,
  signedAt: null as string | null,
  terminatedAt: null as string | null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
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

function renderPage(entry = '/rentals/rel-1/contracts') {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/rentals/:id/contracts" element={<RentalContractsPage />} />
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

describe('RentalContractsPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    getSubscription.mockResolvedValue(UNLIMITED_SUBSCRIPTION)
    getCurrent.mockResolvedValue(TERM_VERSION)
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

  it('shows the empty-list message when the relationship has no contracts yet', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
    listByRelationship.mockResolvedValueOnce([])
    renderPage()

    expect(await screen.findByText('Todavía no hay contratos registrados para este arriendo.')).toBeInTheDocument()
  })

  it('shows the creation section for an ACTIVE relationship', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
    listByRelationship.mockResolvedValueOnce([])
    renderPage()

    expect(await screen.findByText('Registrar contrato Habitex')).toBeInTheDocument()
    expect(screen.getByText('Registrar contrato externo firmado')).toBeInTheDocument()
  })

  it('hides the creation section for an ENDED relationship (read-only historical access only)', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ENDED])
    listByRelationship.mockResolvedValueOnce([makeContract({ status: 'TERMINATED', terminatedAt: '2026-06-01T00:00:00Z' })])
    renderPage()

    await screen.findByText('Contratos')
    expect(screen.queryByText('Registrar contrato Habitex')).not.toBeInTheDocument()
    expect(screen.queryByText('Registrar contrato externo firmado')).not.toBeInTheDocument()
  })

  it('GENERATED shows exactly its two actions (mark shared, attach signed copy)', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
    listByRelationship.mockResolvedValueOnce([makeContract({ status: 'GENERATED' })])
    renderPage()

    expect(await screen.findByRole('button', { name: 'Marcar como compartido' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adjuntar copia firmada' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Terminar contrato' })).not.toBeInTheDocument()
  })

  it('SHARED shows exactly its one action (attach signed copy)', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
    listByRelationship.mockResolvedValueOnce([
      makeContract({ status: 'SHARED', sharedAt: '2026-02-01T00:00:00Z' }),
    ])
    renderPage()

    expect(await screen.findByRole('button', { name: 'Adjuntar copia firmada' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marcar como compartido' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Terminar contrato' })).not.toBeInTheDocument()
  })

  it('SIGNED shows exactly its one action (terminate)', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
    listByRelationship.mockResolvedValueOnce([
      makeContract({ status: 'SIGNED', signedFileId: 'file-2', signedAt: '2026-03-01T00:00:00Z' }),
    ])
    renderPage()

    expect(await screen.findByRole('button', { name: 'Terminar contrato' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marcar como compartido' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Adjuntar copia firmada' })).not.toBeInTheDocument()
  })

  it('does not call terminate on the first "Terminar contrato" click - it only enters confirmation state', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
    listByRelationship.mockResolvedValueOnce([
      makeContract({ status: 'SIGNED', signedFileId: 'file-2', signedAt: '2026-03-01T00:00:00Z' }),
    ])
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Terminar contrato' }))

    expect(terminate).not.toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Confirmar terminación' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument()
    // The original trigger is replaced, not merely relabeled.
    expect(screen.queryByRole('button', { name: 'Terminar contrato' })).not.toBeInTheDocument()
  })

  it('calls terminate exactly once when the confirmation action is clicked', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
    listByRelationship.mockResolvedValueOnce([
      makeContract({ status: 'SIGNED', signedFileId: 'file-2', signedAt: '2026-03-01T00:00:00Z' }),
    ])
    terminate.mockResolvedValueOnce(
      makeContract({ status: 'TERMINATED', signedFileId: 'file-2', terminatedAt: '2026-05-01T00:00:00Z' }),
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Terminar contrato' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar terminación' }))

    await waitFor(() => {
      expect(terminate).toHaveBeenCalledTimes(1)
    })
    expect(terminate).toHaveBeenCalledWith('contract-1')
  })

  it('"Volver" leaves confirmation state without calling terminate', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
    listByRelationship.mockResolvedValueOnce([
      makeContract({ status: 'SIGNED', signedFileId: 'file-2', signedAt: '2026-03-01T00:00:00Z' }),
    ])
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Terminar contrato' }))
    await user.click(await screen.findByRole('button', { name: 'Volver' }))

    expect(terminate).not.toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Terminar contrato' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar terminación' })).not.toBeInTheDocument()
  })

  it('disables the confirm button while termination is pending, preventing a duplicate submission', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
    listByRelationship.mockResolvedValueOnce([
      makeContract({ status: 'SIGNED', signedFileId: 'file-2', signedAt: '2026-03-01T00:00:00Z' }),
    ])
    let resolveTerminate: (value: Contract) => void = () => {}
    terminate.mockImplementationOnce(
      () =>
        new Promise<Contract>((resolve) => {
          resolveTerminate = resolve
        }),
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Terminar contrato' }))
    const confirmButton = await screen.findByRole('button', { name: 'Confirmar terminación' })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(confirmButton).toBeDisabled()
    })
    // A second click while pending must not queue a second call.
    await user.click(confirmButton)
    expect(terminate).toHaveBeenCalledTimes(1)

    resolveTerminate(makeContract({ status: 'TERMINATED', signedFileId: 'file-2' }))
    await waitFor(() => {
      expect(terminate).toHaveBeenCalledTimes(1)
    })
  })

  it('shows the terminate error and stays confirmable (not falsely TERMINATED) when the mutation fails', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
    listByRelationship.mockResolvedValueOnce([
      makeContract({ status: 'SIGNED', signedFileId: 'file-2', signedAt: '2026-03-01T00:00:00Z' }),
    ])
    const { ContractRepositoryError } = await import('../domain/contract.types')
    terminate.mockRejectedValueOnce(new ContractRepositoryError('not_found'))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Terminar contrato' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar terminación' }))

    expect(
      await screen.findByText('No encontramos el elemento referenciado. Actualiza la página e intenta de nuevo.'),
    ).toBeInTheDocument()
    // Still shows the SIGNED badge, not TERMINATED - the failed mutation
    // never optimistically flipped the displayed status.
    expect(screen.getByText('Firmado')).toBeInTheDocument()
    expect(screen.queryByText('Terminado')).not.toBeInTheDocument()
    // Still confirmable (stays in confirming state), not reset to the
    // original trigger.
    expect(screen.getByRole('button', { name: 'Confirmar terminación' })).toBeInTheDocument()
  })

  it('TERMINATED shows no actions', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
    listByRelationship.mockResolvedValueOnce([
      makeContract({ status: 'TERMINATED', signedFileId: 'file-2', terminatedAt: '2026-04-01T00:00:00Z' }),
    ])
    renderPage()

    await screen.findByText('Terminado')
    expect(screen.queryByRole('button', { name: 'Marcar como compartido' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Adjuntar copia firmada' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Terminar contrato' })).not.toBeInTheDocument()
  })

  it('disables the mark-shared/terminate actions and shows the shared management-access reason when blocked', async () => {
    resolveOneAdministration()
    getSubscription.mockResolvedValueOnce({ ...UNLIMITED_SUBSCRIPTION, status: 'EXPIRED' })
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
    listByRelationship.mockResolvedValueOnce([makeContract({ status: 'GENERATED' })])
    renderPage()

    const markSharedButton = await screen.findByRole('button', { name: 'Marcar como compartido' })
    expect(markSharedButton).toBeDisabled()
    expect(
      await screen.findAllByText('Tu acceso de administración venció. Elige un plan para seguir gestionando tu cuenta.'),
    ).not.toHaveLength(0)
  })

  it('does not hide the read-only contract list when management access is expired', async () => {
    resolveOneAdministration()
    getSubscription.mockResolvedValueOnce({ ...UNLIMITED_SUBSCRIPTION, status: 'EXPIRED' })
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
    listByRelationship.mockResolvedValueOnce([makeContract({ status: 'SIGNED', signedFileId: 'file-2' })])
    getFileById.mockResolvedValue({
      id: 'file-1',
      administrationId: 'admin-1',
      rentalRelationshipId: 'rel-1',
      purpose: 'CONTRACT_GENERATED',
      storageBucket: 'documents',
      storagePath: 'admin-1/doc.pdf',
      originalName: 'contrato.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
      sha256: null,
      uploadedByPersonId: null,
      createdAt: '2026-01-01T00:00:00Z',
    })
    renderPage()

    expect(await screen.findByText('Firmado')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Descargar documento' })).toBeInTheDocument()
  })

  it('calls markShared when clicking "Marcar como compartido"', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
    listByRelationship.mockResolvedValueOnce([makeContract({ status: 'GENERATED' })])
    markShared.mockResolvedValueOnce(makeContract({ status: 'SHARED', sharedAt: '2026-02-01T00:00:00Z' }))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Marcar como compartido' }))

    await waitFor(() => {
      expect(markShared).toHaveBeenCalledWith('contract-1')
    })
  })

  it('shows the specific version_conflict copy (stale client state) rather than the generic fallback', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
    listByRelationship.mockResolvedValueOnce([])
    uploadFile.mockResolvedValueOnce({
      id: 'file-9',
      administrationId: 'admin-1',
      rentalRelationshipId: 'rel-1',
      purpose: 'CONTRACT_GENERATED',
      storageBucket: 'documents',
      storagePath: 'admin-1/doc.pdf',
      originalName: 'contrato.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4,
      sha256: null,
      uploadedByPersonId: null,
      createdAt: '2026-01-01T00:00:00Z',
    })
    const { ContractRepositoryError } = await import('../domain/contract.types')
    registerHabitexGenerated.mockRejectedValueOnce(new ContractRepositoryError('version_conflict'))
    const user = userEvent.setup()
    renderPage()

    const fileInput = await screen.findByLabelText('Documento del contrato')
    const file = new File(['contenido'], 'contrato.pdf', { type: 'application/pdf' })
    await user.upload(fileInput, file)
    await user.click(screen.getByRole('button', { name: 'Registrar contrato' }))

    expect(
      await screen.findByText('Otra versión de este contrato ya fue registrada. Actualiza la página e intenta de nuevo.'),
    ).toBeInTheDocument()
  })

  it('shows the specific not_signable copy for a stale attach-signed-copy attempt', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
    listByRelationship.mockResolvedValueOnce([makeContract({ status: 'GENERATED' })])
    uploadFile.mockResolvedValueOnce({
      id: 'file-9',
      administrationId: 'admin-1',
      rentalRelationshipId: 'rel-1',
      purpose: 'CONTRACT_SIGNED',
      storageBucket: 'documents',
      storagePath: 'admin-1/signed.pdf',
      originalName: 'firmado.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4,
      sha256: null,
      uploadedByPersonId: null,
      createdAt: '2026-01-01T00:00:00Z',
    })
    const { ContractRepositoryError } = await import('../domain/contract.types')
    attachSignedCopy.mockRejectedValueOnce(new ContractRepositoryError('not_signable'))
    const user = userEvent.setup()
    renderPage()

    const fileInput = await screen.findByLabelText('Archivo de la copia firmada')
    const file = new File(['firmado'], 'firmado.pdf', { type: 'application/pdf' })
    await user.upload(fileInput, file)
    await user.click(screen.getByRole('button', { name: 'Adjuntar copia firmada' }))

    expect(
      await screen.findByText(
        'Este contrato ya no admite adjuntar una copia firmada. Actualiza la página para ver su estado actual.',
      ),
    ).toBeInTheDocument()
  })

  it('disables the Habitex-generated submit button while the mutation is pending, and never re-uploads on a retry', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
    listByRelationship.mockResolvedValueOnce([])
    const uploadedFile = {
      id: 'file-9',
      administrationId: 'admin-1',
      rentalRelationshipId: 'rel-1',
      purpose: 'CONTRACT_GENERATED' as const,
      storageBucket: 'documents' as const,
      storagePath: 'admin-1/doc.pdf',
      originalName: 'contrato.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4,
      sha256: null,
      uploadedByPersonId: null,
      createdAt: '2026-01-01T00:00:00Z',
    }
    uploadFile.mockResolvedValueOnce(uploadedFile)
    registerHabitexGenerated.mockRejectedValueOnce(new Error('boom'))
    registerHabitexGenerated.mockResolvedValueOnce(makeContract({ status: 'GENERATED' }))
    const user = userEvent.setup()
    renderPage()

    const fileInput = await screen.findByLabelText('Documento del contrato')
    const file = new File(['contenido'], 'contrato.pdf', { type: 'application/pdf' })
    await user.upload(fileInput, file)

    const submitButton = screen.getByRole('button', { name: 'Registrar contrato' })
    await user.click(submitButton)

    // While the mutation is in flight, or right after a failure, the submit
    // button must never allow a double-submit.
    await waitFor(() => {
      expect(uploadFile).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(registerHabitexGenerated).toHaveBeenCalledTimes(1)
    })

    // Retry after the first failure - must reuse the already-uploaded file
    // id, never calling uploadFile a second time.
    await user.click(screen.getByRole('button', { name: 'Registrar contrato' }))

    await waitFor(() => {
      expect(registerHabitexGenerated).toHaveBeenCalledTimes(2)
    })
    expect(uploadFile).toHaveBeenCalledTimes(1)
    expect(registerHabitexGenerated).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ documentFileId: 'file-9' }),
    )
  })

  it('never renders any delete action for a contract', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
    listByRelationship.mockResolvedValueOnce([
      makeContract({ status: 'SIGNED', signedFileId: 'file-2' }),
      makeContract({ id: 'contract-2', status: 'TERMINATED', signedFileId: 'file-2' }),
    ])
    renderPage()

    await screen.findByText('Firmado')
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /borrar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  it('never renders any advanced/cryptographic-signature copy anywhere on the page', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
    listByRelationship.mockResolvedValueOnce([makeContract({ status: 'GENERATED' })])
    const { container } = renderPage()

    await screen.findByText('Contratos')
    expect(container.textContent).not.toMatch(/firma electrónica|firma digital|OTP|biométric/i)
  })

  it('shows origin/version/status for a contract row', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RELATIONSHIP_ACTIVE])
    listByRelationship.mockResolvedValueOnce([makeContract({ status: 'GENERATED', versionNumber: 2 })])
    renderPage()

    const card = await screen.findByText('Generado en Habitex')
    expect(within(card.closest('div') as HTMLElement).getByText('Versión 2')).toBeInTheDocument()
  })
})

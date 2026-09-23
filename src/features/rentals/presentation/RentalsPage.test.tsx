import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import RentalsPage from './RentalsPage'
import { RentalActivationError, RentalLifecycleError } from '../domain/rental.types'

const { listAccessibleAdministrations } = vi.hoisted(() => ({
  listAccessibleAdministrations: vi.fn(),
}))
const { listByAdministration } = vi.hoisted(() => ({ listByAdministration: vi.fn() }))
const { getSubscription } = vi.hoisted(() => ({ getSubscription: vi.fn() }))
const { activate } = vi.hoisted(() => ({ activate: vi.fn() }))
const { cancelDraft } = vi.hoisted(() => ({ cancelDraft: vi.fn() }))
const { startEnding } = vi.hoisted(() => ({ startEnding: vi.fn() }))
const { end } = vi.hoisted(() => ({ end: vi.fn() }))
const { listRelationshipIdsWithTerms } = vi.hoisted(() => ({ listRelationshipIdsWithTerms: vi.fn() }))

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
    activate,
    cancelDraft,
    startEnding,
    end,
    updateSchedule: vi.fn(),
  },
}))

vi.mock('../infrastructure/supabase-rental-terms.repository', () => ({
  supabaseRentalTermsRepository: { create: vi.fn(), getCurrent: vi.fn(), listRelationshipIdsWithTerms },
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

/** A DRAFT rental whose schedule is already complete - the other half (an existing term version) is supplied per-test via listRelationshipIdsWithTerms. */
const RENTAL_DRAFT_READY = {
  ...RENTAL_DRAFT,
  id: 'rental-draft-ready-1',
  realStartDate: '2026-01-01',
  trackingStartDate: '2026-01-01',
  paymentDay: 5,
  paymentTiming: 'ADVANCE' as const,
}

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

function TermsPageStub() {
  const { id } = useParams<{ id: string }>()
  return <div>Terms page for {id}</div>
}

function renderPage() {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/rentals']}>
        <Routes>
          <Route path="/rentals" element={<RentalsPage />} />
          <Route path="/rentals/new" element={<div>Add rental page</div>} />
          <Route path="/rentals/:id/terms" element={<TermsPageStub />} />
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
    listRelationshipIdsWithTerms.mockResolvedValue(new Set())
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

  it('shows an enabled Activate button for a DRAFT rental when access, capacity and terms readiness all allow it', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RENTAL_DRAFT_READY])
    listRelationshipIdsWithTerms.mockResolvedValueOnce(new Set([RENTAL_DRAFT_READY.id]))
    renderPage()

    expect(await screen.findByRole('button', { name: 'Activar' })).toBeEnabled()
  })

  it('disables Activate and shows the management-access reason when the subscription denies access', async () => {
    resolveOneAdministration()
    getSubscription.mockResolvedValueOnce({ ...UNLIMITED_SUBSCRIPTION, status: 'EXPIRED' })
    listByAdministration.mockResolvedValueOnce([RENTAL_DRAFT])
    renderPage()

    expect(await screen.findByRole('button', { name: 'Activar' })).toBeDisabled()
    // Both Activar and Cancelar are blocked by the same expired subscription
    // reason on this DRAFT row - findAllByText, not findByText, since the
    // sentence now legitimately appears twice.
    expect(
      await screen.findAllByText('Tu acceso de administración venció. Elige un plan para seguir gestionando tu cuenta.'),
    ).toHaveLength(2)
  })

  it('disables Activate and shows the capacity reason when the active count already meets the limit', async () => {
    resolveOneAdministration()
    getSubscription.mockResolvedValueOnce({ ...UNLIMITED_SUBSCRIPTION, activeRelationshipLimit: 1 })
    listByAdministration.mockResolvedValueOnce([RENTAL_1, RENTAL_DRAFT])
    renderPage()

    expect(await screen.findByRole('button', { name: 'Activar' })).toBeDisabled()
    expect(await screen.findByText('Alcanzaste el límite de relaciones activas de tu plan.')).toBeInTheDocument()
  })

  it('disables Activate and shows the termsIncomplete reason for a DRAFT rental missing schedule/terms, and "Completar términos" still navigates to the terms page', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RENTAL_DRAFT])
    listRelationshipIdsWithTerms.mockResolvedValueOnce(new Set())
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole('button', { name: 'Activar' })).toBeDisabled()
    expect(
      await screen.findByText('Completa los términos de este arriendo para poder activarlo.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Completar términos' }))

    expect(await screen.findByText('Terms page for rental-draft-1')).toBeInTheDocument()
  })

  it('clicking Activate on a ready DRAFT rental calls activate_rental_relationship with the real relationshipId', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RENTAL_DRAFT_READY])
    listRelationshipIdsWithTerms.mockResolvedValueOnce(new Set([RENTAL_DRAFT_READY.id]))
    activate.mockReturnValueOnce(new Promise(() => {}))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Activar' }))

    expect(activate).toHaveBeenCalledWith(RENTAL_DRAFT_READY.id)
  })

  it('shows a mapped error message scoped to the failed rental when the RPC rejects an activation this page thought was ready (stale client state)', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RENTAL_DRAFT_READY])
    listRelationshipIdsWithTerms.mockResolvedValueOnce(new Set([RENTAL_DRAFT_READY.id]))
    activate.mockRejectedValueOnce(new RentalActivationError('already_active'))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Activar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este arriendo ya fue activado. Actualiza la página para ver su estado actual.',
    )
  })

  it('activating a ready DRAFT rental succeeds, invalidates the rentals list, and the refetch reflects ACTIVE status', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RENTAL_DRAFT_READY])
    listByAdministration.mockResolvedValueOnce([{ ...RENTAL_DRAFT_READY, status: 'ACTIVE' as const }])
    listRelationshipIdsWithTerms.mockResolvedValue(new Set([RENTAL_DRAFT_READY.id]))
    activate.mockResolvedValueOnce({ ...RENTAL_DRAFT_READY, status: 'ACTIVE' as const })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Activar' }))

    expect(await screen.findByText('Arriendo en curso')).toBeInTheDocument()
    expect(listByAdministration).toHaveBeenCalledTimes(2)
  })

  it('walks a rental through its full lifecycle: DRAFT (ready) -> ACTIVE -> ENDING -> ENDED, each transition invalidating and refetching the rentals list', async () => {
    resolveOneAdministration()
    listRelationshipIdsWithTerms.mockResolvedValue(new Set([RENTAL_DRAFT_READY.id]))

    const activeRental = { ...RENTAL_DRAFT_READY, status: 'ACTIVE' as const }
    const endingRental = { ...RENTAL_DRAFT_READY, status: 'ENDING' as const }
    const endedRental = { ...RENTAL_DRAFT_READY, status: 'ENDED' as const, actualEndDate: '2026-09-23' }

    listByAdministration.mockResolvedValueOnce([RENTAL_DRAFT_READY])
    listByAdministration.mockResolvedValueOnce([activeRental])
    listByAdministration.mockResolvedValueOnce([endingRental])
    listByAdministration.mockResolvedValueOnce([endedRental])

    activate.mockResolvedValueOnce(activeRental)
    startEnding.mockResolvedValueOnce(endingRental)
    end.mockResolvedValueOnce(endedRental)

    const user = userEvent.setup()
    renderPage()

    // DRAFT -> ACTIVE
    await user.click(await screen.findByRole('button', { name: 'Activar' }))
    expect(await screen.findByText('Arriendo en curso')).toBeInTheDocument()
    expect(activate).toHaveBeenCalledWith(RENTAL_DRAFT_READY.id)

    // ACTIVE -> ENDING (single click, no confirmation)
    await user.click(await screen.findByRole('button', { name: 'Iniciar cierre' }))
    expect(await screen.findByText('Arriendo finalizando')).toBeInTheDocument()
    expect(startEnding).toHaveBeenCalledWith(RENTAL_DRAFT_READY.id)

    // ENDING -> ENDED (two-step confirm)
    await user.click(await screen.findByRole('button', { name: 'Terminar arriendo' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar terminación' }))
    expect(await screen.findByText('Arriendo finalizado')).toBeInTheDocument()
    expect(end).toHaveBeenCalledWith(RENTAL_DRAFT_READY.id)

    expect(listByAdministration).toHaveBeenCalledTimes(4)
  })

  it('cancels a DRAFT rental through the two-step confirm, invalidates the rentals list, and the refetch reflects CANCELLED status', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([RENTAL_DRAFT])
    listByAdministration.mockResolvedValueOnce([{ ...RENTAL_DRAFT, status: 'CANCELLED' as const }])
    listRelationshipIdsWithTerms.mockResolvedValue(new Set())
    cancelDraft.mockResolvedValueOnce({ ...RENTAL_DRAFT, status: 'CANCELLED' as const })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(cancelDraft).not.toHaveBeenCalled()

    await user.click(await screen.findByRole('button', { name: 'Confirmar cancelación' }))

    expect(cancelDraft).toHaveBeenCalledWith(RENTAL_DRAFT.id)
    expect(await screen.findByText('Arriendo cancelado')).toBeInTheDocument()
    expect(listByAdministration).toHaveBeenCalledTimes(2)
  })

  it('disables Cancelar and shows the management-access reason for a DRAFT rental when the subscription denies access', async () => {
    resolveOneAdministration()
    getSubscription.mockResolvedValueOnce({ ...UNLIMITED_SUBSCRIPTION, status: 'EXPIRED' })
    listByAdministration.mockResolvedValueOnce([RENTAL_DRAFT])
    renderPage()

    expect(await screen.findByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(
      await screen.findAllByText('Tu acceso de administración venció. Elige un plan para seguir gestionando tu cuenta.'),
    ).not.toHaveLength(0)
    expect(cancelDraft).not.toHaveBeenCalled()
  })

  it('does not block "Iniciar cierre" (ACTIVE) or "Terminar arriendo" (ENDING) when the subscription denies access', async () => {
    resolveOneAdministration()
    getSubscription.mockResolvedValueOnce({ ...UNLIMITED_SUBSCRIPTION, status: 'EXPIRED' })
    listByAdministration.mockResolvedValueOnce([
      RENTAL_1,
      { ...RENTAL_1, id: 'rental-ending-1', status: 'ENDING' as const },
    ])
    const user = userEvent.setup()
    renderPage()

    const startEndingButton = await screen.findByRole('button', { name: 'Iniciar cierre' })
    const endButton = screen.getByRole('button', { name: 'Terminar arriendo' })
    expect(startEndingButton).toBeEnabled()
    expect(endButton).toBeEnabled()

    startEnding.mockReturnValueOnce(new Promise(() => {}))
    await user.click(startEndingButton)
    expect(startEnding).toHaveBeenCalledWith(RENTAL_1.id)

    end.mockReturnValueOnce(new Promise(() => {}))
    await user.click(endButton)
    await user.click(screen.getByRole('button', { name: 'Confirmar terminación' }))
    expect(end).toHaveBeenCalledWith('rental-ending-1')
  })

  it('shows a mapped error message scoped to the failed rental when the RPC rejects a "Terminar arriendo" confirm this page thought was valid (stale client state)', async () => {
    resolveOneAdministration()
    listByAdministration.mockResolvedValueOnce([{ ...RENTAL_1, status: 'ENDING' as const }])
    end.mockRejectedValueOnce(new RentalLifecycleError('not_endable'))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Terminar arriendo' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar terminación' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este arriendo ya no se puede terminar desde aquí. Actualiza la página para ver su estado actual.',
    )
  })
})

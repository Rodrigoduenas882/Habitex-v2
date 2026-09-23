import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { AdministrationContextError } from '../domain/administration.types'
import { SubscriptionStatusBanner } from './SubscriptionStatusBanner'

const { listAccessibleAdministrations } = vi.hoisted(() => ({
  listAccessibleAdministrations: vi.fn(),
}))
const { getSubscription } = vi.hoisted(() => ({ getSubscription: vi.fn() }))

vi.mock('../infrastructure/supabase-administration.repository', () => ({
  supabaseAdministrationRepository: { listAccessibleAdministrations },
}))

vi.mock('../infrastructure/supabase-subscription.repository', () => ({
  supabaseSubscriptionRepository: { getSubscription },
}))

const ADMIN_1 = { id: 'admin-1', name: 'Edificio Central', status: 'ACTIVE' } as const

const BASE_SUBSCRIPTION = {
  id: 'sub-1',
  administrationId: 'admin-1',
  planCode: 'starter',
  trialStartedAt: null,
  currentPeriodStartsAt: null,
  currentPeriodEndsAt: null,
  activeRelationshipLimit: 10,
}

function renderBanner() {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <SubscriptionStatusBanner />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-22T00:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  window.localStorage.clear()
})

describe('SubscriptionStatusBanner', () => {
  it('renders nothing while the active administration has not resolved yet', () => {
    listAccessibleAdministrations.mockReturnValueOnce(new Promise(() => {}))

    renderBanner()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders nothing when there is no accessible administration', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([])

    renderBanner()

    await vi.waitFor(() => {
      expect(listAccessibleAdministrations).toHaveBeenCalled()
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(getSubscription).not.toHaveBeenCalled()
  })

  it('renders nothing while the subscription query is loading', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([ADMIN_1])
    getSubscription.mockReturnValueOnce(new Promise(() => {}))

    renderBanner()

    await vi.waitFor(() => {
      expect(getSubscription).toHaveBeenCalledWith('admin-1')
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders nothing when the subscription query errors', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([ADMIN_1])
    getSubscription.mockRejectedValueOnce(
      new AdministrationContextError('Failed to resolve the administration subscription'),
    )

    renderBanner()

    await vi.waitFor(() => {
      expect(getSubscription).toHaveBeenCalled()
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders nothing when the administration has no subscription row yet (null)', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([ADMIN_1])
    getSubscription.mockResolvedValueOnce(null)

    renderBanner()

    await vi.waitFor(() => {
      expect(getSubscription).toHaveBeenCalled()
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders nothing for an ACTIVE subscription', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([ADMIN_1])
    getSubscription.mockResolvedValueOnce({
      ...BASE_SUBSCRIPTION,
      status: 'ACTIVE',
      trialEndsAt: null,
      managementAccessUntil: null,
    })

    renderBanner()

    await vi.waitFor(() => {
      expect(getSubscription).toHaveBeenCalled()
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an info alert with days remaining while inside the trial window', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([ADMIN_1])
    getSubscription.mockResolvedValueOnce({
      ...BASE_SUBSCRIPTION,
      status: 'TRIALING',
      trialEndsAt: '2026-09-25T00:00:00Z',
      managementAccessUntil: null,
    })

    renderBanner()

    expect(await screen.findByText('Tu prueba gratuita termina en 3 días.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
    const cta = screen.getByRole('button', { name: 'Ver planes' })
    expect(cta).toBeDisabled()
    expect(cta).toHaveAttribute('aria-disabled', 'true')
  })

  it('shows a warning alert with days remaining once the trial ended but the grace period has not', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([ADMIN_1])
    getSubscription.mockResolvedValueOnce({
      ...BASE_SUBSCRIPTION,
      status: 'TRIALING',
      trialEndsAt: '2026-09-10T00:00:00Z',
      managementAccessUntil: '2026-09-27T00:00:00Z',
    })

    renderBanner()

    expect(
      await screen.findByText(
        'Tu prueba gratuita terminó. Tienes 5 días más para elegir un plan antes de perder acceso.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows a danger alert once the trial ended and the grace period has also ended', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([ADMIN_1])
    getSubscription.mockResolvedValueOnce({
      ...BASE_SUBSCRIPTION,
      status: 'TRIALING',
      trialEndsAt: '2026-09-01T00:00:00Z',
      managementAccessUntil: '2026-09-10T00:00:00Z',
    })

    renderBanner()

    expect(
      await screen.findByText('Tu acceso de administración venció. Elige un plan para seguir usando Habitex.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows a warning alert for PAST_DUE, unconditionally - even if management access has already expired', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([ADMIN_1])
    getSubscription.mockResolvedValueOnce({
      ...BASE_SUBSCRIPTION,
      status: 'PAST_DUE',
      trialEndsAt: null,
      managementAccessUntil: '2026-09-10T00:00:00Z',
    })

    renderBanner()

    expect(
      await screen.findByText(
        'Hay un problema con el pago de tu suscripción. Revísalo para evitar perder acceso.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows a danger alert for EXPIRED', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([ADMIN_1])
    getSubscription.mockResolvedValueOnce({
      ...BASE_SUBSCRIPTION,
      status: 'EXPIRED',
      trialEndsAt: null,
      managementAccessUntil: null,
    })

    renderBanner()

    expect(
      await screen.findByText('Tu acceso de administración venció. Elige un plan para seguir usando Habitex.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows a danger alert for CANCELED', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([ADMIN_1])
    getSubscription.mockResolvedValueOnce({
      ...BASE_SUBSCRIPTION,
      status: 'CANCELED',
      trialEndsAt: null,
      managementAccessUntil: null,
    })

    renderBanner()

    expect(
      await screen.findByText('Tu suscripción fue cancelada. Elige un plan para seguir usando Habitex.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

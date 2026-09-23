import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { AddRoomRentalPropertyForm } from './AddRoomRentalPropertyForm'

const { getSubscription } = vi.hoisted(() => ({ getSubscription: vi.fn() }))

vi.mock('../infrastructure/supabase-property.repository', () => ({
  supabasePropertyRepository: {
    createFullProperty: vi.fn(),
    createRoomRentalProperty: vi.fn(),
    listByAdministration: vi.fn(),
  },
}))

vi.mock('@/features/administration/infrastructure/supabase-subscription.repository', () => ({
  supabaseSubscriptionRepository: { getSubscription },
}))

/** Grants management access, no capacity limit - the default most tests rely on. */
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

beforeEach(() => {
  getSubscription.mockResolvedValue(UNLIMITED_SUBSCRIPTION)
})

function renderForm() {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/properties/new']}>
        <Routes>
          <Route
            path="/properties/new"
            element={<AddRoomRentalPropertyForm administrationId="admin-1" onBack={() => {}} />}
          />
          <Route path="/properties/:propertyId/rooms/setup" element={<div>Room setup page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AddRoomRentalPropertyForm', () => {
  it('disables the submit button and shows the management-access reason when the subscription denies access', async () => {
    getSubscription.mockResolvedValueOnce({ ...UNLIMITED_SUBSCRIPTION, status: 'EXPIRED' })
    renderForm()

    expect(
      await screen.findByText('Tu acceso de administración venció. Elige un plan para seguir gestionando tu cuenta.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar y configurar habitaciones' })).toBeDisabled()
  })

  it('leaves the submit button enabled and shows no gate reason when the subscription grants access', async () => {
    renderForm()

    expect(await screen.findByRole('button', { name: 'Guardar y configurar habitaciones' })).toBeEnabled()
    expect(
      screen.queryByText('Tu acceso de administración venció. Elige un plan para seguir gestionando tu cuenta.'),
    ).not.toBeInTheDocument()
  })
})

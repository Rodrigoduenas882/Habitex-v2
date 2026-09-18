import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import RentalsPage from './RentalsPage'

const { listAccessibleAdministrations } = vi.hoisted(() => ({
  listAccessibleAdministrations: vi.fn(),
}))
const { listByAdministration } = vi.hoisted(() => ({ listByAdministration: vi.fn() }))

vi.mock('@/features/administration/infrastructure/supabase-administration.repository', () => ({
  supabaseAdministrationRepository: { listAccessibleAdministrations },
}))

vi.mock('../infrastructure/supabase-rental.repository', () => ({
  supabaseRentalRepository: { listByAdministration },
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

function renderPage() {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/rentals']}>
        <Routes>
          <Route path="/rentals" element={<RentalsPage />} />
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

  it('shows an explicit state for multiple administrations, without auto-selecting one', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([
      { id: 'admin-1', name: 'Administración Uno', status: 'ACTIVE' },
      { id: 'admin-2', name: 'Administración Dos', status: 'ACTIVE' },
    ])
    renderPage()

    expect(await screen.findByText('Tienes varias administraciones')).toBeInTheDocument()
    expect(listByAdministration).not.toHaveBeenCalled()
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
})

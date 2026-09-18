import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import PropertiesPage from './PropertiesPage'

const { listAccessibleAdministrations } = vi.hoisted(() => ({
  listAccessibleAdministrations: vi.fn(),
}))
const { listByAdministration } = vi.hoisted(() => ({ listByAdministration: vi.fn() }))

vi.mock('@/features/administration/infrastructure/supabase-administration.repository', () => ({
  supabaseAdministrationRepository: { listAccessibleAdministrations },
}))

vi.mock('../infrastructure/supabase-property.repository', () => ({
  supabasePropertyRepository: { listByAdministration },
}))

function renderPage() {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/properties']}>
        <Routes>
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/properties/new" element={<div>Add property page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PropertiesPage', () => {
  it('shows a loading state while the current administration is still resolving', () => {
    listAccessibleAdministrations.mockReturnValueOnce(new Promise(() => {}))
    renderPage()

    expect(screen.getByTestId('properties-loading')).toBeInTheDocument()
  })

  it('shows an error state when resolving the current administration fails', async () => {
    listAccessibleAdministrations.mockRejectedValueOnce(new Error('boom'))
    renderPage()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('shows a loading state, then the real properties once the administration and properties both resolve', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([
      { id: 'admin-1', name: 'Administración Uno', status: 'ACTIVE' },
    ])
    listByAdministration.mockResolvedValueOnce([
      {
        id: 'prop-1',
        administrationId: 'admin-1',
        propertyType: 'APARTMENT',
        rentalMode: 'FULL_PROPERTY',
        name: 'Apartamento 302',
        countryCode: 'CO',
        city: 'Bogotá',
        address: 'Calle 1 # 2-3',
        hasAdministration: true,
        administrationFee: 150000,
      },
    ])
    renderPage()

    expect(screen.getByTestId('properties-loading')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Apartamento 302')).toBeInTheDocument()
    })
    expect(screen.getByText('Bogotá')).toBeInTheDocument()
    expect(screen.getByText('Calle 1 # 2-3')).toBeInTheDocument()
    expect(screen.getByText('Apartamento')).toBeInTheDocument()
    expect(screen.getByText('Inmueble completo')).toBeInTheDocument()
    expect(listByAdministration).toHaveBeenCalledWith('admin-1')

    // No invented occupancy copy anywhere on the page - properties doesn't
    // carry that information yet (see Property's own doc comment).
    expect(screen.queryByText('Arrendado')).not.toBeInTheDocument()
    expect(screen.queryByText('Disponible')).not.toBeInTheDocument()
    expect(screen.queryByText(/rented/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/available/i)).not.toBeInTheDocument()
  })

  it('shows the empty state when the administration has no properties', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([
      { id: 'admin-1', name: 'Administración Uno', status: 'ACTIVE' },
    ])
    listByAdministration.mockResolvedValueOnce([])
    renderPage()

    expect(await screen.findByText('Todavía no tienes inmuebles')).toBeInTheDocument()
  })

  it('shows an error state when fetching properties fails', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([
      { id: 'admin-1', name: 'Administración Uno', status: 'ACTIVE' },
    ])
    listByAdministration.mockRejectedValueOnce(new Error('boom'))
    renderPage()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('shows an explicit state (not an empty list) when the account has no administrations', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([])
    renderPage()

    expect(await screen.findByText('Todavía no tienes una administración')).toBeInTheDocument()
    expect(listByAdministration).not.toHaveBeenCalled()
  })

  it('navigates to /properties/new when "Agregar inmueble" is clicked', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([
      { id: 'admin-1', name: 'Administración Uno', status: 'ACTIVE' },
    ])
    listByAdministration.mockResolvedValueOnce([])
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Agregar inmueble' }))

    expect(await screen.findByText('Add property page')).toBeInTheDocument()
  })

  it('does not show the "Agregar inmueble" CTA while the administration is not resolved', () => {
    listAccessibleAdministrations.mockReturnValueOnce(new Promise(() => {}))
    renderPage()

    expect(screen.queryByRole('button', { name: 'Agregar inmueble' })).not.toBeInTheDocument()
  })
})

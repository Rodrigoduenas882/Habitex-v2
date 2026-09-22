import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import AddPropertyPage from './AddPropertyPage'

const { listAccessibleAdministrations } = vi.hoisted(() => ({
  listAccessibleAdministrations: vi.fn(),
}))
const { createFullProperty, createRoomRentalProperty } = vi.hoisted(() => ({
  createFullProperty: vi.fn(),
  createRoomRentalProperty: vi.fn(),
}))

vi.mock('@/features/administration/infrastructure/supabase-administration.repository', () => ({
  supabaseAdministrationRepository: { listAccessibleAdministrations },
}))

vi.mock('../infrastructure/supabase-property.repository', () => ({
  supabasePropertyRepository: {
    createFullProperty,
    createRoomRentalProperty,
    listByAdministration: vi.fn(),
  },
}))

function renderPage() {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/properties/new']}>
        <Routes>
          <Route path="/properties/new" element={<AddPropertyPage />} />
          <Route path="/properties" element={<div>Properties list page</div>} />
          <Route path="/properties/:propertyId/rooms/setup" element={<div>Room setup page</div>} />
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

async function fillBaseFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nombre del inmueble'), 'Apartamento 302')
  await user.type(screen.getByLabelText('Dirección'), 'Calle 1 # 2-3')
  await user.type(screen.getByLabelText('Ciudad'), 'Bogotá')
}

describe('AddPropertyPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('gates on Administration Context: shows loading while resolving', () => {
    listAccessibleAdministrations.mockReturnValueOnce(new Promise(() => {}))
    renderPage()

    expect(screen.getByTestId('add-property-loading')).toBeInTheDocument()
  })

  it('gates on Administration Context: shows an error state', async () => {
    listAccessibleAdministrations.mockRejectedValueOnce(new Error('boom'))
    renderPage()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('gates on Administration Context: shows an explicit state for zero administrations, never a bare form', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([])
    renderPage()

    expect(await screen.findByText('Todavía no tienes una administración')).toBeInTheDocument()
    expect(screen.queryByText('¿Qué quieres administrar?')).not.toBeInTheDocument()
  })

  it('gates on Administration Context: shows the AdministrationPicker for multiple administrations, never a bare selector', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([
      { id: 'admin-1', name: 'Administración Uno', status: 'ACTIVE' },
      { id: 'admin-2', name: 'Administración Dos', status: 'ACTIVE' },
    ])
    renderPage()

    expect(await screen.findByText('Selecciona una administración')).toBeInTheDocument()
    expect(screen.queryByText('¿Qué quieres administrar?')).not.toBeInTheDocument()
  })

  it('selecting an administration from the picker resolves to the "¿Qué quieres administrar?" selector', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([
      { id: 'admin-1', name: 'Administración Uno', status: 'ACTIVE' },
      { id: 'admin-2', name: 'Administración Dos', status: 'ACTIVE' },
    ])
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('radio', { name: 'Administración Dos, Activa' }))

    expect(await screen.findByText('¿Qué quieres administrar?')).toBeInTheDocument()
  })

  it('shows the "¿Qué quieres administrar?" selector once resolved', async () => {
    resolveOneAdministration()
    renderPage()

    expect(await screen.findByText('¿Qué quieres administrar?')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Casa o apartamento completo' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Habitaciones de una propiedad' })).toBeInTheDocument()
  })

  it('Parking is a real, selectable option that renders ParkingForm', async () => {
    resolveOneAdministration()
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('¿Qué quieres administrar?')

    const parkingOption = screen.getByRole('radio', { name: 'Parqueadero' })
    expect(parkingOption).toBeEnabled()

    await user.click(parkingOption)

    expect(await screen.findByRole('heading', { name: 'Parqueadero' })).toBeInTheDocument()
    expect(screen.getByLabelText('Identificador')).toBeInTheDocument()
  })

  it('never shows technical terms like FULL_PROPERTY, BY_ROOMS or RPC names', async () => {
    resolveOneAdministration()
    renderPage()
    await screen.findByText('¿Qué quieres administrar?')

    expect(screen.queryByText(/FULL_PROPERTY/)).not.toBeInTheDocument()
    expect(screen.queryByText(/BY_ROOMS/)).not.toBeInTheDocument()
    expect(screen.queryByText(/create_full_property_asset/)).not.toBeInTheDocument()
    expect(screen.queryByText(/create_room_rental_property/)).not.toBeInTheDocument()
  })

  it('shows validation errors when submitting the full property form empty', async () => {
    resolveOneAdministration()
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('radio', { name: 'Casa o apartamento completo' }))

    await user.click(screen.getByRole('button', { name: 'Guardar inmueble' }))

    expect(await screen.findByText('Ingresa el nombre del inmueble.')).toBeInTheDocument()
    expect(screen.getByText('Ingresa la dirección.')).toBeInTheDocument()
    expect(screen.getByText('Ingresa la ciudad.')).toBeInTheDocument()
    expect(createFullProperty).not.toHaveBeenCalled()
  })

  it('shows the administration fee field only when "¿Paga administración?" is Sí, and validates it', async () => {
    resolveOneAdministration()
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('radio', { name: 'Casa o apartamento completo' }))

    expect(screen.queryByLabelText('Valor mensual de administración')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('¿El inmueble paga administración?'), 'yes')
    expect(screen.getByLabelText('Valor mensual de administración')).toBeInTheDocument()

    await fillBaseFields(user)
    await user.click(screen.getByRole('button', { name: 'Guardar inmueble' }))

    expect(
      await screen.findByText('Ingresa un valor de administración válido (0 o más).'),
    ).toBeInTheDocument()
    expect(createFullProperty).not.toHaveBeenCalled()
  })

  it('submits the full property form and navigates to /properties on success', async () => {
    resolveOneAdministration()
    createFullProperty.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('radio', { name: 'Casa o apartamento completo' }))

    await fillBaseFields(user)
    await user.click(screen.getByRole('button', { name: 'Guardar inmueble' }))

    await waitFor(() => {
      expect(createFullProperty).toHaveBeenCalledWith(
        expect.objectContaining({
          administrationId: 'admin-1',
          propertyType: 'APARTMENT',
          name: 'Apartamento 302',
          address: 'Calle 1 # 2-3',
          city: 'Bogotá',
          countryCode: 'CO',
          hasAdministration: false,
          administrationFee: null,
        }),
      )
    })
    expect(await screen.findByText('Properties list page')).toBeInTheDocument()
  })

  it('submits the room-rental property form and navigates to room setup with the created id', async () => {
    resolveOneAdministration()
    createRoomRentalProperty.mockResolvedValueOnce({
      id: 'prop-2',
      administrationId: 'admin-1',
      propertyType: 'HOUSE',
      rentalMode: 'BY_ROOMS',
      name: 'Casa 14',
      countryCode: 'CO',
      city: 'Medellín',
      address: 'Cra 1 # 2-3',
      hasAdministration: false,
      administrationFee: null,
    })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('radio', { name: 'Habitaciones de una propiedad' }))

    await user.type(screen.getByLabelText('Nombre del inmueble'), 'Casa 14')
    await user.type(screen.getByLabelText('Dirección'), 'Cra 1 # 2-3')
    await user.type(screen.getByLabelText('Ciudad'), 'Medellín')
    await user.click(screen.getByRole('button', { name: 'Guardar y configurar habitaciones' }))

    expect(await screen.findByText('Room setup page')).toBeInTheDocument()
  })

  it('shows an error alert when the create mutation fails, and does not navigate away', async () => {
    resolveOneAdministration()
    createFullProperty.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('radio', { name: 'Casa o apartamento completo' }))

    await fillBaseFields(user)
    await user.click(screen.getByRole('button', { name: 'Guardar inmueble' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Properties list page')).not.toBeInTheDocument()
  })

  it('goes back to the selector when "Volver" is clicked', async () => {
    resolveOneAdministration()
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('radio', { name: 'Casa o apartamento completo' }))
    await screen.findByRole('button', { name: 'Guardar inmueble' })

    await user.click(screen.getByRole('button', { name: 'Volver' }))

    expect(await screen.findByText('¿Qué quieres administrar?')).toBeInTheDocument()
  })
})

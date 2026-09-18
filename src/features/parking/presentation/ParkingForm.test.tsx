import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { ParkingRepositoryError } from '../domain/parking.types'
import { ParkingForm } from './ParkingForm'

const { listByAdministration } = vi.hoisted(() => ({ listByAdministration: vi.fn() }))
const { create } = vi.hoisted(() => ({ create: vi.fn() }))

vi.mock('@/features/properties/infrastructure/supabase-property.repository', () => ({
  supabasePropertyRepository: {
    listByAdministration,
    createFullProperty: vi.fn(),
    createRoomRentalProperty: vi.fn(),
  },
}))

vi.mock('../infrastructure/supabase-parking.repository', () => ({
  supabaseParkingRepository: { create },
}))

const PROPERTY_1 = {
  id: 'prop-1',
  administrationId: 'admin-1',
  propertyType: 'APARTMENT' as const,
  rentalMode: 'FULL_PROPERTY' as const,
  name: 'Apartamento 302',
  countryCode: 'CO',
  city: 'Bogotá',
  address: 'Calle 1 # 2-3',
  hasAdministration: false,
  administrationFee: null,
}

function renderForm() {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/properties/new']}>
        <Routes>
          <Route
            path="/properties/new"
            element={<ParkingForm administrationId="admin-1" onBack={() => {}} />}
          />
          <Route path="/properties" element={<div>Properties list page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function waitForPropertiesToSettle() {
  await waitFor(() => {
    expect(screen.queryByText('Cargando tus inmuebles…')).not.toBeInTheDocument()
  })
}

describe('ParkingForm', () => {
  it('requires an identifier', async () => {
    listByAdministration.mockResolvedValueOnce([])
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Guardar parqueadero' }))

    expect(await screen.findByText('Ingresa un identificador.')).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects a whitespace-only identifier (trim)', async () => {
    listByAdministration.mockResolvedValueOnce([])
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Identificador'), '   ')
    await user.click(screen.getByRole('button', { name: 'Guardar parqueadero' }))

    expect(await screen.findByText('Ingresa un identificador.')).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('defaults to independent and submits propertyId null', async () => {
    listByAdministration.mockResolvedValueOnce([])
    create.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Identificador'), 'Parqueadero 12')
    await user.click(screen.getByRole('button', { name: 'Guardar parqueadero' }))

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ administrationId: 'admin-1', propertyId: null }),
      )
    })
  })

  it('disables "Sí" while properties are still loading', () => {
    listByAdministration.mockReturnValueOnce(new Promise(() => {}))
    renderForm()

    expect(screen.getByRole('option', { name: 'Sí, asociado a un inmueble' })).toBeDisabled()
    expect(screen.getByText('Cargando tus inmuebles…')).toBeInTheDocument()
  })

  it('disables "Sí" and shows an error hint when properties fail to load', async () => {
    listByAdministration.mockRejectedValueOnce(new Error('boom'))
    renderForm()

    await screen.findByText('No pudimos cargar tus inmuebles. Intenta de nuevo.')
    expect(screen.getByRole('option', { name: 'Sí, asociado a un inmueble' })).toBeDisabled()
  })

  it('disables "Sí" and shows a hint when there are zero properties', async () => {
    listByAdministration.mockResolvedValueOnce([])
    renderForm()
    await waitForPropertiesToSettle()

    expect(screen.getByRole('option', { name: 'Sí, asociado a un inmueble' })).toBeDisabled()
    expect(screen.getByText('Todavía no tienes inmuebles para asociar.')).toBeInTheDocument()
  })

  it('reveals the Property select when associated, listing the real properties', async () => {
    listByAdministration.mockResolvedValueOnce([PROPERTY_1])
    const user = userEvent.setup()
    renderForm()
    await waitForPropertiesToSettle()

    await user.selectOptions(screen.getByLabelText('¿Pertenece a un inmueble?'), 'yes')

    expect(await screen.findByLabelText('Selecciona el inmueble')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Apartamento 302' })).toBeInTheDocument()
  })

  it('requires selecting a property when associated', async () => {
    listByAdministration.mockResolvedValueOnce([PROPERTY_1])
    const user = userEvent.setup()
    renderForm()
    await waitForPropertiesToSettle()

    await user.selectOptions(screen.getByLabelText('¿Pertenece a un inmueble?'), 'yes')
    await user.type(screen.getByLabelText('Identificador'), 'Parqueadero 12')
    await user.click(screen.getByRole('button', { name: 'Guardar parqueadero' }))

    expect(await screen.findByText('Selecciona un inmueble.')).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('submits the real selected propertyId when associated', async () => {
    listByAdministration.mockResolvedValueOnce([PROPERTY_1])
    create.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderForm()
    await waitForPropertiesToSettle()

    await user.selectOptions(screen.getByLabelText('¿Pertenece a un inmueble?'), 'yes')
    await user.selectOptions(await screen.findByLabelText('Selecciona el inmueble'), 'prop-1')
    await user.type(screen.getByLabelText('Identificador'), 'Parqueadero 12')
    await user.click(screen.getByRole('button', { name: 'Guardar parqueadero' }))

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ propertyId: 'prop-1' }))
    })
  })

  it('sends covered as null when left unspecified', async () => {
    listByAdministration.mockResolvedValueOnce([])
    create.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Identificador'), 'Parqueadero 12')
    await user.click(screen.getByRole('button', { name: 'Guardar parqueadero' }))

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ covered: null }))
    })
  })

  it('sends covered true when "Sí" is selected', async () => {
    listByAdministration.mockResolvedValueOnce([])
    create.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderForm()

    await user.selectOptions(screen.getByLabelText('¿Es cubierto?'), 'yes')
    await user.type(screen.getByLabelText('Identificador'), 'Parqueadero 12')
    await user.click(screen.getByRole('button', { name: 'Guardar parqueadero' }))

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ covered: true }))
    })
  })

  it('sends covered false when "No" is selected', async () => {
    listByAdministration.mockResolvedValueOnce([])
    create.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderForm()

    await user.selectOptions(screen.getByLabelText('¿Es cubierto?'), 'no')
    await user.type(screen.getByLabelText('Identificador'), 'Parqueadero 12')
    await user.click(screen.getByRole('button', { name: 'Guardar parqueadero' }))

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ covered: false }))
    })
  })

  it('sends allowedVehicleType as null when left unspecified', async () => {
    listByAdministration.mockResolvedValueOnce([])
    create.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Identificador'), 'Parqueadero 12')
    await user.click(screen.getByRole('button', { name: 'Guardar parqueadero' }))

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ allowedVehicleType: null }))
    })
  })

  it('sends CAR/MOTORCYCLE/BOTH exactly as selected', async () => {
    for (const [optionLabel, expected] of [
      ['Carro', 'CAR'],
      ['Moto', 'MOTORCYCLE'],
      ['Carro o moto', 'BOTH'],
    ] as const) {
      listByAdministration.mockResolvedValueOnce([])
      create.mockResolvedValueOnce(undefined)
      const user = userEvent.setup()
      renderForm()

      await user.selectOptions(screen.getByLabelText('Vehículos permitidos'), optionLabel)
      await user.type(screen.getByLabelText('Identificador'), 'Parqueadero 12')
      await user.click(screen.getByRole('button', { name: 'Guardar parqueadero' }))

      await waitFor(() => {
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ allowedVehicleType: expected }))
      })
    }
  })

  it('sends location, accessType and observations as null when left empty', async () => {
    listByAdministration.mockResolvedValueOnce([])
    create.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Identificador'), 'Parqueadero 12')
    await user.click(screen.getByRole('button', { name: 'Guardar parqueadero' }))

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ location: null, accessType: null, observations: null }),
      )
    })
  })

  it('disables the form and shows the pending label while submitting', async () => {
    listByAdministration.mockResolvedValueOnce([])
    let resolveCreate: () => void = () => {}
    create.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveCreate = resolve
      }),
    )
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Identificador'), 'Parqueadero 12')
    await user.click(screen.getByRole('button', { name: 'Guardar parqueadero' }))

    expect(await screen.findByRole('button', { name: 'Guardando…' })).toBeDisabled()
    resolveCreate()
  })

  it('shows a human error message when the repository call fails, never the raw error', async () => {
    listByAdministration.mockResolvedValueOnce([])
    create.mockRejectedValueOnce(new ParkingRepositoryError('Failed to create the parking'))
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Identificador'), 'Parqueadero 12')
    await user.click(screen.getByRole('button', { name: 'Guardar parqueadero' }))

    expect(
      await screen.findByText('No pudimos guardar el parqueadero. Intenta de nuevo.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/postgres/i)).not.toBeInTheDocument()
  })

  it('shows an explicit success state with the identifier, does not auto-navigate, and only returns to /properties when "Volver a inmuebles" is clicked', async () => {
    listByAdministration.mockResolvedValueOnce([])
    create.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Identificador'), 'Parqueadero 12')
    await user.click(screen.getByRole('button', { name: 'Guardar parqueadero' }))

    expect(await screen.findByText('Parqueadero registrado')).toBeInTheDocument()
    expect(
      screen.getByText('"Parqueadero 12" quedó registrado correctamente.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Properties list page')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Volver a inmuebles' }))

    expect(await screen.findByText('Properties list page')).toBeInTheDocument()
  })
})

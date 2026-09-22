import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { RoomRepositoryError } from '../domain/room.types'
import RoomSetupPage from './RoomSetupPage'

const { createForProperty, listByProperty } = vi.hoisted(() => ({
  createForProperty: vi.fn(),
  listByProperty: vi.fn(),
}))

vi.mock('../infrastructure/supabase-room.repository', () => ({
  supabaseRoomRepository: { createForProperty, listByProperty },
}))

function renderPage() {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/properties/prop-1/rooms/setup']}>
        <Routes>
          <Route path="/properties/:propertyId/rooms/setup" element={<RoomSetupPage />} />
          <Route path="/properties" element={<div>Properties list page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const ROOM_1 = {
  id: 'room-1',
  propertyId: 'prop-1',
  name: 'Habitación 1',
  bathroomType: 'PRIVATE' as const,
  furnished: true,
  description: null,
  isEnabled: true,
}

describe('RoomSetupPage', () => {
  it('shows a loading state while the real rooms are being fetched', () => {
    listByProperty.mockReturnValueOnce(new Promise(() => {}))
    renderPage()

    expect(screen.getByTestId('rooms-loading')).toBeInTheDocument()
  })

  it('shows an error state when fetching rooms fails', async () => {
    listByProperty.mockRejectedValueOnce(new RoomRepositoryError('Failed to list rooms for the property'))
    renderPage()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('disables "Terminar configuración" when the property has zero real rooms', async () => {
    listByProperty.mockResolvedValueOnce([])
    renderPage()

    await screen.findByText('Todavía no has agregado habitaciones.')
    expect(screen.getByRole('button', { name: 'Terminar configuración' })).toBeDisabled()
    expect(screen.getByText('Agrega al menos una habitación para poder terminar.')).toBeInTheDocument()
  })

  it('enables "Terminar configuración" when the property already has at least one real room', async () => {
    listByProperty.mockResolvedValueOnce([ROOM_1])
    renderPage()

    await screen.findByText('Habitación 1')
    expect(screen.getByRole('button', { name: 'Terminar configuración' })).toBeEnabled()
  })

  it('behaves the same on a fresh mount (refresh/direct URL entry) as any other mount - the backend decides, not navigation state', async () => {
    // No special setup beyond the standard render - there is no
    // justCreated/navigation-state concept left to configure. The backend
    // response is what determines the finish gate.
    listByProperty.mockResolvedValueOnce([ROOM_1])
    renderPage()

    await screen.findByText('Habitación 1')
    expect(screen.getByRole('button', { name: 'Terminar configuración' })).toBeEnabled()
    expect(listByProperty).toHaveBeenCalledWith('prop-1')
  })

  it('renders the real rooms returned by the backend, including their bathroom type', async () => {
    listByProperty.mockResolvedValueOnce([ROOM_1])
    renderPage()

    const roomItem = await screen.findByText('Habitación 1')
    const listItem = roomItem.closest('li')
    expect(listItem).not.toBeNull()
    expect(within(listItem as HTMLElement).getByText('Baño privado')).toBeInTheDocument()
  })

  it('refetches the real rooms list after creating a room, and reflects it in "Terminar"', async () => {
    listByProperty.mockResolvedValueOnce([])
    listByProperty.mockResolvedValueOnce([ROOM_1])
    createForProperty.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Todavía no has agregado habitaciones.')
    expect(screen.getByRole('button', { name: 'Terminar configuración' })).toBeDisabled()

    await user.type(screen.getByLabelText('Nombre de la habitación'), 'Habitación 1')
    await user.click(screen.getByRole('button', { name: 'Agregar habitación' }))

    await waitFor(() => {
      expect(listByProperty).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('Habitación 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Terminar configuración' })).toBeEnabled()
  })

  it('requires a room name', async () => {
    listByProperty.mockResolvedValueOnce([])
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Todavía no has agregado habitaciones.')

    await user.click(screen.getByRole('button', { name: 'Agregar habitación' }))

    expect(await screen.findByText('Ingresa el nombre de la habitación.')).toBeInTheDocument()
    expect(createForProperty).not.toHaveBeenCalled()
  })

  it('allows leaving bathroom type unspecified (null) and defaults furnished to false', async () => {
    listByProperty.mockResolvedValueOnce([])
    createForProperty.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Todavía no has agregado habitaciones.')

    await user.type(screen.getByLabelText('Nombre de la habitación'), 'Habitación 2')
    await user.click(screen.getByRole('button', { name: 'Agregar habitación' }))

    await waitFor(() => {
      expect(createForProperty).toHaveBeenCalledWith(
        expect.objectContaining({ propertyId: 'prop-1', bathroomType: null, furnished: false }),
      )
    })
  })

  it('maps a duplicate-name failure (UNIQUE(property_id, name)) to comprehensible feedback, not the raw Postgres error', async () => {
    listByProperty.mockResolvedValueOnce([])
    createForProperty.mockRejectedValueOnce(
      new RoomRepositoryError('Failed to create the room', 'duplicate_name', {
        code: '23505',
        message: 'duplicate key value violates unique constraint "rooms_property_id_name_key"',
      }),
    )
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Todavía no has agregado habitaciones.')

    await user.type(screen.getByLabelText('Nombre de la habitación'), 'Habitación 1')
    await user.click(screen.getByRole('button', { name: 'Agregar habitación' }))

    expect(
      await screen.findByText('Ya existe una habitación con ese nombre en este inmueble. Usa un nombre diferente.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/unique constraint/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/23505/)).not.toBeInTheDocument()
  })

  it('shows a generic message for a non-duplicate failure, without losing the typed form values', async () => {
    listByProperty.mockResolvedValueOnce([])
    createForProperty.mockRejectedValueOnce(new RoomRepositoryError('Failed to create the room'))
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Todavía no has agregado habitaciones.')

    await user.type(screen.getByLabelText('Nombre de la habitación'), 'Habitación 1')
    await user.click(screen.getByRole('button', { name: 'Agregar habitación' }))

    expect(await screen.findByText('No pudimos guardar la habitación. Intenta de nuevo.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre de la habitación')).toHaveValue('Habitación 1')
  })
})

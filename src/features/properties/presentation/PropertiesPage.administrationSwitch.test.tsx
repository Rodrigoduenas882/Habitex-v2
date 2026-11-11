import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import type { ActiveAdministrationState } from '@/features/administration/application/useActiveAdministration'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import PropertiesPage from './PropertiesPage'

/**
 * The search term and the local filters must not survive an administration
 * change: a city (or a name) that only existed in the previous
 * administration would silently hide everything in the new one, looking
 * like "this administration has no inmuebles".
 *
 * This lives in its own file because it is the one scenario that needs
 * useActiveAdministration itself mocked. /properties has no in-page
 * administration switcher today (AdministrationPicker only renders while
 * nothing is selected yet, i.e. before any filter UI exists), so the
 * transition cannot be driven through the real UI - but the reset is what
 * keeps the page correct the moment such a switcher is added, so it is
 * covered here against the real page rather than left to code reading.
 */
const { listPropertiesByAdministration } = vi.hoisted(() => ({
  listPropertiesByAdministration: vi.fn(),
}))
const { listParkingsByAdministration } = vi.hoisted(() => ({
  listParkingsByAdministration: vi.fn(),
}))
const { listRooms } = vi.hoisted(() => ({ listRooms: vi.fn() }))
const { listRentalSubjects, listSubjectLinks } = vi.hoisted(() => ({
  listRentalSubjects: vi.fn(),
  listSubjectLinks: vi.fn(),
}))
const { listRentals } = vi.hoisted(() => ({ listRentals: vi.fn() }))
const { activeAdministration } = vi.hoisted(() => ({
  activeAdministration: { current: null as ActiveAdministrationState | null },
}))

vi.mock('@/features/administration/application/useActiveAdministration', () => ({
  useActiveAdministration: () => activeAdministration.current,
}))

vi.mock('../infrastructure/supabase-property.repository', () => ({
  supabasePropertyRepository: { listByAdministration: listPropertiesByAdministration },
}))

vi.mock('@/features/parking/infrastructure/supabase-parking.repository', () => ({
  supabaseParkingRepository: { listByAdministration: listParkingsByAdministration, create: vi.fn() },
}))

vi.mock('../infrastructure/supabase-room.repository', () => ({
  supabaseRoomRepository: {
    listByAdministration: listRooms,
    listByProperty: vi.fn(),
    createForProperty: vi.fn(),
  },
}))

vi.mock('@/features/rentals/infrastructure/supabase-rental-subject.repository', () => ({
  supabaseRentalSubjectRepository: {
    listByAdministration: listRentalSubjects,
    listRelationshipLinksByAdministration: listSubjectLinks,
  },
}))

vi.mock('@/features/rentals/infrastructure/supabase-rental.repository', () => ({
  supabaseRentalRepository: {
    listByAdministration: listRentals,
    createDraft: vi.fn(),
    activate: vi.fn(),
  },
}))

const BOGOTA_PROPERTY = {
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
}

const MEDELLIN_PROPERTY = {
  id: 'prop-2',
  administrationId: 'admin-2',
  propertyType: 'HOUSE',
  rentalMode: 'FULL_PROPERTY',
  name: 'Casa 14',
  countryCode: 'CO',
  city: 'Medellín',
  address: 'Carrera 9 # 10-11',
  hasAdministration: false,
  administrationFee: null,
}

function resolvedTo(id: string): ActiveAdministrationState {
  return { status: 'resolved', administration: { id, name: `Administración ${id}`, status: 'ACTIVE' } }
}

/** Re-renders PropertiesPage after swapping which administration the mocked
 * hook resolves to - the only way to drive that transition today. */
function Harness() {
  const [, forceRender] = useState(0)

  return (
    <>
      <button
        type="button"
        onClick={() => {
          activeAdministration.current = resolvedTo('admin-2')
          forceRender((value) => value + 1)
        }}
      >
        Cambiar administración
      </button>
      <PropertiesPage />
    </>
  )
}

function renderHarness() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={['/properties']}>
        <Routes>
          <Route path="/properties" element={<Harness />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PropertiesPage - search/filters reset on administration change', () => {
  beforeEach(() => {
    window.localStorage.clear()
    activeAdministration.current = resolvedTo('admin-1')
    listRooms.mockResolvedValue([])
    listRentalSubjects.mockResolvedValue([])
    listSubjectLinks.mockResolvedValue([])
    listRentals.mockResolvedValue([])
    listParkingsByAdministration.mockResolvedValue([])
    listPropertiesByAdministration.mockImplementation((administrationId: string) =>
      Promise.resolve(administrationId === 'admin-1' ? [BOGOTA_PROPERTY] : [MEDELLIN_PROPERTY]),
    )
  })

  afterEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it('clears the city filter and the search term, so the new administration is never hidden by them', async () => {
    const user = userEvent.setup()
    renderHarness()

    await user.selectOptions(await screen.findByLabelText('Ciudad'), 'Bogotá')
    await user.type(screen.getByLabelText('Buscar inmuebles'), 'apartamento')
    expect(within(screen.getByTestId('properties-compact-list')).getByText('Apartamento 302')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cambiar administración' }))

    // "Bogotá" + "apartamento" would both exclude Casa 14 if they survived.
    expect(
      within(await screen.findByTestId('properties-compact-list')).getByText('Casa 14'),
    ).toBeInTheDocument()
    expect(await screen.findByLabelText('Buscar inmuebles')).toHaveValue('')
    expect(screen.getByLabelText('Ciudad')).toHaveValue('')
    expect(listPropertiesByAdministration).toHaveBeenCalledWith('admin-2')
  })

  it('clears the Parqueaderos search term too', async () => {
    listParkingsByAdministration.mockResolvedValue([
      {
        id: 'parking-1',
        administrationId: 'admin-1',
        propertyId: null,
        identifier: 'Parqueadero 12',
        location: null,
        covered: null,
        allowedVehicleType: null,
      },
    ])
    const user = userEvent.setup()
    renderHarness()

    await user.type(await screen.findByLabelText('Buscar parqueaderos'), 'xyz-no-match')
    expect(screen.queryByTestId('parking-list')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cambiar administración' }))

    expect(await screen.findByLabelText('Buscar parqueaderos')).toHaveValue('')
    expect(await screen.findByTestId('parking-list')).toBeInTheDocument()
  })
})

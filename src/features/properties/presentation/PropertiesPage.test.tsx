import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import PropertiesPage from './PropertiesPage'

const { listAccessibleAdministrations } = vi.hoisted(() => ({
  listAccessibleAdministrations: vi.fn(),
}))
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

vi.mock('@/features/administration/infrastructure/supabase-administration.repository', () => ({
  supabaseAdministrationRepository: { listAccessibleAdministrations },
}))

vi.mock('../infrastructure/supabase-property.repository', () => ({
  supabasePropertyRepository: { listByAdministration: listPropertiesByAdministration },
}))

vi.mock('@/features/parking/infrastructure/supabase-parking.repository', () => ({
  supabaseParkingRepository: { listByAdministration: listParkingsByAdministration, create: vi.fn() },
}))

// usePropertyOccupancy's own cross-referenced reads - see its doc comment.
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

const PROPERTY_1 = {
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

const PARKING_1 = {
  id: 'parking-1',
  administrationId: 'admin-1',
  propertyId: null,
  identifier: 'Parqueadero 12',
  location: null,
  covered: null,
  allowedVehicleType: null,
}

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

function resolveOneAdministration() {
  listAccessibleAdministrations.mockResolvedValueOnce([
    { id: 'admin-1', name: 'Administración Uno', status: 'ACTIVE' },
  ])
}

describe('PropertiesPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    // Defaults for usePropertyOccupancy's own cross-referenced reads - most
    // tests don't care about occupancy, only the ones that assert on the
    // badge override these (same beforeEach-defaults convention as
    // DashboardPage.test.tsx).
    listRooms.mockResolvedValue([])
    listRentalSubjects.mockResolvedValue([])
    listSubjectLinks.mockResolvedValue([])
    listRentals.mockResolvedValue([])
  })

  afterEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

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

  it('shows an explicit state (not an empty list) when the account has no administrations', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([])
    renderPage()

    expect(await screen.findByText('Todavía no tienes una administración')).toBeInTheDocument()
    expect(listPropertiesByAdministration).not.toHaveBeenCalled()
    expect(listParkingsByAdministration).not.toHaveBeenCalled()
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
    expect(listPropertiesByAdministration).not.toHaveBeenCalled()
    expect(listParkingsByAdministration).not.toHaveBeenCalled()
  })

  it('selecting an administration from the picker resolves the page to that administration', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([
      { id: 'admin-1', name: 'Administración Uno', status: 'ACTIVE' },
      { id: 'admin-2', name: 'Administración Dos', status: 'ACTIVE' },
    ])
    listPropertiesByAdministration.mockResolvedValueOnce([PROPERTY_1])
    listParkingsByAdministration.mockResolvedValueOnce([])
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('radio', { name: 'Administración Dos, Activa' }))

    expect(await screen.findByText('Apartamento 302')).toBeInTheDocument()
    expect(listPropertiesByAdministration).toHaveBeenCalledWith('admin-2')
  })

  it('shows both section headers once resolved', async () => {
    resolveOneAdministration()
    listPropertiesByAdministration.mockResolvedValueOnce([])
    listParkingsByAdministration.mockResolvedValueOnce([])
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Propiedades' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Parqueaderos' })).toBeInTheDocument()
  })

  it('shows the real properties once the administration and properties both resolve', async () => {
    resolveOneAdministration()
    listPropertiesByAdministration.mockResolvedValueOnce([PROPERTY_1])
    listParkingsByAdministration.mockResolvedValueOnce([])
    renderPage()

    expect(screen.getByTestId('properties-loading')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Apartamento 302')).toBeInTheDocument()
    })
    expect(screen.getByText('Bogotá')).toBeInTheDocument()
    expect(screen.getByText('Calle 1 # 2-3')).toBeInTheDocument()
    expect(screen.getByText('Apartamento')).toBeInTheDocument()
    expect(screen.getByText('Inmueble completo')).toBeInTheDocument()
    expect(listPropertiesByAdministration).toHaveBeenCalledWith('admin-1')

    // Occupancy is now the same real, shared cross-reference the Dashboard's
    // PropertyCard uses (see usePropertyOccupancy's own doc comment) - with
    // no matching rental_subject in this scenario, the honest status is
    // "Disponible".
    expect(await screen.findByText('Disponible')).toBeInTheDocument()
  })

  it('shows "Arrendado" for a property tied to an occupied rental subject, the same real occupancy cross-reference the Dashboard uses', async () => {
    resolveOneAdministration()
    listPropertiesByAdministration.mockResolvedValueOnce([PROPERTY_1])
    listParkingsByAdministration.mockResolvedValueOnce([])
    listRentalSubjects.mockImplementation((_administrationId: string, subjectType: 'FULL_PROPERTY' | 'ROOM') =>
      Promise.resolve(
        subjectType === 'FULL_PROPERTY'
          ? [
              {
                id: 'subject-1',
                administrationId: 'admin-1',
                subjectType: 'FULL_PROPERTY',
                propertyId: 'prop-1',
                roomId: null,
                parkingId: null,
                label: 'Apartamento 302',
              },
            ]
          : [],
      ),
    )
    listSubjectLinks.mockResolvedValueOnce([
      { rentalRelationshipId: 'rel-1', rentalSubjectId: 'subject-1', subjectRole: 'PRIMARY' },
    ])
    listRentals.mockResolvedValueOnce([
      {
        id: 'rel-1',
        administrationId: 'admin-1',
        status: 'ACTIVE',
        jurisdictionCountry: 'CO',
        realStartDate: '2026-01-01',
        trackingStartDate: '2026-01-01',
        expectedEndDate: null,
        actualEndDate: null,
        paymentDay: 5,
        paymentTiming: 'ADVANCE',
      },
    ])
    renderPage()

    expect(await screen.findByText('Arrendado')).toBeInTheDocument()
  })

  it('shows the empty state when the administration has no properties', async () => {
    resolveOneAdministration()
    listPropertiesByAdministration.mockResolvedValueOnce([])
    listParkingsByAdministration.mockResolvedValueOnce([])
    renderPage()

    expect(await screen.findByText('Todavía no tienes inmuebles')).toBeInTheDocument()
  })

  it('shows an error state when fetching properties fails', async () => {
    resolveOneAdministration()
    listPropertiesByAdministration.mockRejectedValueOnce(new Error('boom'))
    listParkingsByAdministration.mockResolvedValueOnce([])
    renderPage()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('navigates to /properties/new when "Agregar inmueble" is clicked', async () => {
    resolveOneAdministration()
    listPropertiesByAdministration.mockResolvedValueOnce([])
    listParkingsByAdministration.mockResolvedValueOnce([])
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

  describe('Parqueaderos section - independent from Propiedades', () => {
    it('shows Properties data while Parking is still loading', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([PROPERTY_1])
      listParkingsByAdministration.mockReturnValueOnce(new Promise(() => {}))
      renderPage()

      expect(await screen.findByText('Apartamento 302')).toBeInTheDocument()
      expect(screen.getByTestId('parkings-loading')).toBeInTheDocument()
    })

    it('shows Parking data while Properties is still loading', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockReturnValueOnce(new Promise(() => {}))
      listParkingsByAdministration.mockResolvedValueOnce([PARKING_1])
      renderPage()

      expect(await screen.findByText('Parqueadero 12')).toBeInTheDocument()
      expect(screen.getByTestId('properties-loading')).toBeInTheDocument()
    })

    it('shows a localized error only in Propiedades while Parqueaderos shows real data', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockRejectedValueOnce(new Error('boom'))
      listParkingsByAdministration.mockResolvedValueOnce([PARKING_1])
      renderPage()

      expect(await screen.findByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Parqueadero 12')).toBeInTheDocument()
    })

    it('shows Properties data while Parqueaderos shows its own localized error', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([PROPERTY_1])
      listParkingsByAdministration.mockRejectedValueOnce(new Error('boom'))
      renderPage()

      expect(await screen.findByText('Apartamento 302')).toBeInTheDocument()
      expect(
        await screen.findByText('No pudimos cargar tus parqueaderos. Intenta de nuevo.'),
      ).toBeInTheDocument()
    })

    it('shows both empty states when there is no data in either section', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([])
      listParkingsByAdministration.mockResolvedValueOnce([])
      renderPage()

      expect(await screen.findByText('Todavía no tienes inmuebles')).toBeInTheDocument()
      expect(screen.getByText('Aún no tienes parqueaderos')).toBeInTheDocument()
    })

    it('renders an independent parking without an association line', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([])
      listParkingsByAdministration.mockResolvedValueOnce([PARKING_1])
      renderPage()

      expect(await screen.findByText('Parqueadero 12')).toBeInTheDocument()
      expect(screen.queryByText(/Asociado a/)).not.toBeInTheDocument()
    })

    it('resolves the associated Property name from the already-loaded Properties list, without an extra query', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([PROPERTY_1])
      listParkingsByAdministration.mockResolvedValueOnce([{ ...PARKING_1, propertyId: 'prop-1' }])
      renderPage()

      expect(await screen.findByText('Asociado a Apartamento 302')).toBeInTheDocument()
      expect(listPropertiesByAdministration).toHaveBeenCalledTimes(1)
    })

    it('omits the association line when Properties failed to load', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockRejectedValueOnce(new Error('boom'))
      listParkingsByAdministration.mockResolvedValueOnce([{ ...PARKING_1, propertyId: 'prop-1' }])
      renderPage()

      expect(await screen.findByText('Parqueadero 12')).toBeInTheDocument()
      expect(screen.queryByText(/Asociado a/)).not.toBeInTheDocument()
      expect(screen.queryByText('prop-1')).not.toBeInTheDocument()
    })

    it('omits the association line when the referenced property is not in the resolved list', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([])
      listParkingsByAdministration.mockResolvedValueOnce([{ ...PARKING_1, propertyId: 'prop-missing' }])
      renderPage()

      expect(await screen.findByText('Parqueadero 12')).toBeInTheDocument()
      expect(screen.queryByText(/Asociado a/)).not.toBeInTheDocument()
    })
  })
})

import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
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

const PROPERTY_2 = {
  id: 'prop-2',
  administrationId: 'admin-1',
  propertyType: 'HOUSE',
  rentalMode: 'FULL_PROPERTY',
  name: 'Casa 14',
  countryCode: 'CO',
  city: 'Medellín',
  address: 'Carrera 9 # 10-11',
  hasAdministration: false,
  administrationFee: null,
}

/** APARTMENT + BY_ROOMS in a city PROPERTY_2 shares - so Ciudad, Tipo and
 * the text search each isolate a *different* subset, and combining two of
 * them is provably narrower than either alone. */
const PROPERTY_3 = {
  id: 'prop-3',
  administrationId: 'admin-1',
  propertyType: 'APARTMENT',
  rentalMode: 'BY_ROOMS',
  name: 'Apartamento 501',
  countryCode: 'CO',
  city: 'Medellín',
  address: 'Calle 85 # 12-18',
  hasAdministration: true,
  administrationFee: 220000,
}

function makeRoom(overrides: Record<string, unknown> = {}) {
  return {
    id: 'room-1',
    administrationId: 'admin-1',
    propertyId: 'prop-1',
    name: 'Habitación 1',
    bathroomType: null,
    furnished: false,
    description: null,
    isEnabled: true,
    ...overrides,
  }
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

const PARKING_2 = {
  id: 'parking-2',
  administrationId: 'admin-1',
  propertyId: null,
  identifier: 'P-07',
  location: 'Sótano 2',
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

/** Properties now render twice (the desktop table and the mobile/tablet
 * compact list - CSS, not JS, picks one per breakpoint; see
 * PropertiesPage.module.css). Assertions about a specific property's
 * content scope to this one canonical rendering instead of the bare
 * `screen`, which would otherwise find two matches. Parking is unaffected -
 * it only ever renders once (a single compact-row pattern at every width). */
function compactProperties() {
  return within(screen.getByTestId('properties-compact-list'))
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
    expect(screen.getByRole('button', { name: 'Administración Uno, Activa' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Administración Dos, Activa' })).toBeInTheDocument()
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

    await user.click(await screen.findByRole('button', { name: 'Administración Dos, Activa' }))

    expect(await screen.findByTestId('properties-compact-list')).toBeInTheDocument()
    expect(compactProperties().getByText('Apartamento 302')).toBeInTheDocument()
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
      expect(screen.getByTestId('properties-compact-list')).toBeInTheDocument()
    })
    const list = compactProperties()
    expect(list.getByText('Apartamento 302')).toBeInTheDocument()
    expect(list.getByText('Bogotá')).toBeInTheDocument()
    expect(list.getByText('Calle 1 # 2-3')).toBeInTheDocument()
    expect(list.getByText('Apartamento')).toBeInTheDocument()
    expect(list.getByText('Inmueble completo')).toBeInTheDocument()
    expect(listPropertiesByAdministration).toHaveBeenCalledWith('admin-1')

    // Occupancy is now the same real, shared cross-reference the Dashboard's
    // PropertyCard uses (see usePropertyOccupancy's own doc comment) - with
    // no matching rental_subject in this scenario, the honest status is
    // "Disponible".
    expect(await within(await screen.findByTestId('properties-compact-list')).findByText('Disponible')).toBeInTheDocument()
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

    expect(await within(await screen.findByTestId('properties-compact-list')).findByText('Arrendado')).toBeInTheDocument()
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

      expect(await screen.findByTestId('properties-compact-list')).toBeInTheDocument()
      expect(compactProperties().getByText('Apartamento 302')).toBeInTheDocument()
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

      expect(await screen.findByTestId('properties-compact-list')).toBeInTheDocument()
      expect(compactProperties().getByText('Apartamento 302')).toBeInTheDocument()
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

  describe('local search - filters already-loaded data, no new query', () => {
    it('does not show a search box for a section with no data', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([])
      listParkingsByAdministration.mockResolvedValueOnce([])
      renderPage()

      expect(await screen.findByText('Todavía no tienes inmuebles')).toBeInTheDocument()
      expect(screen.queryByLabelText('Buscar inmuebles')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Buscar parqueaderos')).not.toBeInTheDocument()
    })

    it('filters Propiedades by name, address or city, independently of Parqueaderos', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([PROPERTY_1, PROPERTY_2])
      listParkingsByAdministration.mockResolvedValueOnce([PARKING_1])
      const user = userEvent.setup()
      renderPage()

      await screen.findByTestId('properties-compact-list')
      expect(compactProperties().getByText('Casa 14')).toBeInTheDocument()
      await user.type(screen.getByLabelText('Buscar inmuebles'), 'medellin')

      const list = compactProperties()
      expect(list.getByText('Casa 14')).toBeInTheDocument()
      expect(list.queryByText('Apartamento 302')).not.toBeInTheDocument()
      // Diacritic-insensitive: "medellin" (typed) still matches "Medellín".
      expect(screen.getByText('Parqueadero 12')).toBeInTheDocument()
    })

    it('filters Parqueaderos by identifier or location, independently of Propiedades', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([PROPERTY_1])
      listParkingsByAdministration.mockResolvedValueOnce([PARKING_1, PARKING_2])
      const user = userEvent.setup()
      renderPage()

      expect(await screen.findByText('P-07')).toBeInTheDocument()
      await user.type(screen.getByLabelText('Buscar parqueaderos'), 'sótano')

      expect(screen.getByText('P-07')).toBeInTheDocument()
      expect(screen.queryByText('Parqueadero 12')).not.toBeInTheDocument()
      expect(compactProperties().getByText('Apartamento 302')).toBeInTheDocument()
    })

    it('shows a "no results" empty state (distinct from the "no data" one) when the search matches nothing', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([PROPERTY_1, PROPERTY_2])
      listParkingsByAdministration.mockResolvedValueOnce([])
      const user = userEvent.setup()
      renderPage()

      await user.type(await screen.findByLabelText('Buscar inmuebles'), 'xyz-no-match')

      expect(await screen.findByText('Sin resultados para "xyz-no-match"')).toBeInTheDocument()
      expect(screen.queryByText('Todavía no tienes inmuebles')).not.toBeInTheDocument()
    })

    it('clearing the search restores the full list', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([PROPERTY_1, PROPERTY_2])
      listParkingsByAdministration.mockResolvedValueOnce([])
      const user = userEvent.setup()
      renderPage()

      const search = await screen.findByLabelText('Buscar inmuebles')
      await user.type(search, 'casa')
      expect(compactProperties().queryByText('Apartamento 302')).not.toBeInTheDocument()

      await user.clear(search)
      const list = compactProperties()
      expect(list.getByText('Apartamento 302')).toBeInTheDocument()
      expect(list.getByText('Casa 14')).toBeInTheDocument()
    })
  })

  describe('responsive presentation - desktop table / compact list (Figma 353:2, docs/DESIGN.md §15)', () => {
    it('renders exactly the five approved columns, in order, and nothing else', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([PROPERTY_1])
      listParkingsByAdministration.mockResolvedValueOnce([])
      renderPage()

      // jsdom doesn't compute the implicit table/columnheader ARIA roles
      // here (it never applies the UA default `table { display: table }`,
      // and the WAI-ARIA algorithm suppresses those roles without it) - a
      // real browser does, see e2e/properties-preview.spec.ts for the
      // role-based assertion against this exact markup. Text/DOM queries
      // below don't depend on that and still verify the real headers.
      const wrap = await screen.findByTestId('properties-table')
      const headers = Array.from(wrap.querySelectorAll('thead th')).map((th) => th.textContent)
      expect(headers).toEqual(['Inmueble', 'Dirección', 'Tipo', 'Unidades', 'Ocupación'])

      const table = within(wrap)
      expect(table.getByText('Apartamento 302')).toBeInTheDocument()
      expect(table.getByText('Calle 1 # 2-3')).toBeInTheDocument()
      expect(table.getByText('Bogotá')).toBeInTheDocument()
      expect(table.getByText('Disponible')).toBeInTheDocument()
      // Modalidad is secondary metadata inside the Inmueble cell now, not
      // its own column; "Estado" as a column header is gone entirely.
      expect(table.getByText('Inmueble completo')).toBeInTheDocument()
      expect(headers).not.toContain('Modalidad')
      expect(headers).not.toContain('Estado')

      // The compact list has the exact same property, just in the other
      // presentation - both always render, CSS picks one per breakpoint.
      expect(compactProperties().getByText('Apartamento 302')).toBeInTheDocument()
    })

    it('shows Unidades 1 and Ocupación 0/1 for an unoccupied FULL_PROPERTY', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([PROPERTY_1])
      listParkingsByAdministration.mockResolvedValueOnce([])
      renderPage()

      const table = within(await screen.findByTestId('properties-table'))
      expect(await table.findByText('0/1')).toBeInTheDocument()
      const cells = Array.from(
        (await screen.findByTestId('properties-table')).querySelectorAll('tbody td'),
      ).map((td) => td.textContent)
      // Unidades (4th column) is a flat "1" for a whole-property rental.
      expect(cells[3]).toBe('1')
    })

    it('shows Unidades/Ocupación from the real enabled-room counts for a BY_ROOMS property', async () => {
      resolveOneAdministration()
      const byRooms = { ...PROPERTY_1, rentalMode: 'BY_ROOMS' as const }
      listPropertiesByAdministration.mockResolvedValueOnce([byRooms])
      listParkingsByAdministration.mockResolvedValueOnce([])
      listRooms.mockResolvedValue([
        makeRoom({ id: 'room-1', name: 'Habitación 1' }),
        makeRoom({ id: 'room-2', name: 'Habitación 2' }),
        // Disabled rooms are not rentable units, so they never count.
        makeRoom({ id: 'room-3', name: 'Habitación 3', isEnabled: false }),
      ])
      renderPage()

      const wrap = await screen.findByTestId('properties-table')
      const table = within(wrap)
      expect(await table.findByText('0/2')).toBeInTheDocument()
      const cells = Array.from(wrap.querySelectorAll('tbody td')).map((td) => td.textContent)
      expect(cells[3]).toBe('2')
      // Modalidad still shows as the Inmueble cell's secondary metadata.
      expect(table.getByText('Por habitaciones')).toBeInTheDocument()
    })

    it('shows an em dash (not an invented 0) in Unidades while the occupancy signal is not ready', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([PROPERTY_1])
      listParkingsByAdministration.mockResolvedValueOnce([])
      // One of usePropertyOccupancy's cross-referenced reads never settles,
      // so its status stays 'loading' - the honest render is "no data yet".
      listRooms.mockReturnValue(new Promise(() => {}))
      renderPage()

      const wrap = await screen.findByTestId('properties-table')
      const table = within(wrap)
      expect(table.getByLabelText('Sin datos')).toHaveTextContent('—')
      expect(table.getByText('Sin datos')).toBeInTheDocument()
      // Never a fabricated fraction while the signal is unknown.
      expect(table.queryByText('0/1')).not.toBeInTheDocument()
      expect(table.queryByText('1/1')).not.toBeInTheDocument()
      // And the compact card simply omits its units/occupancy caption.
      expect(compactProperties().queryByText(/unidades ocupadas/)).not.toBeInTheDocument()
    })

    it('shows the units/occupancy caption in the compact card once the signal is known', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([PROPERTY_1])
      listParkingsByAdministration.mockResolvedValueOnce([])
      renderPage()

      expect(
        await within(await screen.findByTestId('properties-compact-list')).findByText('0 de 1 unidades ocupadas'),
      ).toBeInTheDocument()
    })

    it('renders Parqueaderos as one bordered list of compact rows, not a card grid', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([])
      listParkingsByAdministration.mockResolvedValueOnce([PARKING_1, PARKING_2])
      renderPage()

      const list = within(await screen.findByTestId('parking-list'))
      expect(list.getByText('Parqueadero 12')).toBeInTheDocument()
      expect(list.getByText('P-07')).toBeInTheDocument()
    })
  })

  describe('accessible search announcements (role="status", no focus movement)', () => {
    it('announces the Propiedades result count without moving focus away from the search input', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([PROPERTY_1, PROPERTY_2])
      listParkingsByAdministration.mockResolvedValueOnce([])
      const user = userEvent.setup()
      renderPage()

      const search = await screen.findByLabelText('Buscar inmuebles')
      // The live region is already mounted and empty - nothing to report
      // yet, but the node itself exists from the start (see
      // SearchResultsStatus's own doc comment for why it never mounts late).
      expect(screen.getByRole('status')).toHaveTextContent('')

      await user.type(search, 'casa')

      expect(await screen.findByRole('status')).toHaveTextContent('Se encontró 1 resultado.')
      expect(search).toHaveFocus()
    })

    it('announces "no matches" via the same live region when Propiedades search finds nothing', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([PROPERTY_1, PROPERTY_2])
      listParkingsByAdministration.mockResolvedValueOnce([])
      const user = userEvent.setup()
      renderPage()

      const search = await screen.findByLabelText('Buscar inmuebles')
      await user.type(search, 'xyz-no-match')

      expect(await screen.findByRole('status')).toHaveTextContent('Intenta con otro nombre, dirección o ciudad.')
      expect(search).toHaveFocus()
    })

    it('announces the Parqueaderos result count independently, without moving focus', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([])
      listParkingsByAdministration.mockResolvedValueOnce([PARKING_1, PARKING_2])
      const user = userEvent.setup()
      renderPage()

      const search = await screen.findByLabelText('Buscar parqueaderos')
      await user.type(search, 'p-07')

      expect(await screen.findByRole('status')).toHaveTextContent('Se encontró 1 resultado.')
      expect(search).toHaveFocus()
    })

    it('keeps the very same live-region node across the first term, a later term and clearing - only its text changes', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([PROPERTY_1, PROPERTY_2])
      listParkingsByAdministration.mockResolvedValueOnce([])
      const user = userEvent.setup()
      renderPage()

      const search = await screen.findByLabelText('Buscar inmuebles')
      const region = screen.getByTestId('properties-search-status')
      expect(region).toHaveAttribute('role', 'status')
      expect(region).toHaveTextContent('')

      await user.type(search, 'casa')
      expect(region).toHaveTextContent('Se encontró 1 resultado.')
      expect(screen.getByTestId('properties-search-status')).toBe(region)

      await user.clear(search)
      await user.type(search, 'apartamento')
      expect(region).toHaveTextContent('Se encontró 1 resultado.')
      expect(screen.getByTestId('properties-search-status')).toBe(region)

      await user.clear(search)
      expect(region).toHaveTextContent('')
      expect(screen.getByTestId('properties-search-status')).toBe(region)
      expect(search).toHaveFocus()
    })

    it('keeps the Parqueaderos live-region node across its own term changes too', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([])
      listParkingsByAdministration.mockResolvedValueOnce([PARKING_1, PARKING_2])
      const user = userEvent.setup()
      renderPage()

      const search = await screen.findByLabelText('Buscar parqueaderos')
      const region = screen.getByTestId('parkings-search-status')
      expect(region).toHaveAttribute('role', 'status')
      expect(region).toHaveTextContent('')

      await user.type(search, 'p-07')
      expect(region).toHaveTextContent('Se encontró 1 resultado.')

      await user.clear(search)
      expect(region).toHaveTextContent('')
      expect(screen.getByTestId('parkings-search-status')).toBe(region)
      expect(search).toHaveFocus()
    })
  })

  describe('local filters - Ciudad, Tipo, Ocupación over already-loaded data (docs/DESIGN.md §15)', () => {
    function renderThreeProperties() {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([PROPERTY_1, PROPERTY_2, PROPERTY_3])
      listParkingsByAdministration.mockResolvedValueOnce([])
      return userEvent.setup()
    }

    it('offers only the cities actually present in the loaded list, plus "all"', async () => {
      renderThreeProperties()
      renderPage()

      const city = await screen.findByLabelText('Ciudad')
      expect(Array.from(city.querySelectorAll('option')).map((option) => option.textContent)).toEqual([
        'Todas las ciudades',
        'Bogotá',
        'Medellín',
      ])
    })

    it('filters by Ciudad without touching the text search', async () => {
      const user = renderThreeProperties()
      renderPage()

      await user.selectOptions(await screen.findByLabelText('Ciudad'), 'Bogotá')

      const list = compactProperties()
      expect(list.getByText('Apartamento 302')).toBeInTheDocument()
      expect(list.queryByText('Casa 14')).not.toBeInTheDocument()
      expect(list.queryByText('Apartamento 501')).not.toBeInTheDocument()
    })

    it('filters by Tipo', async () => {
      const user = renderThreeProperties()
      renderPage()

      await user.selectOptions(await screen.findByLabelText('Tipo'), 'HOUSE')

      const list = compactProperties()
      expect(list.getByText('Casa 14')).toBeInTheDocument()
      expect(list.queryByText('Apartamento 302')).not.toBeInTheDocument()
      expect(list.queryByText('Apartamento 501')).not.toBeInTheDocument()
    })

    it('combines Ciudad AND Tipo - narrower than either filter alone', async () => {
      const user = renderThreeProperties()
      renderPage()

      await user.selectOptions(await screen.findByLabelText('Ciudad'), 'Medellín')
      await user.selectOptions(screen.getByLabelText('Tipo'), 'APARTMENT')

      const list = compactProperties()
      // Medellín alone would also match Casa 14; APARTMENT alone would also
      // match Apartamento 302. Together, only Apartamento 501 survives.
      expect(list.getByText('Apartamento 501')).toBeInTheDocument()
      expect(list.queryByText('Casa 14')).not.toBeInTheDocument()
      expect(list.queryByText('Apartamento 302')).not.toBeInTheDocument()
    })

    it('combines the filters with the existing text search by AND', async () => {
      const user = renderThreeProperties()
      renderPage()

      await user.selectOptions(await screen.findByLabelText('Ciudad'), 'Medellín')
      await user.type(screen.getByLabelText('Buscar inmuebles'), 'casa')

      const list = compactProperties()
      expect(list.getByText('Casa 14')).toBeInTheDocument()
      expect(list.queryByText('Apartamento 501')).not.toBeInTheDocument()
    })

    it('filters by Ocupación using the same derived status the badge shows', async () => {
      const user = renderThreeProperties()
      renderPage()

      // Nothing is rented in this scenario (no rental subjects mocked), so
      // "Disponible" keeps all three and "Arrendado" keeps none.
      await user.selectOptions(await screen.findByLabelText('Ocupación'), 'available')
      expect(compactProperties().getByText('Casa 14')).toBeInTheDocument()

      await user.selectOptions(screen.getByLabelText('Ocupación'), 'rented')
      expect(screen.queryByTestId('properties-compact-list')).not.toBeInTheDocument()
      expect(screen.getByText('Ningún inmueble coincide con los filtros')).toBeInTheDocument()
    })

    it('never classifies a not-ready occupancy signal as "Disponible" - "Sin datos" is its own real option', async () => {
      const user = renderThreeProperties()
      // Occupancy never settles, so every property derives to 'unknown'.
      listRooms.mockReturnValue(new Promise(() => {}))
      renderPage()

      const occupancy = await screen.findByLabelText('Ocupación')
      await user.selectOptions(occupancy, 'available')
      expect(screen.queryByTestId('properties-compact-list')).not.toBeInTheDocument()

      await user.selectOptions(occupancy, 'unknown')
      const list = compactProperties()
      expect(list.getByText('Apartamento 302')).toBeInTheDocument()
      expect(list.getByText('Casa 14')).toBeInTheDocument()
      expect(list.getByText('Apartamento 501')).toBeInTheDocument()
    })

    it('explains, on the Ocupación filter itself, that the signal is still pending', async () => {
      renderThreeProperties()
      listRooms.mockReturnValue(new Promise(() => {}))
      renderPage()

      expect(
        await screen.findByText('Mientras se calcula la ocupación, los inmuebles pueden aparecer como "Sin datos".'),
      ).toBeInTheDocument()
    })

    it('does not show that pending explanation once occupancy is ready', async () => {
      renderThreeProperties()
      renderPage()

      await screen.findByTestId('properties-compact-list')
      await waitFor(() => {
        expect(screen.queryByText(/Mientras se calcula la ocupación/)).not.toBeInTheDocument()
      })
    })

    it('restores the full list when every filter goes back to "all"', async () => {
      const user = renderThreeProperties()
      renderPage()

      await user.selectOptions(await screen.findByLabelText('Ciudad'), 'Bogotá')
      await user.selectOptions(screen.getByLabelText('Tipo'), 'APARTMENT')
      expect(compactProperties().queryByText('Casa 14')).not.toBeInTheDocument()

      await user.selectOptions(screen.getByLabelText('Ciudad'), 'all')
      await user.selectOptions(screen.getByLabelText('Tipo'), 'all')

      const list = compactProperties()
      expect(list.getByText('Apartamento 302')).toBeInTheDocument()
      expect(list.getByText('Casa 14')).toBeInTheDocument()
      expect(list.getByText('Apartamento 501')).toBeInTheDocument()
    })

    it('keeps the Parqueaderos section untouched while Propiedades filters are active', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([PROPERTY_1, PROPERTY_2])
      listParkingsByAdministration.mockResolvedValueOnce([PARKING_1, PARKING_2])
      const user = userEvent.setup()
      renderPage()

      await user.selectOptions(await screen.findByLabelText('Ciudad'), 'Bogotá')

      expect(screen.getByText('Parqueadero 12')).toBeInTheDocument()
      expect(screen.getByText('P-07')).toBeInTheDocument()
    })

    it('does not show the filters at all for a section with no data', async () => {
      resolveOneAdministration()
      listPropertiesByAdministration.mockResolvedValueOnce([])
      listParkingsByAdministration.mockResolvedValueOnce([])
      renderPage()

      expect(await screen.findByText('Todavía no tienes inmuebles')).toBeInTheDocument()
      expect(screen.queryByLabelText('Ciudad')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Tipo')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Ocupación')).not.toBeInTheDocument()
    })
  })
})

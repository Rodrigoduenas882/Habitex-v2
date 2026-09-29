import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import type { Property } from '@/features/properties/domain/property.types'
import { PropertiesOverview } from './PropertiesOverview'
import type { PropertyOccupancyMap } from './usePropertyOccupancy'

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'p1',
    administrationId: 'admin-1',
    propertyType: 'APARTMENT',
    rentalMode: 'FULL_PROPERTY',
    name: 'Apartamento 302',
    countryCode: 'CO',
    city: 'Bogotá',
    address: 'Calle 1 # 2-30',
    hasAdministration: false,
    administrationFee: null,
    ...overrides,
  }
}

const READY_EMPTY: PropertyOccupancyMap = { status: 'ready', byPropertyId: new Map() }

const property1 = makeProperty({ id: 'p1', name: 'Apartamento 302', city: 'Bogotá', address: 'Calle 1 # 2-30' })
const property2 = makeProperty({ id: 'p2', name: 'Casa 14', city: 'Medellín', address: 'Carrera 40 # 5-10' })
const properties: Property[] = [property1, property2]

/** jsdom never lays out real pixels, so scroll metrics stay 0 unless the
 * test asserts them explicitly - this simulates "the row has overflowing
 * content" at a given scroll position. */
function mockRowMetrics(
  row: HTMLElement,
  metrics: { scrollLeft: number; scrollWidth: number; clientWidth: number },
) {
  Object.defineProperty(row, 'scrollLeft', { value: metrics.scrollLeft, configurable: true })
  Object.defineProperty(row, 'scrollWidth', { value: metrics.scrollWidth, configurable: true })
  Object.defineProperty(row, 'clientWidth', { value: metrics.clientWidth, configurable: true })
}

describe('PropertiesOverview', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders each real property with its name/location/type detail', () => {
    render(<PropertiesOverview properties={properties} occupancy={READY_EMPTY} />)

    expect(screen.getByText('Apartamento 302')).toBeInTheDocument()
    expect(screen.getByText('Calle 1 # 2-30, Bogotá')).toBeInTheDocument()
    expect(screen.getByText('Casa 14')).toBeInTheDocument()
    expect(screen.getByText('Carrera 40 # 5-10, Medellín')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar inmueble' })).toBeInTheDocument()
  })

  it('shows "Arrendado" for a FULL_PROPERTY property tied to an occupied rental subject', () => {
    const occupancy: PropertyOccupancyMap = {
      status: 'ready',
      byPropertyId: new Map([['p1', { isOccupied: true, occupiedRooms: 0, totalRooms: 0 }]]),
    }
    render(<PropertiesOverview properties={[property1]} occupancy={occupancy} />)

    expect(screen.getByText('Arrendado')).toBeInTheDocument()
    expect(screen.getByText('Apartamento')).toBeInTheDocument()
  })

  it('shows "Disponible" for a FULL_PROPERTY property with no matching occupied subject', () => {
    render(<PropertiesOverview properties={[property1]} occupancy={READY_EMPTY} />)

    expect(screen.getByText('Disponible')).toBeInTheDocument()
  })

  it('shows the occupied/total room detail for a BY_ROOMS property', () => {
    const byRooms = makeProperty({ id: 'p3', name: 'Habitación 2', rentalMode: 'BY_ROOMS' })
    const occupancy: PropertyOccupancyMap = {
      status: 'ready',
      byPropertyId: new Map([['p3', { isOccupied: false, occupiedRooms: 1, totalRooms: 3 }]]),
    }
    render(<PropertiesOverview properties={[byRooms]} occupancy={occupancy} />)

    expect(screen.getByText('Arrendado')).toBeInTheDocument()
    expect(screen.getByText('1 de 3 habitaciones ocupadas')).toBeInTheDocument()
  })

  it('shows the honest "Sin datos" status instead of guessing while occupancy is still loading', () => {
    render(<PropertiesOverview properties={[property1]} occupancy={{ status: 'loading', byPropertyId: new Map() }} />)

    expect(screen.getByText('Sin datos')).toBeInTheDocument()
    expect(screen.queryByText('Arrendado')).not.toBeInTheDocument()
    expect(screen.queryByText('Disponible')).not.toBeInTheDocument()
  })

  it('sin overflow: shows no controls and reserves no side gutter', () => {
    render(<PropertiesOverview properties={properties} occupancy={READY_EMPTY} />)

    expect(
      screen.queryByRole('button', { name: 'Ver inmuebles anteriores' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver más inmuebles' })).not.toBeInTheDocument()
    expect(screen.getByTestId('properties-carousel').className).not.toMatch(/hasControls/)
  })

  it('inicio: shows only the "next" control, with the gutter reserved on both sides', () => {
    render(<PropertiesOverview properties={properties} occupancy={READY_EMPTY} />)
    const row = screen.getByTestId('properties-row')
    row.scrollBy = vi.fn()

    mockRowMetrics(row, { scrollLeft: 0, scrollWidth: 1000, clientWidth: 300 })
    fireEvent.scroll(row)

    expect(
      screen.queryByRole('button', { name: 'Ver inmuebles anteriores' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver más inmuebles' })).toBeInTheDocument()
    expect(screen.getByTestId('properties-carousel').className).toMatch(/hasControls/)
  })

  it('posición intermedia: shows both controls', () => {
    render(<PropertiesOverview properties={properties} occupancy={READY_EMPTY} />)
    const row = screen.getByTestId('properties-row')
    row.scrollBy = vi.fn()

    mockRowMetrics(row, { scrollLeft: 300, scrollWidth: 1000, clientWidth: 300 })
    fireEvent.scroll(row)

    expect(screen.getByRole('button', { name: 'Ver inmuebles anteriores' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver más inmuebles' })).toBeInTheDocument()
    expect(screen.getByTestId('properties-carousel').className).toMatch(/hasControls/)
  })

  it('final: shows only the "previous" control', () => {
    render(<PropertiesOverview properties={properties} occupancy={READY_EMPTY} />)
    const row = screen.getByTestId('properties-row')
    row.scrollBy = vi.fn()

    mockRowMetrics(row, { scrollLeft: 700, scrollWidth: 1000, clientWidth: 300 })
    fireEvent.scroll(row)

    expect(screen.getByRole('button', { name: 'Ver inmuebles anteriores' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver más inmuebles' })).not.toBeInTheDocument()
    expect(screen.getByTestId('properties-carousel').className).toMatch(/hasControls/)
  })

  it('updates which controls are visible as the row scrolls across start/middle/end', () => {
    render(<PropertiesOverview properties={properties} occupancy={READY_EMPTY} />)
    const row = screen.getByTestId('properties-row')
    row.scrollBy = vi.fn()

    mockRowMetrics(row, { scrollLeft: 0, scrollWidth: 1000, clientWidth: 300 })
    fireEvent.scroll(row)
    expect(
      screen.queryByRole('button', { name: 'Ver inmuebles anteriores' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver más inmuebles' })).toBeInTheDocument()

    mockRowMetrics(row, { scrollLeft: 300, scrollWidth: 1000, clientWidth: 300 })
    fireEvent.scroll(row)
    expect(screen.getByRole('button', { name: 'Ver inmuebles anteriores' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver más inmuebles' })).toBeInTheDocument()

    mockRowMetrics(row, { scrollLeft: 700, scrollWidth: 1000, clientWidth: 300 })
    fireEvent.scroll(row)
    expect(screen.getByRole('button', { name: 'Ver inmuebles anteriores' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver más inmuebles' })).not.toBeInTheDocument()
  })

  it('scrolls by about one card (the first card\'s measured width) when a control is clicked', () => {
    render(<PropertiesOverview properties={properties} occupancy={READY_EMPTY} />)
    const row = screen.getByTestId('properties-row')
    const scrollBySpy = vi.fn()
    row.scrollBy = scrollBySpy
    vi.spyOn(row.firstElementChild as Element, 'getBoundingClientRect').mockReturnValue({
      width: 240,
    } as DOMRect)

    mockRowMetrics(row, { scrollLeft: 300, scrollWidth: 1000, clientWidth: 300 })
    fireEvent.scroll(row)

    fireEvent.click(screen.getByRole('button', { name: 'Ver más inmuebles' }))
    expect(scrollBySpy).toHaveBeenLastCalledWith({ left: 240, behavior: 'smooth' })

    fireEvent.click(screen.getByRole('button', { name: 'Ver inmuebles anteriores' }))
    expect(scrollBySpy).toHaveBeenLastCalledWith({ left: -240, behavior: 'smooth' })
  })

  it('scrolls instantly instead of smoothly when the user prefers reduced motion', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('reduce'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    )

    render(<PropertiesOverview properties={properties} occupancy={READY_EMPTY} />)
    const row = screen.getByTestId('properties-row')
    const scrollBySpy = vi.fn()
    row.scrollBy = scrollBySpy
    vi.spyOn(row.firstElementChild as Element, 'getBoundingClientRect').mockReturnValue({
      width: 240,
    } as DOMRect)

    mockRowMetrics(row, { scrollLeft: 0, scrollWidth: 1000, clientWidth: 300 })
    fireEvent.scroll(row)

    fireEvent.click(screen.getByRole('button', { name: 'Ver más inmuebles' }))
    expect(scrollBySpy).toHaveBeenLastCalledWith({ left: 240, behavior: 'auto' })
  })
})

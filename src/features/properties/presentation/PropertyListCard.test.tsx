import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '@/infrastructure/i18n/i18n'
import type { Property } from '../domain/property.types'
import { PropertyListCard } from './PropertyListCard'

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'prop-1',
    administrationId: 'admin-1',
    propertyType: 'APARTMENT',
    rentalMode: 'FULL_PROPERTY',
    name: 'Apartamento 302',
    countryCode: 'CO',
    city: 'Bogotá',
    address: 'Calle 1 # 2-3',
    hasAdministration: false,
    administrationFee: null,
    ...overrides,
  }
}

describe('PropertyListCard', () => {
  it('shows "Arrendado" (success tone) for a property the caller marks as occupied', () => {
    render(<PropertyListCard property={makeProperty()} status="rented" unitsOccupancyLabel={null} />)

    expect(screen.getByText('Arrendado')).toBeInTheDocument()
  })

  it('shows "Disponible" for a property the caller marks as available', () => {
    render(<PropertyListCard property={makeProperty()} status="available" unitsOccupancyLabel={null} />)

    expect(screen.getByText('Disponible')).toBeInTheDocument()
    expect(screen.queryByText('Arrendado')).not.toBeInTheDocument()
  })

  it('shows the honest "Sin datos" status instead of guessing while occupancy is unknown', () => {
    render(<PropertyListCard property={makeProperty()} status="unknown" unitsOccupancyLabel={null} />)

    expect(screen.getByText('Sin datos')).toBeInTheDocument()
  })

  it('shows the units/occupancy caption when known, for FULL_PROPERTY too (not just BY_ROOMS)', () => {
    render(<PropertyListCard property={makeProperty()} status="rented" unitsOccupancyLabel="1 de 1 unidades ocupadas" />)

    expect(screen.getByText('1 de 1 unidades ocupadas')).toBeInTheDocument()
  })

  it('shows the units/occupancy caption for a BY_ROOMS property', () => {
    const byRooms = makeProperty({ rentalMode: 'BY_ROOMS' })
    render(<PropertyListCard property={byRooms} status="rented" unitsOccupancyLabel="1 de 3 unidades ocupadas" />)

    expect(screen.getByText('1 de 3 unidades ocupadas')).toBeInTheDocument()
  })

  it('omits the units/occupancy caption entirely while it is not known yet, instead of guessing', () => {
    render(<PropertyListCard property={makeProperty()} status="unknown" unitsOccupancyLabel={null} />)

    expect(screen.queryByText(/unidades ocupadas/)).not.toBeInTheDocument()
  })

  it('always shows the modalidad (rentalMode) badge, independently of whether units/occupancy is known', () => {
    render(<PropertyListCard property={makeProperty()} status="unknown" unitsOccupancyLabel={null} />)

    expect(screen.getByText('Inmueble completo')).toBeInTheDocument()
  })
})

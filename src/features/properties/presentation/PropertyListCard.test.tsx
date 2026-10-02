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
    render(<PropertyListCard property={makeProperty()} status="rented" detail="Apartamento" />)

    expect(screen.getByText('Arrendado')).toBeInTheDocument()
  })

  it('shows "Disponible" for a property the caller marks as available', () => {
    render(<PropertyListCard property={makeProperty()} status="available" detail="Apartamento" />)

    expect(screen.getByText('Disponible')).toBeInTheDocument()
    expect(screen.queryByText('Arrendado')).not.toBeInTheDocument()
  })

  it('shows the honest "Sin datos" status instead of guessing while occupancy is unknown', () => {
    render(<PropertyListCard property={makeProperty()} status="unknown" detail="Apartamento" />)

    expect(screen.getByText('Sin datos')).toBeInTheDocument()
  })

  it('shows the occupied/total room detail for a BY_ROOMS property, without duplicating it for FULL_PROPERTY', () => {
    const byRooms = makeProperty({ rentalMode: 'BY_ROOMS' })
    render(<PropertyListCard property={byRooms} status="rented" detail="1 de 3 habitaciones ocupadas" />)

    expect(screen.getByText('1 de 3 habitaciones ocupadas')).toBeInTheDocument()
  })

  it('does not render the detail line for a FULL_PROPERTY property - it would just repeat the propertyType badge', () => {
    render(<PropertyListCard property={makeProperty()} status="available" detail="Apartamento" />)

    // "Apartamento" still renders exactly once, via the propertyType badge.
    expect(screen.getAllByText('Apartamento')).toHaveLength(1)
  })
})

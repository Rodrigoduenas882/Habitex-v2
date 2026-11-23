import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import '@/infrastructure/i18n/i18n'
import type { Property } from '@/features/properties/domain/property.types'
import { DashboardHasPropertiesState } from './DashboardHasPropertiesState'

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'prop-1',
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

function renderState(name: string | null, properties: Property[]) {
  return render(<DashboardHasPropertiesState name={name} properties={properties} />, { wrapper: MemoryRouter })
}

describe('DashboardHasPropertiesState', () => {
  it('renders the real property list with its own name/location, not the prototype fixtures', () => {
    renderState('Rodrigo', [makeProperty()])

    expect(screen.getByText('Apartamento 302')).toBeInTheDocument()
    expect(screen.getByText('Calle 1 # 2-30')).toBeInTheDocument()
    expect(screen.queryByText('Apartamento Laureles 204')).not.toBeInTheDocument()
  })

  it('derives the rentalMode summary line from the real properties, not a hardcoded count', () => {
    renderState('Rodrigo', [
      makeProperty({ id: 'p1', rentalMode: 'FULL_PROPERTY' }),
      makeProperty({ id: 'p2', rentalMode: 'FULL_PROPERTY' }),
      makeProperty({ id: 'p3', rentalMode: 'BY_ROOMS' }),
    ])

    expect(screen.getByText('2 inmuebles completos · 1 por habitaciones')).toBeInTheDocument()
  })

  it('omits the summary line entirely when there are zero properties of a given rentalMode, never showing "0 ..."', () => {
    renderState('Rodrigo', [makeProperty({ id: 'p1', rentalMode: 'FULL_PROPERTY' })])

    expect(screen.queryByText(/0 por habitaciones/)).not.toBeInTheDocument()
  })

  it('marks every property card as available, since this state only renders when zero rentals exist', () => {
    renderState('Rodrigo', [makeProperty()])

    expect(screen.getByText('Disponible')).toBeInTheDocument()
  })

  it('renders a real link to /rentals/new for the primary CTA, not a no-op button', () => {
    renderState('Rodrigo', [makeProperty()])

    const cta = screen.getByRole('link', { name: 'Registrar arriendo' })
    expect(cta).toHaveAttribute('href', '/rentals/new')
  })
})

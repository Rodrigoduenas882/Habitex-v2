import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { ParkingListCard } from './ParkingListCard'

const PARKING = {
  id: 'parking-1',
  administrationId: 'admin-1',
  propertyId: null,
  identifier: 'Parqueadero 12',
  location: null,
  covered: null,
  allowedVehicleType: null,
}

describe('ParkingListCard', () => {
  it('shows the identifier', () => {
    render(<ParkingListCard parking={PARKING} associatedPropertyName={null} />)

    expect(screen.getByText('Parqueadero 12')).toBeInTheDocument()
  })

  it('shows the location only when it exists', () => {
    const { rerender } = render(<ParkingListCard parking={PARKING} associatedPropertyName={null} />)
    expect(screen.queryByText('Sótano 1')).not.toBeInTheDocument()

    rerender(<ParkingListCard parking={{ ...PARKING, location: 'Sótano 1' }} associatedPropertyName={null} />)
    expect(screen.getByText('Sótano 1')).toBeInTheDocument()
  })

  it('shows human vehicle type labels, never the technical enum', () => {
    render(<ParkingListCard parking={{ ...PARKING, allowedVehicleType: 'CAR' }} associatedPropertyName={null} />)
    expect(screen.getByText('Carro')).toBeInTheDocument()
    expect(screen.queryByText('CAR')).not.toBeInTheDocument()
  })

  it('shows "Cubierto" when covered is true', () => {
    render(<ParkingListCard parking={{ ...PARKING, covered: true }} associatedPropertyName={null} />)
    expect(screen.getByText('Cubierto')).toBeInTheDocument()
  })

  it('shows "Descubierto" when covered is false', () => {
    render(<ParkingListCard parking={{ ...PARKING, covered: false }} associatedPropertyName={null} />)
    expect(screen.getByText('Descubierto')).toBeInTheDocument()
  })

  it('omits the covered badge entirely when covered is null', () => {
    render(<ParkingListCard parking={{ ...PARKING, covered: null }} associatedPropertyName={null} />)
    expect(screen.queryByText('Cubierto')).not.toBeInTheDocument()
    expect(screen.queryByText('Descubierto')).not.toBeInTheDocument()
  })

  it('shows the association line only when a property name is resolved', () => {
    const { rerender } = render(<ParkingListCard parking={PARKING} associatedPropertyName={null} />)
    expect(screen.queryByText(/Asociado a/)).not.toBeInTheDocument()

    rerender(<ParkingListCard parking={PARKING} associatedPropertyName="Apartamento 301" />)
    expect(screen.getByText('Asociado a Apartamento 301')).toBeInTheDocument()
  })

  it('never shows a technical id or property_id as copy', () => {
    render(<ParkingListCard parking={{ ...PARKING, propertyId: 'prop-1' }} associatedPropertyName={null} />)
    expect(screen.queryByText('prop-1')).not.toBeInTheDocument()
    expect(screen.queryByText(/property_id/)).not.toBeInTheDocument()
  })
})

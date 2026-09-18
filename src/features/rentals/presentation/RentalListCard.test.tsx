import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '@/infrastructure/i18n/i18n'
import type { RentalRelationship, RentalStatus } from '../domain/rental.types'
import { RentalListCard } from './RentalListCard'

const BASE: RentalRelationship = {
  id: 'rental-1',
  administrationId: 'admin-1',
  status: 'ACTIVE',
  jurisdictionCountry: 'CO',
  realStartDate: null,
  trackingStartDate: null,
  expectedEndDate: null,
  actualEndDate: null,
  paymentDay: null,
  paymentTiming: null,
}

const STATUS_LABELS: Record<RentalStatus, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activo',
  ENDING: 'Finalizando',
  ENDED: 'Finalizado',
  CANCELLED: 'Cancelado',
}

const TITLE_LABELS: Record<RentalStatus, string> = {
  DRAFT: 'Arriendo en borrador',
  ACTIVE: 'Arriendo en curso',
  ENDING: 'Arriendo finalizando',
  ENDED: 'Arriendo finalizado',
  CANCELLED: 'Arriendo cancelado',
}

describe('RentalListCard', () => {
  for (const status of Object.keys(STATUS_LABELS) as RentalStatus[]) {
    it(`translates status ${status} to a human badge and title, never the raw enum`, () => {
      render(<RentalListCard rental={{ ...BASE, status }} />)

      expect(screen.getByText(STATUS_LABELS[status])).toBeInTheDocument()
      expect(screen.getByText(TITLE_LABELS[status])).toBeInTheDocument()
      expect(screen.queryByText(status)).not.toBeInTheDocument()
    })
  }

  it('translates ADVANCE payment timing to a human label', () => {
    render(<RentalListCard rental={{ ...BASE, paymentTiming: 'ADVANCE' }} />)
    expect(screen.getByText('Pago anticipado')).toBeInTheDocument()
    expect(screen.queryByText('ADVANCE')).not.toBeInTheDocument()
  })

  it('translates ARREARS payment timing to a human label', () => {
    render(<RentalListCard rental={{ ...BASE, paymentTiming: 'ARREARS' }} />)
    expect(screen.getByText('Pago vencido')).toBeInTheDocument()
    expect(screen.queryByText('ARREARS')).not.toBeInTheDocument()
  })

  it('omits the payment timing line entirely when it is null', () => {
    render(<RentalListCard rental={{ ...BASE, paymentTiming: null }} />)
    expect(screen.queryByText(/Pago anticipado|Pago vencido/)).not.toBeInTheDocument()
  })

  it('shows the payment day only when it exists', () => {
    const { rerender } = render(<RentalListCard rental={{ ...BASE, paymentDay: null }} />)
    expect(screen.queryByText(/Pago el día/)).not.toBeInTheDocument()

    rerender(<RentalListCard rental={{ ...BASE, paymentDay: 5 }} />)
    expect(screen.getByText('Pago el día 5')).toBeInTheDocument()
  })

  it('shows formatted start/end dates when available, without any raw ISO string leaking', () => {
    render(
      <RentalListCard
        rental={{ ...BASE, realStartDate: '2026-01-01', actualEndDate: null, expectedEndDate: '2027-01-01' }}
      />,
    )

    expect(screen.getByText(/Desde/)).toBeInTheDocument()
    expect(screen.getByText(/Hasta/)).toBeInTheDocument()
    expect(screen.queryByText('2026-01-01')).not.toBeInTheDocument()
    expect(screen.queryByText('2027-01-01')).not.toBeInTheDocument()
  })

  it('shows no date lines at all when neither start nor end dates exist - no dashes, no placeholders', () => {
    render(<RentalListCard rental={BASE} />)

    expect(screen.queryByText(/Desde/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Hasta/)).not.toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('prefers the actual end date over the expected one when both exist', () => {
    render(
      <RentalListCard
        rental={{ ...BASE, actualEndDate: '2026-06-15', expectedEndDate: '2027-01-01' }}
      />,
    )

    expect(screen.queryByText('2027-01-01')).not.toBeInTheDocument()
  })

  it('never shows a raw id/UUID, tenant, property name or rent amount - this increment does not read that data', () => {
    render(<RentalListCard rental={BASE} />)

    expect(screen.queryByText('rental-1')).not.toBeInTheDocument()
    expect(screen.queryByText('admin-1')).not.toBeInTheDocument()
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  })
})

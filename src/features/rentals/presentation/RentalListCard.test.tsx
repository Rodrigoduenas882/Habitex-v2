import { render as rtlRender, screen, type RenderResult } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import type { RentalRelationship, RentalStatus } from '../domain/rental.types'
import { RentalListCard } from './RentalListCard'

// RentalListCard navigates via useNavigate (the "Completar términos" link),
// so it needs a Router context even in tests that never click it - wrapped
// here once so every existing render(...) call site below stays unchanged.
function render(ui: ReactElement): RenderResult {
  return rtlRender(ui, { wrapper: MemoryRouter })
}

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

  it('shows no Activate button for a DRAFT rental when the activation prop is omitted', () => {
    render(<RentalListCard rental={{ ...BASE, status: 'DRAFT' }} />)

    expect(screen.queryByRole('button', { name: 'Activar' })).not.toBeInTheDocument()
  })

  it('shows no Activate button for a non-DRAFT rental even when activation is provided', () => {
    render(
      <RentalListCard
        rental={{ ...BASE, status: 'ACTIVE' }}
        activation={{ disabled: false, blockReason: null, isPending: false, errorCode: null, onActivate: () => {} }}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Activar' })).not.toBeInTheDocument()
  })

  it('shows an enabled Activate button for a DRAFT rental with no block reason', () => {
    render(
      <RentalListCard
        rental={{ ...BASE, status: 'DRAFT' }}
        activation={{ disabled: false, blockReason: null, isPending: false, errorCode: null, onActivate: () => {} }}
      />,
    )

    expect(screen.getByRole('button', { name: 'Activar' })).toBeEnabled()
  })

  it('calls onActivate when the Activate button is clicked', async () => {
    const onActivate = vi.fn()
    const user = userEvent.setup()
    render(
      <RentalListCard
        rental={{ ...BASE, status: 'DRAFT' }}
        activation={{ disabled: false, blockReason: null, isPending: false, errorCode: null, onActivate }}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Activar' }))

    expect(onActivate).toHaveBeenCalledTimes(1)
  })

  it('disables the Activate button and shows the management-access reason when blocked for that reason', () => {
    render(
      <RentalListCard
        rental={{ ...BASE, status: 'DRAFT' }}
        activation={{
          disabled: true,
          blockReason: 'managementAccess',
          isPending: false,
          errorCode: null,
          onActivate: () => {},
        }}
      />,
    )

    expect(screen.getByRole('button', { name: 'Activar' })).toBeDisabled()
    expect(
      screen.getByText('Tu acceso de administración venció. Elige un plan para seguir gestionando tu cuenta.'),
    ).toBeInTheDocument()
  })

  it('disables the Activate button and shows the capacity reason when blocked for that reason', () => {
    render(
      <RentalListCard
        rental={{ ...BASE, status: 'DRAFT' }}
        activation={{
          disabled: true,
          blockReason: 'capacity',
          isPending: false,
          errorCode: null,
          onActivate: () => {},
        }}
      />,
    )

    expect(screen.getByRole('button', { name: 'Activar' })).toBeDisabled()
    expect(screen.getByText('Alcanzaste el límite de relaciones activas de tu plan.')).toBeInTheDocument()
  })

  it('disables the Activate button and shows the termsIncomplete reason when blocked for that reason', () => {
    render(
      <RentalListCard
        rental={{ ...BASE, status: 'DRAFT' }}
        activation={{
          disabled: true,
          blockReason: 'termsIncomplete',
          isPending: false,
          errorCode: null,
          onActivate: () => {},
        }}
      />,
    )

    expect(screen.getByRole('button', { name: 'Activar' })).toBeDisabled()
    expect(screen.getByText('Completa los términos de este arriendo para poder activarlo.')).toBeInTheDocument()
  })

  it('does not show a block reason while merely pending (normal disabled-while-submitting state)', () => {
    render(
      <RentalListCard
        rental={{ ...BASE, status: 'DRAFT' }}
        activation={{ disabled: true, blockReason: null, isPending: true, errorCode: null, onActivate: () => {} }}
      />,
    )

    expect(screen.getByRole('button', { name: 'Activar' })).toBeDisabled()
    expect(screen.queryByText(/Alcanzaste el límite/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Tu acceso de administración venció/)).not.toBeInTheDocument()
  })

  it('shows the mapped error message for a failed activation attempt', () => {
    render(
      <RentalListCard
        rental={{ ...BASE, status: 'DRAFT' }}
        activation={{
          disabled: false,
          blockReason: null,
          isPending: false,
          errorCode: 'capacity_reached',
          onActivate: () => {},
        }}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Alcanzaste el límite de relaciones activas de tu plan.')
  })

  it('shows the mapped error message for a terms_incomplete activation attempt', () => {
    render(
      <RentalListCard
        rental={{ ...BASE, status: 'DRAFT' }}
        activation={{
          disabled: false,
          blockReason: null,
          isPending: false,
          errorCode: 'terms_incomplete',
          onActivate: () => {},
        }}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Completa los términos de este arriendo antes de activarlo.')
  })

  it('shows the mapped error message for an already_active activation attempt', () => {
    render(
      <RentalListCard
        rental={{ ...BASE, status: 'DRAFT' }}
        activation={{
          disabled: false,
          blockReason: null,
          isPending: false,
          errorCode: 'already_active',
          onActivate: () => {},
        }}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Este arriendo ya fue activado. Actualiza la página para ver su estado actual.',
    )
  })

  it('shows the mapped error message for a subject_in_use activation attempt', () => {
    render(
      <RentalListCard
        rental={{ ...BASE, status: 'DRAFT' }}
        activation={{
          disabled: false,
          blockReason: null,
          isPending: false,
          errorCode: 'subject_in_use',
          onActivate: () => {},
        }}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('El activo de este arriendo ya está en uso en otra relación activa.')
  })

  it('shows a "Completar términos" action for a DRAFT rental, independent of the activation prop', () => {
    render(<RentalListCard rental={{ ...BASE, id: 'rental-9', status: 'DRAFT' }} />)

    expect(screen.getByRole('button', { name: 'Completar términos' })).toBeInTheDocument()
  })

  it('shows no "Completar términos" action for a non-DRAFT rental', () => {
    render(<RentalListCard rental={{ ...BASE, status: 'ACTIVE' }} />)

    expect(screen.queryByRole('button', { name: 'Completar términos' })).not.toBeInTheDocument()
  })

  it('navigates to /rentals/:id/terms when "Completar términos" is clicked', async () => {
    const user = userEvent.setup()
    rtlRender(
      <MemoryRouter initialEntries={['/rentals']}>
        <Routes>
          <Route path="/rentals" element={<RentalListCard rental={{ ...BASE, id: 'rental-9', status: 'DRAFT' }} />} />
          <Route path="/rentals/:id/terms" element={<div>Terms page for rental-9</div>} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Completar términos' }))

    expect(screen.getByText('Terms page for rental-9')).toBeInTheDocument()
  })
})

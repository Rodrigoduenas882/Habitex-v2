import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { AttentionPanel } from './AttentionPanel'

function renderPanel(ui: Parameters<typeof render>[0]) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('AttentionPanel', () => {
  it('renders one item per REPORTED payment, with real amount/date and never a contract/document item', () => {
    renderPanel(
      <AttentionPanel
        items={[
          { id: '1', kind: 'payment', subtitle: '5 ene 2026', meta: '$950.000', rentalRelationshipId: 'rel-1' },
          { id: '2', kind: 'payment', subtitle: '12 ene 2026', meta: '$500.000', rentalRelationshipId: 'rel-2' },
        ]}
      />,
    )

    expect(screen.getAllByText('Pago pendiente')).toHaveLength(2)
    expect(screen.getByText('5 ene 2026')).toBeInTheDocument()
    expect(screen.getByText('$950.000')).toBeInTheDocument()
    expect(screen.getByText('12 ene 2026')).toBeInTheDocument()
    expect(screen.getByText('$500.000')).toBeInTheDocument()
    expect(screen.queryByText('Contrato por vencer')).not.toBeInTheDocument()
    expect(screen.queryByText('Documento pendiente')).not.toBeInTheDocument()
  })

  it('shows a calm empty state instead of an empty list when there are no reported payments', () => {
    renderPanel(<AttentionPanel items={[]} />)

    expect(screen.getByText('Todo al día')).toBeInTheDocument()
    expect(screen.queryByText('Pago pendiente')).not.toBeInTheDocument()
  })

  it('renders the "Ver" action as a real link to that item\'s own relationship payments page', () => {
    renderPanel(
      <AttentionPanel
        items={[
          { id: '1', kind: 'payment', subtitle: '5 ene 2026', meta: '$950.000', rentalRelationshipId: 'rel-1' },
          { id: '2', kind: 'payment', subtitle: '12 ene 2026', meta: '$500.000', rentalRelationshipId: 'rel-2' },
        ]}
      />,
    )

    const links = screen.getAllByRole('link', { name: 'Ver' })
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('href', '/rentals/rel-1/payments')
    expect(links[1]).toHaveAttribute('href', '/rentals/rel-2/payments')
    expect(screen.queryByRole('button', { name: 'Ver' })).not.toBeInTheDocument()
  })
})

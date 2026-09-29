import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { AttentionPanel } from './AttentionPanel'

describe('AttentionPanel', () => {
  it('renders one item per REPORTED payment, with real amount/date and never a contract/document item', () => {
    render(
      <AttentionPanel
        items={[
          { id: '1', kind: 'payment', subtitle: '5 ene 2026', meta: '$950.000' },
          { id: '2', kind: 'payment', subtitle: '12 ene 2026', meta: '$500.000' },
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
    render(<AttentionPanel items={[]} />)

    expect(screen.getByText('Todo al día')).toBeInTheDocument()
    expect(screen.queryByText('Pago pendiente')).not.toBeInTheDocument()
  })
})

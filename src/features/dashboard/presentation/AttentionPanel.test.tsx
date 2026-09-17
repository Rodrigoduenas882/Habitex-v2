import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { AttentionPanel } from './AttentionPanel'

describe('AttentionPanel', () => {
  it('lists each item with its translated title and its own data (subtitle/meta)', () => {
    render(
      <AttentionPanel
        items={[
          { id: '1', kind: 'payment', subtitle: 'Apartamento 302', meta: '$950.000' },
          { id: '2', kind: 'document', subtitle: 'Habitación 2', meta: 'Cédula del inquilino' },
        ]}
      />,
    )

    expect(screen.getByText('Pago pendiente')).toBeInTheDocument()
    expect(screen.getByText('Apartamento 302')).toBeInTheDocument()
    expect(screen.getByText('$950.000')).toBeInTheDocument()
    expect(screen.getByText('Documento pendiente')).toBeInTheDocument()
  })

  it('shows a calm empty state instead of an empty list when there is nothing pending', () => {
    render(<AttentionPanel items={[]} />)

    expect(screen.getByText('Todo al día')).toBeInTheDocument()
    expect(screen.queryByText('Pago pendiente')).not.toBeInTheDocument()
  })
})

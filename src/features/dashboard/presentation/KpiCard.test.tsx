import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { Skeleton } from '@/shared/ui/Skeleton'
import { KpiCard } from './KpiCard'

describe('KpiCard', () => {
  it('renders a plain string value/trend on the happy path', () => {
    render(<KpiCard icon={<span />} label="Ocupación" value="86%" tone="info" trend="6 de 7 ocupados" />)

    expect(screen.getByText('Ocupación')).toBeInTheDocument()
    expect(screen.getByText('86%')).toBeInTheDocument()
    expect(screen.getByText('6 de 7 ocupados')).toBeInTheDocument()
  })

  it('accepts a ReactNode (e.g. a Skeleton) as value/trend, for a loading sub-state', () => {
    render(
      <KpiCard
        icon={<span />}
        label="Ingresos del mes"
        value={<Skeleton height={32} width={96} data-testid="kpi-skeleton" />}
        tone="success"
      />,
    )

    expect(screen.getByTestId('kpi-skeleton')).toBeInTheDocument()
  })

  it('renders no trend line at all when trend is omitted', () => {
    render(<KpiCard icon={<span />} label="Inmuebles" value="7" tone="neutral" />)

    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.queryByText(/de.*ocupados/)).not.toBeInTheDocument()
  })

  it('renders as a real link with a clear accessible name when `to` is provided', () => {
    render(
      <MemoryRouter>
        <KpiCard icon={<span />} label="Inmuebles" value="12" tone="neutral" to="/properties" />
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: 'Inmuebles 12' })
    expect(link).toHaveAttribute('href', '/properties')
  })

  it('renders with no link/button role anywhere when `to` is omitted, exactly as before', () => {
    render(<KpiCard icon={<span />} label="Ocupación" value="86%" tone="info" />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

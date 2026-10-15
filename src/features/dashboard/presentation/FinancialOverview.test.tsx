import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { FinancialOverview } from './FinancialOverview'

describe('FinancialOverview', () => {
  it('renders only the income series - no expenses bar, legend, or total anywhere', () => {
    const { container } = render(
      <FinancialOverview
        months={[
          { label: 'Abr', income: 3_200_000 },
          { label: 'May', income: 3_400_000 },
        ]}
      />,
    )

    expect(screen.getByText('Ingresos')).toBeInTheDocument()
    expect(screen.getByText('$6.600.000')).toBeInTheDocument()
    expect(screen.queryByText('Gastos')).not.toBeInTheDocument()
    expect(container.querySelectorAll('[class*="barExpenses"]')).toHaveLength(0)
    expect(container.querySelectorAll('[class*="legendDotExpenses"]')).toHaveLength(0)
  })

  it('renders the real month labels', () => {
    render(<FinancialOverview months={[{ label: 'Abr', income: 100 }, { label: 'May', income: 200 }]} />)

    expect(screen.getByText('Abr')).toBeInTheDocument()
    expect(screen.getByText('May')).toBeInTheDocument()
  })
})

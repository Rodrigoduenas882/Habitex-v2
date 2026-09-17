import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { HabitexBootScreen } from './HabitexBootScreen'

describe('HabitexBootScreen', () => {
  it('shows the Habitex mark and three dots, never the literal "Cargando..." text', () => {
    render(<HabitexBootScreen />)

    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')

    // The mark stands alone here (no adjacent wordmark), so it carries the
    // accessible name itself.
    expect(screen.getByRole('img', { name: 'Habitex' })).toBeInTheDocument()

    // "Cargando..." only exists for assistive tech (sr-only), never as
    // visible plain text on screen.
    expect(status).toHaveTextContent('Cargando')
  })

  it('renders exactly three animated dots and nothing else visible', () => {
    render(<HabitexBootScreen />)

    expect(screen.getAllByTestId('boot-dot')).toHaveLength(3)
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})

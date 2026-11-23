import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { DashboardNewOwnerState } from './DashboardNewOwnerState'

function renderState(name: string | null) {
  return render(<DashboardNewOwnerState name={name} />, { wrapper: MemoryRouter })
}

describe('DashboardNewOwnerState', () => {
  it('greets the owner by their real name, not a hardcoded/prototype one', () => {
    renderState('Rodrigo')

    expect(screen.getByRole('heading', { name: /Rodrigo/ })).toBeInTheDocument()
    expect(screen.queryByText(/Camila/)).not.toBeInTheDocument()
  })

  it('falls back to a generic greeting when the name is null', () => {
    renderState(null)

    expect(screen.getByRole('heading')).toBeInTheDocument()
    expect(screen.queryByText(/Rodrigo/)).not.toBeInTheDocument()
  })

  it('renders a real link to /properties/new for the primary CTA, not a no-op button', () => {
    renderState('Rodrigo')

    const cta = screen.getByRole('link', { name: 'Agregar inmueble' })
    expect(cta).toHaveAttribute('href', '/properties/new')
  })

  it('never shows a zeroed-out metric or an action the owner cannot complete yet', () => {
    renderState('Rodrigo')

    expect(screen.queryByText(/0 arriendos/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Registrar pago/ })).not.toBeInTheDocument()
  })
})

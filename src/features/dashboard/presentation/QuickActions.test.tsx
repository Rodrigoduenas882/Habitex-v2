import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { QuickActions } from './QuickActions'

// QuickActions navigates via useNavigate for all four buttons, so every
// render needs a Router context - mirrors RentalListCard.test.tsx's own
// pattern of asserting navigation by rendering the destination route and
// checking its content appears after the click.
function renderAt(destinationPath: string, destinationLabel: string) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<QuickActions />} />
        <Route path={destinationPath} element={<div>{destinationLabel}</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('QuickActions', () => {
  it('renders all four action buttons with their labels', () => {
    render(<QuickActions />, { wrapper: MemoryRouter })

    expect(screen.getByRole('button', { name: /Agregar inmueble/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Crear arriendo/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Registrar pago/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Subir documento/ })).toBeInTheDocument()
  })

  it('navigates to /properties/new when "Agregar inmueble" is clicked', async () => {
    const user = userEvent.setup()
    renderAt('/properties/new', 'Add property page')

    await user.click(screen.getByRole('button', { name: /Agregar inmueble/ }))

    expect(screen.getByText('Add property page')).toBeInTheDocument()
  })

  it('navigates to /rentals/new when "Crear arriendo" is clicked', async () => {
    const user = userEvent.setup()
    renderAt('/rentals/new', 'Add rental page')

    await user.click(screen.getByRole('button', { name: /Crear arriendo/ }))

    expect(screen.getByText('Add rental page')).toBeInTheDocument()
  })

  it('navigates to /rentals when "Registrar pago" is clicked (no relationship context on Dashboard)', async () => {
    const user = userEvent.setup()
    renderAt('/rentals', 'Rentals list page')

    await user.click(screen.getByRole('button', { name: /Registrar pago/ }))

    expect(screen.getByText('Rentals list page')).toBeInTheDocument()
  })

  it('navigates to /rentals when "Subir documento" is clicked (no relationship context on Dashboard)', async () => {
    const user = userEvent.setup()
    renderAt('/rentals', 'Rentals list page')

    await user.click(screen.getByRole('button', { name: /Subir documento/ }))

    expect(screen.getByText('Rentals list page')).toBeInTheDocument()
  })
})

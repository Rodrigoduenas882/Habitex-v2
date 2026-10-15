import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import '@/infrastructure/i18n/i18n'
import NotFoundPage from './NotFoundPage'

function renderNotFoundPage() {
  return render(
    <MemoryRouter>
      <NotFoundPage />
    </MemoryRouter>,
  )
}

describe('NotFoundPage', () => {
  it('shows the title and description copy', () => {
    renderNotFoundPage()

    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByText('La página que buscas no existe.')).toBeInTheDocument()
  })

  it('shows the Habitex brand mark', () => {
    renderNotFoundPage()

    expect(screen.getByRole('img', { name: 'Habitex' })).toBeInTheDocument()
  })

  it('offers a real link back to "/", not a history.back() button', () => {
    renderNotFoundPage()

    const link = screen.getByRole('link', { name: 'Volver al inicio' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/')
  })
})

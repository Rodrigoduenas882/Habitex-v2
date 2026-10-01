import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import '@/infrastructure/i18n/i18n'
import UiPreviewPage from './UiPreviewPage'

// AppShellSection's preview now includes one real <Link> ('Inicio', self-
// linking back to /ui-preview - see AppShellPreview.tsx's own comment), so
// this needs a Router context, same as AuthenticatedLayout.test.tsx already
// requires for the real app shell.
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ui-preview']}>
      <UiPreviewPage />
    </MemoryRouter>,
  )
}

describe('UiPreviewPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('renders the brand, the section headings and the app shell example', () => {
    renderPage()

    expect(screen.getAllByText('Habitex').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Colores' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tipografía' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'App shell' })).toBeInTheDocument()
    expect(screen.getByText('Buenos días')).toBeInTheDocument()
    expect(screen.getByRole('tablist')).toBeInTheDocument()
  })

  it('changes the document theme when a theme option is selected', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(document.documentElement.getAttribute('data-theme')).not.toBe('dark')

    await user.click(screen.getByRole('radio', { name: 'Usar tema Oscuro' }))

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})

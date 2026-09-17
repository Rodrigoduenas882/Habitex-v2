import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import '@/infrastructure/i18n/i18n'
import UiPreviewPage from './UiPreviewPage'

describe('UiPreviewPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('renders the brand, the section headings and the app shell example', () => {
    render(<UiPreviewPage />)

    expect(screen.getAllByText('Habitex').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Colores' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tipografía' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'App shell' })).toBeInTheDocument()
    expect(screen.getByText('Buenos días')).toBeInTheDocument()
    expect(screen.getByRole('tablist')).toBeInTheDocument()
  })

  it('changes the document theme when a theme option is selected', async () => {
    const user = userEvent.setup()
    render(<UiPreviewPage />)

    expect(document.documentElement.getAttribute('data-theme')).not.toBe('dark')

    await user.click(screen.getByRole('radio', { name: 'Usar tema Oscuro' }))

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})

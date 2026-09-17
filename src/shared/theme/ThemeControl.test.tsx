import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { THEME_STORAGE_KEY } from './theme'
import { ThemeControl } from './ThemeControl'

describe('ThemeControl', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('exposes Light/Dark/System as a keyboard-accessible radio group', () => {
    render(<ThemeControl />)

    const group = screen.getByRole('radiogroup', { name: 'Apariencia' })
    expect(group).toBeInTheDocument()

    expect(screen.getByRole('radio', { name: 'Usar tema Claro' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Usar tema Oscuro' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Usar tema Sistema' })).toBeInTheDocument()
  })

  it('selecting an option marks it checked, applies it, and persists it', async () => {
    const user = userEvent.setup()
    render(<ThemeControl />)

    const darkOption = screen.getByRole('radio', { name: 'Usar tema Oscuro' })
    await user.click(darkOption)

    expect(darkOption).toHaveAttribute('aria-checked', 'true')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('is fully operable from the keyboard', async () => {
    const user = userEvent.setup()
    render(<ThemeControl />)

    await user.tab()
    expect(screen.getByRole('radio', { name: 'Usar tema Claro' })).toHaveFocus()

    await user.tab()
    const darkOption = screen.getByRole('radio', { name: 'Usar tema Oscuro' })
    expect(darkOption).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(darkOption).toHaveAttribute('aria-checked', 'true')
  })
})

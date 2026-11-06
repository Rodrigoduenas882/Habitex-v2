import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { THEME_STORAGE_KEY } from './theme'
import { ThemeControl } from './ThemeControl'

describe('ThemeControl', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('exposes only Light/Dark as a keyboard-accessible radio group, with no "System" option', () => {
    render(<ThemeControl />)

    const group = screen.getByRole('radiogroup', { name: 'Apariencia' })
    expect(group).toBeInTheDocument()

    expect(screen.getByRole('radio', { name: 'Usar tema Claro' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Usar tema Oscuro' })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'Usar tema Sistema' })).not.toBeInTheDocument()
  })

  it('reflects the OS preference on first load, with no explicit choice stored yet', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList)

    render(<ThemeControl />)

    expect(screen.getByRole('radio', { name: 'Usar tema Oscuro' })).toHaveAttribute('aria-checked', 'true')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    // The stored preference stays 'system' (tracking the OS live) - the
    // OS-detected theme is only applied, never written as an explicit
    // light/dark choice until the user actually picks one from this control.
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('system')
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

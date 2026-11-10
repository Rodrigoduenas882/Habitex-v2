import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { THEME_STORAGE_KEY } from './theme'
import { ThemeControl } from './ThemeControl'

describe('ThemeControl', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    // The matchMedia spy in one test must not leak into the next - otherwise
    // every test after it would see the OS as "always dark".
    vi.restoreAllMocks()
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

  it('is a single Tab stop (roving tabindex), landing on the checked option', async () => {
    const user = userEvent.setup()
    render(<ThemeControl />)

    const lightOption = screen.getByRole('radio', { name: 'Usar tema Claro' })
    const darkOption = screen.getByRole('radio', { name: 'Usar tema Oscuro' })
    expect(lightOption).toHaveAttribute('tabindex', '0')
    expect(darkOption).toHaveAttribute('tabindex', '-1')

    await user.tab()
    expect(lightOption).toHaveFocus()

    // Tab again leaves the group entirely instead of stopping on the second
    // radio - a real radiogroup is one stop, not one per option.
    await user.tab()
    expect(darkOption).not.toHaveFocus()
  })

  it('moves focus and selection with ArrowRight/ArrowLeft, wrapping at the ends', async () => {
    const user = userEvent.setup()
    render(<ThemeControl />)

    const lightOption = screen.getByRole('radio', { name: 'Usar tema Claro' })
    const darkOption = screen.getByRole('radio', { name: 'Usar tema Oscuro' })

    await user.tab()
    expect(lightOption).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(darkOption).toHaveFocus()
    expect(darkOption).toHaveAttribute('aria-checked', 'true')
    expect(darkOption).toHaveAttribute('tabindex', '0')
    expect(lightOption).toHaveAttribute('tabindex', '-1')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    // Only 2 options: ArrowRight again wraps back to the first.
    await user.keyboard('{ArrowRight}')
    expect(lightOption).toHaveFocus()
    expect(lightOption).toHaveAttribute('aria-checked', 'true')

    await user.keyboard('{ArrowLeft}')
    expect(darkOption).toHaveFocus()
    expect(darkOption).toHaveAttribute('aria-checked', 'true')
  })
})

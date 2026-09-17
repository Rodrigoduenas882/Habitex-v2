import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { SessionAuthError } from '../domain/session.types'
import LoginPage from './LoginPage'

const { signInWithPassword } = vi.hoisted(() => ({ signInWithPassword: vi.fn() }))

vi.mock('../infrastructure/supabase-session.repository', () => ({
  supabaseSessionRepository: {
    getSession: vi.fn(),
    signInWithPassword,
    onAuthStateChange: vi.fn(() => () => {}),
    signOut: vi.fn(),
  },
}))

function renderLoginPage() {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <LoginPage />
    </QueryClientProvider>,
  )
}

describe('LoginPage', () => {
  it('shows the hero copy and the compact stats preview, not a second dashboard', () => {
    renderLoginPage()

    // The headline renders as two lines separated by a <br/>, so its text is
    // split across text nodes - match on the paragraph's combined content.
    expect(
      screen.getByText(
        (_, element) => element?.tagName === 'P' && element.textContent === 'Más que arriendos,tranquilidad.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Vista general de tu operación')).toBeInTheDocument()
    expect(screen.getByText('$3.850.000')).toBeInTheDocument()
    expect(screen.getByText('86%')).toBeInTheDocument()
  })

  it('exposes the theme control so Light/Dark/System works on this page', () => {
    renderLoginPage()

    expect(screen.getByRole('radiogroup', { name: 'Apariencia' })).toBeInTheDocument()
  })

  it('shows the Habitex brand via BrandLogo, not a placeholder square', () => {
    renderLoginPage()

    expect(screen.getByText('Habitex')).toBeInTheDocument()
    const mark = document.querySelector('img[src="/images/brand/habitex-mark.png"]')
    expect(mark).toBeInTheDocument()
  })

  it('shows validation errors instead of submitting when the form is empty', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(await screen.findByText('Ingresa tu correo electrónico.')).toBeInTheDocument()
    expect(screen.getByText('Ingresa tu contraseña.')).toBeInTheDocument()
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it('submits valid credentials to the repository', async () => {
    const user = userEvent.setup()
    signInWithPassword.mockResolvedValueOnce({
      userId: 'user-1',
      email: 'camila@habitex.app',
      expiresAtUnix: null,
    })
    renderLoginPage()

    await user.type(screen.getByLabelText('Correo electrónico'), 'camila@habitex.app')
    await user.type(screen.getByLabelText('Contraseña'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: 'camila@habitex.app',
        password: 'correct-password',
      })
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a friendly message and stays interactive on invalid credentials', async () => {
    const user = userEvent.setup()
    signInWithPassword.mockRejectedValueOnce(new SessionAuthError('invalid_credentials'))
    renderLoginPage()

    await user.type(screen.getByLabelText('Correo electrónico'), 'camila@habitex.app')
    await user.type(screen.getByLabelText('Contraseña'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(
      await screen.findByText('El correo o la contraseña no son correctos.'),
    ).toBeInTheDocument()
    // No raw Supabase wording anywhere on the page.
    expect(screen.queryByText(/invalid login credentials/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled()
  })

  it('disables the form while the submission is pending', async () => {
    const user = userEvent.setup()
    let resolveLogin: (value: unknown) => void = () => {}
    signInWithPassword.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLogin = resolve
      }),
    )
    renderLoginPage()

    await user.type(screen.getByLabelText('Correo electrónico'), 'camila@habitex.app')
    await user.type(screen.getByLabelText('Contraseña'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    const submitButton = await screen.findByRole('button', { name: 'Iniciando sesión…' })
    expect(submitButton).toBeDisabled()
    expect(screen.getByLabelText('Correo electrónico')).toBeDisabled()
    expect(screen.getByLabelText('Contraseña')).toBeDisabled()

    resolveLogin({ userId: 'user-1', email: 'camila@habitex.app', expiresAtUnix: null })
  })
})

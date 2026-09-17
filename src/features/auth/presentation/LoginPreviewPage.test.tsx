import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { SessionAuthError } from '../domain/session.types'
import LoginPreviewPage from './LoginPreviewPage'

const { signInWithPassword } = vi.hoisted(() => ({ signInWithPassword: vi.fn() }))

vi.mock('../infrastructure/supabase-session.repository', () => ({
  supabaseSessionRepository: {
    getSession: vi.fn(),
    signInWithPassword,
    onAuthStateChange: vi.fn(() => () => {}),
    signOut: vi.fn(),
  },
}))

function renderLoginPreviewPage() {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <LoginPreviewPage />
    </QueryClientProvider>,
  )
}

describe('LoginPreviewPage', () => {
  it('shows the hero copy and the compact stats preview, not a second dashboard', () => {
    renderLoginPreviewPage()

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

  it('exposes the theme control so Light/Dark/System still works on this page', () => {
    renderLoginPreviewPage()

    expect(screen.getByRole('radiogroup', { name: 'Apariencia' })).toBeInTheDocument()
  })

  it('shows the Habitex brand via BrandLogo, not a placeholder square', () => {
    renderLoginPreviewPage()

    expect(screen.getByText('Habitex')).toBeInTheDocument()
    const mark = document.querySelector('img[src="/images/brand/habitex-mark.png"]')
    expect(mark).toBeInTheDocument()
  })

  it('shows validation errors instead of submitting when the form is empty', async () => {
    const user = userEvent.setup()
    renderLoginPreviewPage()

    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(await screen.findByText('Ingresa tu correo electrónico.')).toBeInTheDocument()
    expect(screen.getByText('Ingresa tu contraseña.')).toBeInTheDocument()
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it('submits valid credentials to the same repository as the real login', async () => {
    const user = userEvent.setup()
    signInWithPassword.mockResolvedValueOnce({
      userId: 'user-1',
      email: 'camila@habitex.app',
      expiresAtUnix: null,
    })
    renderLoginPreviewPage()

    await user.type(screen.getByLabelText('Correo electrónico'), 'camila@habitex.app')
    await user.type(screen.getByLabelText('Contraseña'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: 'camila@habitex.app',
        password: 'correct-password',
      })
    })
  })

  it('shows a friendly message on invalid credentials', async () => {
    const user = userEvent.setup()
    signInWithPassword.mockRejectedValueOnce(new SessionAuthError('invalid_credentials'))
    renderLoginPreviewPage()

    await user.type(screen.getByLabelText('Correo electrónico'), 'camila@habitex.app')
    await user.type(screen.getByLabelText('Contraseña'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(
      await screen.findByText('El correo o la contraseña no son correctos.'),
    ).toBeInTheDocument()
  })
})

import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import ForgotPasswordPage from './ForgotPasswordPage'

const { requestPasswordReset } = vi.hoisted(() => ({ requestPasswordReset: vi.fn() }))

vi.mock('../infrastructure/supabase-session.repository', () => ({
  supabaseSessionRepository: {
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    onAuthStateChange: vi.fn(() => () => {}),
    signOut: vi.fn(),
    requestPasswordReset,
    updatePassword: vi.fn(),
  },
}))

function renderForgotPasswordPage() {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ForgotPasswordPage', () => {
  it('shows its own contextual hero copy, not the commercial Login/Signup headline, and never renders the stats card', () => {
    renderForgotPasswordPage()

    expect(screen.getByText('Recupera el acceso a tu cuenta')).toBeInTheDocument()
    expect(screen.queryByText('Más que arriendos,')).not.toBeInTheDocument()
    expect(screen.queryByText('Vista general de tu operación')).not.toBeInTheDocument()
  })

  it('shows a validation error instead of submitting when the email is empty', async () => {
    const user = userEvent.setup()
    renderForgotPasswordPage()

    await user.click(screen.getByRole('button', { name: 'Enviar instrucciones' }))

    expect(await screen.findByText('Ingresa tu correo electrónico.')).toBeInTheDocument()
    expect(requestPasswordReset).not.toHaveBeenCalled()
  })

  it('requests a reset for a registered-looking email and shows the generic success state', async () => {
    const user = userEvent.setup()
    requestPasswordReset.mockResolvedValueOnce(undefined)
    renderForgotPasswordPage()

    await user.type(screen.getByLabelText('Correo electrónico'), 'propietario@habitex.app')
    await user.click(screen.getByRole('button', { name: 'Enviar instrucciones' }))

    expect(requestPasswordReset).toHaveBeenCalledWith('propietario@habitex.app')
    expect(await screen.findByText('Revisa tu correo')).toBeInTheDocument()
  })

  it('shows the exact same success state for an email that has never registered - never enumerates accounts', async () => {
    const user = userEvent.setup()
    // Supabase itself never errors for this case (see
    // SessionRepository.requestPasswordReset's own doc comment) - the
    // repository call still resolves successfully.
    requestPasswordReset.mockResolvedValueOnce(undefined)
    renderForgotPasswordPage()

    await user.type(screen.getByLabelText('Correo electrónico'), 'nadie-registrado@habitex.app')
    await user.click(screen.getByRole('button', { name: 'Enviar instrucciones' }))

    expect(
      await screen.findByText(
        'Si el correo está registrado, te enviamos instrucciones para restablecer tu contraseña.',
      ),
    ).toBeInTheDocument()
  })

  it('shows a generic error only on an actual infra failure', async () => {
    const user = userEvent.setup()
    requestPasswordReset.mockRejectedValueOnce(new Error('network error'))
    renderForgotPasswordPage()

    await user.type(screen.getByLabelText('Correo electrónico'), 'propietario@habitex.app')
    await user.click(screen.getByRole('button', { name: 'Enviar instrucciones' }))

    expect(
      await screen.findByText('No pudimos procesar tu solicitud. Intenta nuevamente.'),
    ).toBeInTheDocument()
  })

  it('links back to /login', () => {
    renderForgotPasswordPage()

    expect(screen.getByRole('link', { name: 'Volver a iniciar sesión' })).toHaveAttribute('href', '/login')
  })
})

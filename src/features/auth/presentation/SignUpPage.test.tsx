import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { SessionAuthError } from '../domain/session.types'
import SignUpPage from './SignUpPage'

const { signUp } = vi.hoisted(() => ({ signUp: vi.fn() }))

vi.mock('../infrastructure/supabase-session.repository', () => ({
  supabaseSessionRepository: {
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp,
    onAuthStateChange: vi.fn(() => () => {}),
    signOut: vi.fn(),
    requestPasswordReset: vi.fn(),
    updatePassword: vi.fn(),
  },
}))

function renderSignUpPage() {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Fills every field with valid values, except whichever keys are overridden (e.g. to leave one blank or mismatched). */
async function fillValidForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<{
    firstName: string
    lastName: string
    email: string
    password: string
    confirmPassword: string
  }> = {},
) {
  const values = {
    firstName: 'Camila',
    lastName: 'Restrepo Gómez',
    email: 'nuevo@habitex.app',
    password: 'secret123',
    confirmPassword: 'secret123',
    ...overrides,
  }

  if (values.firstName) await user.type(screen.getByLabelText('Nombres'), values.firstName)
  if (values.lastName) await user.type(screen.getByLabelText('Apellidos'), values.lastName)
  if (values.email) await user.type(screen.getByLabelText('Correo electrónico'), values.email)
  if (values.password) await user.type(screen.getByLabelText('Contraseña'), values.password)
  if (values.confirmPassword) await user.type(screen.getByLabelText('Confirma tu contraseña'), values.confirmPassword)
}

describe('SignUpPage', () => {
  it('shares the commercial hero tagline with Login, and never renders the Login-only stats card', () => {
    renderSignUpPage()

    expect(screen.getByText('Todo en un solo lugar para que tu propiedad trabaje por ti.')).toBeInTheDocument()
    expect(screen.queryByText('Vista general de tu operación')).not.toBeInTheDocument()
  })

  it('shows validation errors instead of submitting when the form is empty', async () => {
    const user = userEvent.setup()
    renderSignUpPage()

    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByText('Ingresa tus nombres.')).toBeInTheDocument()
    expect(screen.getByText('Ingresa tus apellidos.')).toBeInTheDocument()
    expect(screen.getByText('Ingresa tu correo electrónico.')).toBeInTheDocument()
    expect(signUp).not.toHaveBeenCalled()
  })

  it('rejects a password shorter than the server minimum without calling signUp', async () => {
    const user = userEvent.setup()
    renderSignUpPage()

    await fillValidForm(user, { password: 'abc12', confirmPassword: 'abc12' })
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByText('La contraseña debe tener al menos 6 caracteres.')).toBeInTheDocument()
    expect(signUp).not.toHaveBeenCalled()
  })

  it('rejects mismatched passwords without calling signUp', async () => {
    const user = userEvent.setup()
    renderSignUpPage()

    await fillValidForm(user, { confirmPassword: 'different123' })
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument()
    expect(signUp).not.toHaveBeenCalled()
  })

  it('submits valid credentials, with the first and last name concatenated into a single fullName', async () => {
    const user = userEvent.setup()
    signUp.mockResolvedValueOnce({ userId: 'user-1', email: 'nuevo@habitex.app', expiresAtUnix: null })
    renderSignUpPage()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    // useSignUp's mutationFn calls the repository port with credentials and
    // the fullName option as two separate arguments - see its own doc
    // comment on why (InvitationClaimPage must keep calling with exactly
    // one argument when it never supplies a fullName).
    expect(signUp).toHaveBeenCalledWith(
      { email: 'nuevo@habitex.app', password: 'secret123' },
      { fullName: 'Camila Restrepo Gómez' },
    )
  })

  it('trims extra whitespace from first/last name before concatenating', async () => {
    const user = userEvent.setup()
    signUp.mockResolvedValueOnce({ userId: 'user-1', email: 'nuevo@habitex.app', expiresAtUnix: null })
    renderSignUpPage()

    await fillValidForm(user, { firstName: '  Camila  ', lastName: '  Restrepo Gómez  ' })
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(signUp).toHaveBeenCalledWith(
      { email: 'nuevo@habitex.app', password: 'secret123' },
      { fullName: 'Camila Restrepo Gómez' },
    )
  })

  it('shows a check-your-email state, never the form, when signUp returns no immediate session', async () => {
    const user = userEvent.setup()
    signUp.mockResolvedValueOnce(null)
    renderSignUpPage()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByText('Revisa tu correo')).toBeInTheDocument()
    expect(screen.queryByLabelText('Correo electrónico')).not.toBeInTheDocument()
  })

  it('shows a generic error message on a failed sign-up, never raw Supabase wording', async () => {
    const user = userEvent.setup()
    signUp.mockRejectedValueOnce(new SessionAuthError('unknown'))
    renderSignUpPage()

    await fillValidForm(user, { email: 'existente@habitex.app' })
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByText('No pudimos crear tu cuenta. Intenta nuevamente.')).toBeInTheDocument()
  })

  it('links back to /login', () => {
    renderSignUpPage()

    expect(screen.getByRole('link', { name: 'Inicia sesión' })).toHaveAttribute('href', '/login')
  })
})

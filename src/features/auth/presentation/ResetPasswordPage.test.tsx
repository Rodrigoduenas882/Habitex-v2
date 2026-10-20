import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { setConfirmedRecoveryUserId } from '../application/password-recovery-signal'
import { SessionAuthError } from '../domain/session.types'
import ResetPasswordPage from './ResetPasswordPage'

const { getSession, updatePassword, signOut } = vi.hoisted(() => ({
  getSession: vi.fn(),
  updatePassword: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/infrastructure/supabase/client', () => ({
  // This file's whole suite relies on the password-recovery-signal.ts
  // corroborating flag instead (see below) - the URL-hash flag is covered
  // separately by client.test.ts, and jsdom's default empty hash would make
  // this always false here regardless.
  pageLoadedFromPasswordRecoveryLink: false,
  supabaseClient: {},
}))

vi.mock('../infrastructure/supabase-session.repository', () => ({
  supabaseSessionRepository: {
    getSession,
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    onAuthStateChange: vi.fn(() => () => {}),
    signOut,
    requestPasswordReset: vi.fn(),
    updatePassword,
  },
}))

function LoginDestinationStub() {
  const location = useLocation()
  const passwordUpdated = (location.state as { passwordUpdated?: boolean } | null)?.passwordUpdated === true
  return <div>Login page{passwordUpdated ? ' (passwordUpdated=true)' : ''}</div>
}

function renderResetPasswordPage() {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/reset-password']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/login" element={<LoginDestinationStub />} />
          <Route path="/forgot-password" element={<div>Forgot password page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ResetPasswordPage - no recovery intent detected at all', () => {
  it('shows the invalid-link state without ever calling getSession - a plain visit is never treated as a valid recovery', async () => {
    renderResetPasswordPage()

    expect(await screen.findByText('Enlace no válido')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument()
    expect(getSession).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Solicitar un nuevo enlace' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
    // Independent review (round 2): the invalid-link sub-state must not reuse the
    // normal-state hero copy, which promises "one step away" right next to an
    // error saying the link expired - nor the Login/Signup commercial headline.
    expect(screen.getByText('Solicita un nuevo enlace')).toBeInTheDocument()
    expect(screen.queryByText('Protege el acceso a tu cuenta')).not.toBeInTheDocument()
    expect(screen.queryByText('Vista general de tu operación')).not.toBeInTheDocument()
  })
})

describe('ResetPasswordPage - recovery intent observed (AuthSessionListener already pinned user-1 as the confirmed recovery identity)', () => {
  // Pinning in beforeAll (not at describe-body top level, which Vitest
  // evaluates eagerly during collection, before the suite above even runs)
  // defers it to just before this block's own tests, preserving that
  // suite's "never observed" premise. Every getSession mock below resolves
  // userId: 'user-1' to match.
  beforeAll(() => {
    setConfirmedRecoveryUserId('user-1')
  })

  it('shows the form once Supabase actually established a session from the link', async () => {
    getSession.mockResolvedValueOnce({ userId: 'user-1', email: 'propietario@habitex.app', expiresAtUnix: null })
    renderResetPasswordPage()

    expect(await screen.findByLabelText('Nueva contraseña')).toBeInTheDocument()
    expect(screen.queryByText('Enlace no válido')).not.toBeInTheDocument()
    expect(screen.getByText('Protege el acceso a tu cuenta')).toBeInTheDocument()
    expect(screen.queryByText('Vista general de tu operación')).not.toBeInTheDocument()
  })

  it('shows the invalid-link state when the intent was there but no session was ever established (expired, reused, or tampered token)', async () => {
    getSession.mockResolvedValueOnce(null)
    renderResetPasswordPage()

    expect(await screen.findByText('Enlace no válido')).toBeInTheDocument()
  })

  it('validates a minimum password length and that both fields match, without calling updatePassword', async () => {
    const user = userEvent.setup()
    getSession.mockResolvedValueOnce({ userId: 'user-1', email: 'propietario@habitex.app', expiresAtUnix: null })
    renderResetPasswordPage()

    await screen.findByLabelText('Nueva contraseña')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'abc12')
    await user.type(screen.getByLabelText('Confirma tu nueva contraseña'), 'abc12')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(await screen.findByText('La contraseña debe tener al menos 6 caracteres.')).toBeInTheDocument()
    expect(updatePassword).not.toHaveBeenCalled()
  })

  it('rejects mismatched passwords without calling updatePassword', async () => {
    const user = userEvent.setup()
    getSession.mockResolvedValueOnce({ userId: 'user-1', email: 'propietario@habitex.app', expiresAtUnix: null })
    renderResetPasswordPage()

    await screen.findByLabelText('Nueva contraseña')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'secret123')
    await user.type(screen.getByLabelText('Confirma tu nueva contraseña'), 'other456')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument()
    expect(updatePassword).not.toHaveBeenCalled()
  })

  it('updates the password, signs the recovery session out, and lands on /login with the success flag', async () => {
    const user = userEvent.setup()
    getSession.mockResolvedValueOnce({ userId: 'user-1', email: 'propietario@habitex.app', expiresAtUnix: null })
    updatePassword.mockResolvedValueOnce(undefined)
    signOut.mockResolvedValueOnce(undefined)
    renderResetPasswordPage()

    await screen.findByLabelText('Nueva contraseña')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'secret123')
    await user.type(screen.getByLabelText('Confirma tu nueva contraseña'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(await screen.findByText('Login page (passwordUpdated=true)')).toBeInTheDocument()
    expect(updatePassword).toHaveBeenCalledWith('secret123')
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('shows a specific message for a weak password, and never navigates away', async () => {
    const user = userEvent.setup()
    getSession.mockResolvedValueOnce({ userId: 'user-1', email: 'propietario@habitex.app', expiresAtUnix: null })
    updatePassword.mockRejectedValueOnce(new SessionAuthError('weak_password'))
    renderResetPasswordPage()

    await screen.findByLabelText('Nueva contraseña')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'secret123')
    await user.type(screen.getByLabelText('Confirma tu nueva contraseña'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(await screen.findByText('Esta contraseña es muy débil. Elige una diferente.')).toBeInTheDocument()
    expect(screen.queryByText(/Login page/)).not.toBeInTheDocument()
  })

  it('shows a session-expired message when the recovery session dies before submit', async () => {
    const user = userEvent.setup()
    getSession.mockResolvedValueOnce({ userId: 'user-1', email: 'propietario@habitex.app', expiresAtUnix: null })
    updatePassword.mockRejectedValueOnce(new SessionAuthError('session_expired'))
    renderResetPasswordPage()

    await screen.findByLabelText('Nueva contraseña')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'secret123')
    await user.type(screen.getByLabelText('Confirma tu nueva contraseña'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(
      await screen.findByText('Tu sesión de recuperación expiró. Solicita un nuevo enlace.'),
    ).toBeInTheDocument()
  })
})

import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { InvitationRepositoryError } from '../domain/invitation.types'
import InvitationClaimPage from './InvitationClaimPage'

const { getSession, signInWithPassword, signUp } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}))
const { claim, createInvitation } = vi.hoisted(() => ({ claim: vi.fn(), createInvitation: vi.fn() }))

vi.mock('@/features/auth/infrastructure/supabase-session.repository', () => ({
  supabaseSessionRepository: {
    getSession,
    signInWithPassword,
    signUp,
    onAuthStateChange: vi.fn(() => () => {}),
    signOut: vi.fn(),
  },
}))

vi.mock('../infrastructure/supabase-invitation.repository', () => ({
  supabaseInvitationRepository: { createInvitation, claim },
}))

const SESSION = { userId: 'user-1', email: 'tenant@habitex.app', expiresAtUnix: null }

function renderPage(initialPath: string) {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/invitations/:token" element={<InvitationClaimPage />} />
          <Route path="/invitations" element={<InvitationClaimPage />} />
          <Route path="/" element={<div>Home page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('InvitationClaimPage', () => {
  it('renders the generic invalid-link message when there is no token in the URL, never calling claim', async () => {
    renderPage('/invitations')

    expect(await screen.findByText('Este enlace de invitación no es válido.')).toBeInTheDocument()
    expect(claim).not.toHaveBeenCalled()
  })

  it('shows a Skeleton while the session is unknown', () => {
    getSession.mockReturnValueOnce(new Promise(() => {}))
    renderPage('/invitations/raw-token-abc')

    expect(screen.getByTestId('invitation-claim-loading')).toBeInTheDocument()
  })

  it('renders the "Ya tengo cuenta" / "Crear cuenta" toggle for an unauthenticated visitor, and never redirects to /login', async () => {
    getSession.mockResolvedValueOnce(null)
    renderPage('/invitations/raw-token-abc')

    expect(await screen.findByRole('tab', { name: 'Ya tengo cuenta' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Crear cuenta' })).toBeInTheDocument()
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
    expect(claim).not.toHaveBeenCalled()
  })

  it('shows the explicit "Aceptar invitación" step once authenticated, without auto-claiming on mount (regression)', async () => {
    getSession.mockResolvedValueOnce(SESSION)
    renderPage('/invitations/raw-token-abc')

    expect(await screen.findByRole('button', { name: 'Aceptar invitación' })).toBeInTheDocument()
    // Give any accidental effect a chance to run before asserting.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(claim).not.toHaveBeenCalled()
  })

  it('only calls claim_tenant_invitation once "Aceptar invitación" is explicitly clicked, with the token from the URL', async () => {
    getSession.mockResolvedValueOnce(SESSION)
    claim.mockReturnValueOnce(new Promise(() => {}))
    const user = userEvent.setup()
    renderPage('/invitations/raw-token-abc')

    const button = await screen.findByRole('button', { name: 'Aceptar invitación' })
    await user.click(button)

    expect(claim).toHaveBeenCalledTimes(1)
    expect(claim).toHaveBeenCalledWith('raw-token-abc')
  })

  it('disables the button and shows a pending label while claiming', async () => {
    getSession.mockResolvedValueOnce(SESSION)
    claim.mockReturnValueOnce(new Promise(() => {}))
    const user = userEvent.setup()
    renderPage('/invitations/raw-token-abc')

    await user.click(await screen.findByRole('button', { name: 'Aceptar invitación' }))

    const pendingButton = await screen.findByRole('button', { name: 'Aceptando invitación…' })
    expect(pendingButton).toBeDisabled()
  })

  it('navigates to "/" on a successful claim', async () => {
    getSession.mockResolvedValueOnce(SESSION)
    claim.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderPage('/invitations/raw-token-abc')

    await user.click(await screen.findByRole('button', { name: 'Aceptar invitación' }))

    expect(await screen.findByText('Home page')).toBeInTheDocument()
  })

  it.each([
    ['invalid_token', 'Este enlace de invitación no es válido.'],
    ['expired', 'Este enlace de invitación ha expirado. Solicita uno nuevo al administrador.'],
    ['already_claimed', 'Esta invitación ya fue utilizada.'],
    ['account_conflict', 'Tu cuenta ya está vinculada a otra persona y no puede usar esta invitación.'],
    ['unknown', 'No pudimos procesar la invitación. Intenta de nuevo más tarde.'],
  ] as const)('maps claim error code %s to its safe, non-disclosing copy', async (code, expectedMessage) => {
    getSession.mockResolvedValueOnce(SESSION)
    claim.mockRejectedValueOnce(new InvitationRepositoryError(code))
    const user = userEvent.setup()
    renderPage('/invitations/raw-token-abc')

    await user.click(await screen.findByRole('button', { name: 'Aceptar invitación' }))

    expect(await screen.findByText(expectedMessage)).toBeInTheDocument()
  })

  it('falls back to the generic message for a non-InvitationRepositoryError failure', async () => {
    getSession.mockResolvedValueOnce(SESSION)
    claim.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    renderPage('/invitations/raw-token-abc')

    await user.click(await screen.findByRole('button', { name: 'Aceptar invitación' }))

    expect(await screen.findByText('No pudimos procesar la invitación. Intenta de nuevo más tarde.')).toBeInTheDocument()
  })

  it('allows retrying after a retriable error (e.g. unknown), keeping the accept button visible', async () => {
    getSession.mockResolvedValueOnce(SESSION)
    claim.mockRejectedValueOnce(new InvitationRepositoryError('unknown'))
    const user = userEvent.setup()
    renderPage('/invitations/raw-token-abc')

    await user.click(await screen.findByRole('button', { name: 'Aceptar invitación' }))
    await screen.findByText('No pudimos procesar la invitación. Intenta de nuevo más tarde.')

    expect(screen.getByRole('button', { name: 'Aceptar invitación' })).toBeInTheDocument()
  })

  it.each(['already_claimed', 'expired'] as const)(
    'hides the accept button entirely for the non-retriable %s error',
    async (code) => {
      getSession.mockResolvedValueOnce(SESSION)
      claim.mockRejectedValueOnce(new InvitationRepositoryError(code))
      const user = userEvent.setup()
      renderPage('/invitations/raw-token-abc')

      await user.click(await screen.findByRole('button', { name: 'Aceptar invitación' }))
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Aceptar invitación' })).not.toBeInTheDocument()
      })
    },
  )

  it('logging in from the unauthenticated toggle leads to the authenticated-not-claimed state, still using the URL token on claim', async () => {
    getSession.mockResolvedValueOnce(null)
    signInWithPassword.mockResolvedValueOnce(SESSION)
    claim.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderPage('/invitations/raw-token-abc')

    await screen.findByRole('tab', { name: 'Ya tengo cuenta' })
    await user.type(screen.getByLabelText('Correo electrónico'), 'tenant@habitex.app')
    await user.type(screen.getByLabelText('Contraseña'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    const acceptButton = await screen.findByRole('button', { name: 'Aceptar invitación' })
    await user.click(acceptButton)

    expect(claim).toHaveBeenCalledWith('raw-token-abc')
  })

  it('signing up from the unauthenticated toggle leads to the authenticated-not-claimed state, still using the URL token on claim', async () => {
    getSession.mockResolvedValueOnce(null)
    signUp.mockResolvedValueOnce(SESSION)
    claim.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderPage('/invitations/raw-token-abc')

    await user.click(await screen.findByRole('tab', { name: 'Crear cuenta' }))
    await user.type(screen.getByLabelText('Correo electrónico'), 'new-tenant@habitex.app')
    await user.type(screen.getByLabelText('Contraseña'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    const acceptButton = await screen.findByRole('button', { name: 'Aceptar invitación' })
    await user.click(acceptButton)

    expect(claim).toHaveBeenCalledWith('raw-token-abc')
  })

  it('regression: the raw token is never written to localStorage/sessionStorage across the full unauthenticated -> signup -> authenticated -> claim flow', async () => {
    getSession.mockResolvedValueOnce(null)
    signUp.mockResolvedValueOnce(SESSION)
    claim.mockResolvedValueOnce(undefined)
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const user = userEvent.setup()
    renderPage('/invitations/raw-token-abc')

    await user.click(await screen.findByRole('tab', { name: 'Crear cuenta' }))
    await user.type(screen.getByLabelText('Correo electrónico'), 'new-tenant@habitex.app')
    await user.type(screen.getByLabelText('Contraseña'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    const acceptButton = await screen.findByRole('button', { name: 'Aceptar invitación' })
    await user.click(acceptButton)
    await screen.findByText('Home page')

    expect(setItemSpy).not.toHaveBeenCalled()
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)

    setItemSpy.mockRestore()
  })
})

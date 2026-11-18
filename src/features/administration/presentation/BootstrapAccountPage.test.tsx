import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import BootstrapAccountPage from './BootstrapAccountPage'

const { bootstrapAccount, getSession } = vi.hoisted(() => ({
  bootstrapAccount: vi.fn(),
  getSession: vi.fn().mockResolvedValue(null),
}))

vi.mock('../infrastructure/supabase-account.repository', () => ({
  supabaseAccountRepository: { getCurrentAccount: vi.fn(), bootstrapAccount },
}))

vi.mock('@/features/auth/infrastructure/supabase-session.repository', () => ({
  supabaseSessionRepository: {
    getSession,
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    onAuthStateChange: vi.fn(() => () => {}),
    signOut: vi.fn(),
    requestPasswordReset: vi.fn(),
    updatePassword: vi.fn(),
  },
}))

function renderPage() {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/bootstrap']}>
        <Routes>
          <Route path="/bootstrap" element={<BootstrapAccountPage />} />
          <Route path="/" element={<div>Home page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('BootstrapAccountPage', () => {
  it('requires a full name before submitting, and never calls bootstrap_account', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('Ingresa tu nombre completo.')).toBeInTheDocument()
    expect(bootstrapAccount).not.toHaveBeenCalled()
  })

  it('submits with only fullName when administrationName is left blank, calling the real port', async () => {
    bootstrapAccount.mockResolvedValueOnce({
      personId: 'person-1',
      accountId: 'acc-1',
      administrationId: 'admin-1',
      created: true,
    })
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText('Nombre completo'), 'María Pérez')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(bootstrapAccount).toHaveBeenCalledWith({ fullName: 'María Pérez' })
  })

  it('submits with a trimmed administrationName when it is provided', async () => {
    bootstrapAccount.mockResolvedValueOnce({
      personId: 'person-1',
      accountId: 'acc-1',
      administrationId: 'admin-1',
      created: true,
    })
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText('Nombre completo'), 'María Pérez')
    await user.type(screen.getByLabelText('Nombre de tu espacio (opcional)'), '  Edificio Central  ')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(bootstrapAccount).toHaveBeenCalledWith({
      fullName: 'María Pérez',
      administrationName: 'Edificio Central',
    })
  })

  it('disables the form and shows the pending label while submitting (blocks double submit)', async () => {
    let resolveBootstrap: (value: {
      personId: string
      accountId: string
      administrationId: string | null
      created: boolean
    }) => void = () => {}
    bootstrapAccount.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBootstrap = resolve
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText('Nombre completo'), 'María Pérez')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    const pendingButton = await screen.findByRole('button', { name: 'Continuando…' })
    expect(pendingButton).toBeDisabled()
    expect(screen.getByLabelText('Nombre completo')).toBeDisabled()

    await user.click(pendingButton)
    expect(bootstrapAccount).toHaveBeenCalledTimes(1)

    resolveBootstrap({ personId: 'person-1', accountId: 'acc-1', administrationId: 'admin-1', created: true })
  })

  it('shows a human error message on a real RPC failure, and does not navigate away', async () => {
    bootstrapAccount.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText('Nombre completo'), 'María Pérez')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('No pudimos crear tu cuenta. Intenta de nuevo.')).toBeInTheDocument()
    expect(screen.queryByText('Home page')).not.toBeInTheDocument()
    expect(screen.queryByText(/postgres/i)).not.toBeInTheDocument()
  })

  it('navigates to "/" only on real success', async () => {
    bootstrapAccount.mockResolvedValueOnce({
      personId: 'person-1',
      accountId: 'acc-1',
      administrationId: 'admin-1',
      created: true,
    })
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText('Nombre completo'), 'María Pérez')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('Home page')).toBeInTheDocument()
  })

  it('auto-provisions with the session\'s own user_metadata name the moment it mounts, never showing the form', async () => {
    getSession.mockResolvedValueOnce({
      userId: 'user-1',
      email: 'camila@habitex.app',
      expiresAtUnix: null,
      fullNameFromMetadata: 'Camila Restrepo Gómez',
    })
    bootstrapAccount.mockResolvedValueOnce({
      personId: 'person-1',
      accountId: 'acc-1',
      administrationId: 'admin-1',
      created: true,
    })
    renderPage()

    // A real owner never sees this form at all - just the same loader the
    // rest of the app uses for "finishing sign-in", then Inicio.
    expect(await screen.findByText('Home page')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nombre completo')).not.toBeInTheDocument()
    expect(bootstrapAccount).toHaveBeenCalledWith({ fullName: 'Camila Restrepo Gómez' })
    expect(bootstrapAccount).toHaveBeenCalledTimes(1)
  })

  it('falls back to the editable, pre-filled form when the automatic attempt itself fails, and a manual retry succeeds', async () => {
    getSession.mockResolvedValueOnce({
      userId: 'user-1',
      email: 'camila@habitex.app',
      expiresAtUnix: null,
      fullNameFromMetadata: 'Camila Restrepo Gómez',
    })
    bootstrapAccount.mockRejectedValueOnce(new Error('boom'))
    bootstrapAccount.mockResolvedValueOnce({
      personId: 'person-1',
      accountId: 'acc-1',
      administrationId: 'admin-1',
      created: true,
    })
    const user = userEvent.setup()
    renderPage()

    const nameInput = await screen.findByLabelText('Nombre completo')
    expect(nameInput).toHaveValue('Camila Restrepo Gómez')
    expect(await screen.findByText('No pudimos crear tu cuenta. Intenta de nuevo.')).toBeInTheDocument()
    expect(screen.queryByText('Home page')).not.toBeInTheDocument()

    await user.clear(nameInput)
    await user.type(nameInput, 'Camila R. Gómez')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(bootstrapAccount).toHaveBeenCalledTimes(2)
    expect(bootstrapAccount).toHaveBeenNthCalledWith(2, { fullName: 'Camila R. Gómez' })
    expect(await screen.findByText('Home page')).toBeInTheDocument()
  })

  it('does not auto-provision when the session has only blank/whitespace name metadata', async () => {
    getSession.mockResolvedValueOnce({
      userId: 'user-1',
      email: 'camila@habitex.app',
      expiresAtUnix: null,
      fullNameFromMetadata: '   ',
    })
    const user = userEvent.setup()
    renderPage()

    // The raw (untrimmed) metadata still pre-fills the field, same as any
    // other value - it just reads as effectively blank and still fails the
    // existing required/trim validation on submit, same as before this change.
    const nameInput = await screen.findByLabelText('Nombre completo')
    expect(bootstrapAccount).not.toHaveBeenCalled()

    await user.clear(nameInput)
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('Ingresa tu nombre completo.')).toBeInTheDocument()
    expect(bootstrapAccount).not.toHaveBeenCalled()
  })

  it('falls back to an empty, required field when the session has no name in metadata - same as before this change', async () => {
    getSession.mockResolvedValueOnce({ userId: 'user-1', email: 'camila@habitex.app', expiresAtUnix: null })
    renderPage()

    expect(await screen.findByLabelText('Nombre completo')).toHaveValue('')
    expect(bootstrapAccount).not.toHaveBeenCalled()
  })
})

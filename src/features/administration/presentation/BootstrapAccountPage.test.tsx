import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import BootstrapAccountPage from './BootstrapAccountPage'

const { bootstrapAccount } = vi.hoisted(() => ({ bootstrapAccount: vi.fn() }))

vi.mock('../infrastructure/supabase-account.repository', () => ({
  supabaseAccountRepository: { getCurrentAccount: vi.fn(), bootstrapAccount },
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

    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

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

    await user.type(screen.getByLabelText('Nombre completo'), 'María Pérez')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

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

    await user.type(screen.getByLabelText('Nombre completo'), 'María Pérez')
    await user.type(screen.getByLabelText('Nombre de tu administración'), '  Edificio Central  ')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

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

    await user.type(screen.getByLabelText('Nombre completo'), 'María Pérez')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    const pendingButton = await screen.findByRole('button', { name: 'Creando cuenta…' })
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

    await user.type(screen.getByLabelText('Nombre completo'), 'María Pérez')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

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

    await user.type(screen.getByLabelText('Nombre completo'), 'María Pérez')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByText('Home page')).toBeInTheDocument()
  })
})

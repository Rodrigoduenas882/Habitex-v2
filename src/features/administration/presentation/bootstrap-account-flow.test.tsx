import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import BootstrapAccountPage from './BootstrapAccountPage'
import { RedirectIfAccountExists } from './RedirectIfAccountExists'
import { RequiresAccount } from './RequiresAccount'

const { getCurrentAccount, bootstrapAccount } = vi.hoisted(() => ({
  getCurrentAccount: vi.fn(),
  bootstrapAccount: vi.fn(),
}))

vi.mock('../infrastructure/supabase-account.repository', () => ({
  supabaseAccountRepository: { getCurrentAccount, bootstrapAccount },
}))

/**
 * Mounts the real route subtree, not BootstrapAccountPage in isolation:
 * RedirectIfAccountExists guarding /bootstrap, RequiresAccount guarding a
 * sibling protected route, sharing one QueryClient - the exact shape the
 * navigate/cache race (useBootstrapAccount's onSuccess vs. BootstrapAccountPage's
 * post-mutate navigate) needs to reproduce.
 */
function renderApp() {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/bootstrap']}>
        <Routes>
          <Route element={<RedirectIfAccountExists />}>
            <Route path="/bootstrap" element={<BootstrapAccountPage />} />
          </Route>
          <Route element={<RequiresAccount />}>
            <Route path="/" element={<div>Product home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('bootstrap account flow (route-level integration)', () => {
  it('waits for the account refetch to resolve before navigating away, and never bounces back to /bootstrap', async () => {
    getCurrentAccount.mockResolvedValueOnce(null)
    bootstrapAccount.mockResolvedValueOnce({
      personId: 'person-1',
      accountId: 'account-1',
      administrationId: 'admin-1',
      created: true,
    })

    let resolveRefetchedAccount: (value: { id: string; personId: string; status: 'ACTIVE' }) => void = () => {}
    getCurrentAccount.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefetchedAccount = resolve
      }),
    )

    const user = userEvent.setup()
    renderApp()

    await user.type(await screen.findByLabelText('Nombre completo'), 'María Pérez')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    // Wait for the mutation's onSuccess to have kicked off the account
    // refetch caused by invalidateQueries (the second getCurrentAccount call).
    await waitFor(() => {
      expect(getCurrentAccount).toHaveBeenCalledTimes(2)
    })

    // The refetch is still pending (we haven't resolved it yet), so
    // navigation must not have happened: the mutation is still pending and
    // the same BootstrapAccountPage instance is still on screen - not a
    // freshly remounted, idle one after a bounce to "/" and back.
    expect(screen.getByRole('button', { name: 'Creando cuenta…' })).toBeDisabled()
    expect(screen.getByLabelText('Nombre completo')).toBeInTheDocument()
    expect(screen.queryByText('Product home')).not.toBeInTheDocument()

    resolveRefetchedAccount({ id: 'account-1', personId: 'person-1', status: 'ACTIVE' })

    expect(await screen.findByText('Product home')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nombre completo')).not.toBeInTheDocument()
  })
})

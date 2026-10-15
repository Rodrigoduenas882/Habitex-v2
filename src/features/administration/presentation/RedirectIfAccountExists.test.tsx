import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { RedirectIfAccountExists } from './RedirectIfAccountExists'

const { getCurrentAccount } = vi.hoisted(() => ({ getCurrentAccount: vi.fn() }))

vi.mock('../infrastructure/supabase-account.repository', () => ({
  supabaseAccountRepository: { getCurrentAccount, bootstrapAccount: vi.fn() },
}))

function renderWithRouter() {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/bootstrap']}>
        <Routes>
          <Route element={<RedirectIfAccountExists />}>
            <Route path="/bootstrap" element={<div>Bootstrap form</div>} />
          </Route>
          <Route path="/" element={<div>Product home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('RedirectIfAccountExists', () => {
  it('shows the HabitexBootScreen while the account is unknown', async () => {
    getCurrentAccount.mockReturnValueOnce(new Promise(() => {}))
    renderWithRouter()

    expect(await screen.findByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Habitex' })).toBeInTheDocument()
  })

  it('fails closed on a repository error - never shows the form nor redirects to "/"', async () => {
    getCurrentAccount.mockRejectedValueOnce(new Error('network error'))
    renderWithRouter()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Bootstrap form')).not.toBeInTheDocument()
    expect(screen.queryByText('Product home')).not.toBeInTheDocument()
  })

  it('lets a retry after an error resolve into the form once it is confirmed there is no account', async () => {
    getCurrentAccount.mockRejectedValueOnce(new Error('network error'))
    getCurrentAccount.mockResolvedValueOnce(null)
    const user = userEvent.setup()
    renderWithRouter()

    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Bootstrap form')).toBeInTheDocument()
  })

  it('redirects to "/" when the current person already has an account', async () => {
    getCurrentAccount.mockResolvedValueOnce({ id: 'acc-1', personId: 'person-1', status: 'ACTIVE' })
    renderWithRouter()

    expect(await screen.findByText('Product home')).toBeInTheDocument()
  })

  it('lets the bootstrap form through when there is no account yet', async () => {
    getCurrentAccount.mockResolvedValueOnce(null)
    renderWithRouter()

    expect(await screen.findByText('Bootstrap form')).toBeInTheDocument()
  })
})

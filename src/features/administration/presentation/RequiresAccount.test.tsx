import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { RequiresAccount } from './RequiresAccount'

const { getCurrentAccount } = vi.hoisted(() => ({ getCurrentAccount: vi.fn() }))

vi.mock('../infrastructure/supabase-account.repository', () => ({
  supabaseAccountRepository: { getCurrentAccount, bootstrapAccount: vi.fn() },
}))

function renderWithRouter() {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<RequiresAccount />}>
            <Route path="/" element={<div>Product home</div>} />
          </Route>
          <Route path="/bootstrap" element={<div>Bootstrap page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('RequiresAccount', () => {
  it('shows the HabitexBootScreen while the account is unknown', async () => {
    getCurrentAccount.mockReturnValueOnce(new Promise(() => {}))
    renderWithRouter()

    expect(await screen.findByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Habitex' })).toBeInTheDocument()
  })

  it('fails closed on a repository error - never renders the product nor redirects to /bootstrap', async () => {
    getCurrentAccount.mockRejectedValueOnce(new Error('network error'))
    renderWithRouter()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Product home')).not.toBeInTheDocument()
    expect(screen.queryByText('Bootstrap page')).not.toBeInTheDocument()
  })

  it('lets a retry after an error resolve into the product once the account exists', async () => {
    getCurrentAccount.mockRejectedValueOnce(new Error('network error'))
    getCurrentAccount.mockResolvedValueOnce({ id: 'acc-1', personId: 'person-1', status: 'ACTIVE' })
    const user = userEvent.setup()
    renderWithRouter()

    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Product home')).toBeInTheDocument()
  })

  it('redirects to /bootstrap when the current person has no account yet', async () => {
    getCurrentAccount.mockResolvedValueOnce(null)
    renderWithRouter()

    expect(await screen.findByText('Bootstrap page')).toBeInTheDocument()
  })

  it('renders the product when the account resolves', async () => {
    getCurrentAccount.mockResolvedValueOnce({ id: 'acc-1', personId: 'person-1', status: 'ACTIVE' })
    renderWithRouter()

    expect(await screen.findByText('Product home')).toBeInTheDocument()
  })
})

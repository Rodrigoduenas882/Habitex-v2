import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { AuthenticatedLayout } from './AuthenticatedLayout'

const { getSession, onAuthStateChange } = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(() => () => {}),
}))

vi.mock('@/features/auth/infrastructure/supabase-session.repository', () => ({
  supabaseSessionRepository: {
    getSession,
    signInWithPassword: vi.fn(),
    onAuthStateChange,
    signOut: vi.fn(),
  },
}))

function renderLayout(initialPath: string) {
  const client = createTestQueryClient()
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<AuthenticatedLayout />}>
            <Route index element={<div>Home page</div>} />
            <Route path="properties" element={<div>Properties page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return within(screen.getByTestId('app-shell-sidebar'))
}

describe('AuthenticatedLayout navigation', () => {
  it('navigates to /properties when "Inmuebles" is clicked, and marks it active', async () => {
    getSession.mockResolvedValueOnce({ userId: 'user-1', email: 'a@habitex.app', expiresAtUnix: null })
    const user = userEvent.setup()
    const sidebar = renderLayout('/')
    await screen.findByText('Home page')

    await user.click(sidebar.getByRole('link', { name: 'Inmuebles' }))

    expect(await screen.findByText('Properties page')).toBeInTheDocument()
    expect(sidebar.getByRole('link', { name: 'Inmuebles' })).toHaveAttribute('aria-current', 'page')
  })

  it('keeps "Inicio" working and marks it active on the index route', async () => {
    getSession.mockResolvedValueOnce({ userId: 'user-1', email: 'a@habitex.app', expiresAtUnix: null })
    const sidebar = renderLayout('/')
    await screen.findByText('Home page')

    expect(sidebar.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page')
  })

  it('keeps a route-less item ("Arriendos") inert as a plain button, not a link', async () => {
    getSession.mockResolvedValueOnce({ userId: 'user-1', email: 'a@habitex.app', expiresAtUnix: null })
    const sidebar = renderLayout('/')
    await screen.findByText('Home page')

    expect(sidebar.queryByRole('link', { name: 'Arriendos' })).not.toBeInTheDocument()
    expect(sidebar.getByRole('button', { name: 'Arriendos' })).toBeInTheDocument()
  })
})

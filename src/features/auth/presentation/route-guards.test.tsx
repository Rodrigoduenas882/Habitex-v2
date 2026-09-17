import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { ProtectedRoute } from './ProtectedRoute'
import { RedirectIfAuthenticated } from './RedirectIfAuthenticated'

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }))

vi.mock('../infrastructure/supabase-session.repository', () => ({
  supabaseSessionRepository: {
    getSession,
    signInWithPassword: vi.fn(),
    onAuthStateChange: vi.fn(() => () => {}),
    signOut: vi.fn(),
  },
}))

function renderWithRouter(initialPath: string) {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<div>Protected home</div>} />
          </Route>
          <Route element={<RedirectIfAuthenticated />}>
            <Route path="/login" element={<div>Login page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ProtectedRoute', () => {
  it('shows the HabitexBootScreen (not raw "Cargando..." text) while the session is unknown', async () => {
    let resolveSession: (value: null) => void = () => {}
    getSession.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSession = resolve
      }),
    )
    renderWithRouter('/')

    expect(await screen.findByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Habitex' })).toBeInTheDocument()

    resolveSession(null)
    expect(await screen.findByText('Login page')).toBeInTheDocument()
  })

  it('redirects to /login when there is no session', async () => {
    getSession.mockResolvedValueOnce(null)
    renderWithRouter('/')
    expect(await screen.findByText('Login page')).toBeInTheDocument()
  })

  it('renders the protected content when a session exists', async () => {
    getSession.mockResolvedValueOnce({ userId: 'user-1', email: 'a@habitex.app', expiresAtUnix: null })
    renderWithRouter('/')
    expect(await screen.findByText('Protected home')).toBeInTheDocument()
  })

  it('fails closed (redirects to /login) when getSession errors', async () => {
    getSession.mockRejectedValueOnce(new Error('network error'))
    renderWithRouter('/')
    expect(await screen.findByText('Login page')).toBeInTheDocument()
  })
})

describe('RedirectIfAuthenticated', () => {
  it('sends an already-authenticated visitor to the protected app instead of /login', async () => {
    getSession.mockResolvedValueOnce({ userId: 'user-1', email: 'a@habitex.app', expiresAtUnix: null })
    renderWithRouter('/login')
    expect(await screen.findByText('Protected home')).toBeInTheDocument()
  })

  it('shows the login page for an unauthenticated visitor', async () => {
    getSession.mockResolvedValueOnce(null)
    renderWithRouter('/login')
    expect(await screen.findByText('Login page')).toBeInTheDocument()
  })
})

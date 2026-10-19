import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { useRequestPasswordReset } from './useRequestPasswordReset'

const { requestPasswordReset } = vi.hoisted(() => ({ requestPasswordReset: vi.fn() }))

vi.mock('../infrastructure/supabase-session.repository', () => ({
  supabaseSessionRepository: {
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    onAuthStateChange: vi.fn(() => () => {}),
    signOut: vi.fn(),
    requestPasswordReset,
    updatePassword: vi.fn(),
  },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useRequestPasswordReset', () => {
  it('calls the repository through the port with exactly the given email', async () => {
    requestPasswordReset.mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useRequestPasswordReset(), { wrapper })

    result.current.mutate('propietario@habitex.app')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(requestPasswordReset).toHaveBeenCalledWith('propietario@habitex.app')
  })

  it('surfaces a failed request as a mutation error', async () => {
    requestPasswordReset.mockRejectedValueOnce(new Error('network error'))
    const { result } = renderHook(() => useRequestPasswordReset(), { wrapper })

    result.current.mutate('propietario@habitex.app')

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})

import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { useLogout } from './useLogout'

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }))

vi.mock('../infrastructure/supabase-session.repository', () => ({
  supabaseSessionRepository: {
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    onAuthStateChange: vi.fn(() => () => {}),
    signOut,
  },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useLogout', () => {
  it('calls the repository signOut through the port, not Supabase directly', async () => {
    signOut.mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useLogout(), { wrapper })

    result.current.mutate()

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('surfaces a failed sign-out as a mutation error instead of pretending it succeeded', async () => {
    signOut.mockRejectedValueOnce(new Error('network down'))
    const { result } = renderHook(() => useLogout(), { wrapper })

    result.current.mutate()

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})

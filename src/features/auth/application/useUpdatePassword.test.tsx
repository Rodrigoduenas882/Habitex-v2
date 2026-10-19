import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { authQueryKeys } from './auth-query-keys'
import { useUpdatePassword } from './useUpdatePassword'

const { updatePassword, signOut } = vi.hoisted(() => ({
  updatePassword: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('../infrastructure/supabase-session.repository', () => ({
  supabaseSessionRepository: {
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    onAuthStateChange: vi.fn(() => () => {}),
    signOut,
    requestPasswordReset: vi.fn(),
    updatePassword,
  },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useUpdatePassword', () => {
  it('updates the password and then signs out - a recovery session must never outlive the password change it was for', async () => {
    updatePassword.mockResolvedValueOnce(undefined)
    signOut.mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useUpdatePassword(), { wrapper })

    result.current.mutate('new-secret-123')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(updatePassword).toHaveBeenCalledWith('new-secret-123')
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('nulls the shared auth session query cache on success, same as useLogout', async () => {
    updatePassword.mockResolvedValueOnce(undefined)
    signOut.mockResolvedValueOnce(undefined)
    const client = createTestQueryClient()
    const { result } = renderHook(() => useUpdatePassword(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    })

    result.current.mutate('new-secret-123')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(client.getQueryData(authQueryKeys.session)).toBeNull()
  })

  it('never signs out when updatePassword itself fails', async () => {
    updatePassword.mockRejectedValueOnce(new Error('weak password'))
    const { result } = renderHook(() => useUpdatePassword(), { wrapper })

    result.current.mutate('123')

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(signOut).not.toHaveBeenCalled()
  })

  it('still reports success when signOut fails after updatePassword already succeeded - the password change itself must never look like it failed', async () => {
    updatePassword.mockResolvedValueOnce(undefined)
    signOut.mockRejectedValueOnce(new Error('network error'))
    const { result } = renderHook(() => useUpdatePassword(), { wrapper })

    result.current.mutate('new-secret-123')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.isError).toBe(false)
  })
})

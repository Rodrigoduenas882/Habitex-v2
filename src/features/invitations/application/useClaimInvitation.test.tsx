import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { administrationQueryKeys } from '@/features/administration/application/administration-query-keys'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { InvitationRepositoryError } from '../domain/invitation.types'
import { useClaimInvitation } from './useClaimInvitation'

const { claim } = vi.hoisted(() => ({ claim: vi.fn() }))

vi.mock('../infrastructure/supabase-invitation.repository', () => ({
  supabaseInvitationRepository: {
    createInvitation: vi.fn(),
    claim,
  },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useClaimInvitation', () => {
  it('calls the repository through the port with the raw token, exactly once', async () => {
    claim.mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useClaimInvitation(), { wrapper })

    result.current.mutate('raw-token-value')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(claim).toHaveBeenCalledTimes(1)
    expect(claim).toHaveBeenCalledWith('raw-token-value')
  })

  it('invalidates administrationQueryKeys.account on a successful claim', async () => {
    claim.mockResolvedValueOnce(undefined)
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useClaimInvitation(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    })

    result.current.mutate('raw-token-value')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: administrationQueryKeys.account })
  })

  it('surfaces a repository failure as a mutation error without swallowing its typed code', async () => {
    claim.mockRejectedValueOnce(new InvitationRepositoryError('expired'))
    const { result } = renderHook(() => useClaimInvitation(), { wrapper })

    result.current.mutate('raw-token-value')

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as InvitationRepositoryError).code).toBe('expired')
  })
})

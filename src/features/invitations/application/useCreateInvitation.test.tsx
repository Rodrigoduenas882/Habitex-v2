import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { InvitationRepositoryError } from '../domain/invitation.types'
import { useCreateInvitation } from './useCreateInvitation'

const { createInvitation } = vi.hoisted(() => ({ createInvitation: vi.fn() }))

vi.mock('../infrastructure/supabase-invitation.repository', () => ({
  supabaseInvitationRepository: {
    createInvitation,
    claim: vi.fn(),
  },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const INPUT = {
  administrationId: 'admin-1',
  personId: 'person-1',
  rentalRelationshipId: 'rel-1',
  tokenHash: 'a'.repeat(64),
  expiresAt: '2026-01-12T00:00:00Z',
}

const INVITATION = {
  id: 'invitation-1',
  administrationId: 'admin-1',
  personId: 'person-1',
  rentalRelationshipId: 'rel-1',
  status: 'PENDING' as const,
  expiresAt: '2026-01-12T00:00:00Z',
  createdAt: '2026-01-05T00:00:00Z',
}

describe('useCreateInvitation', () => {
  it('calls the repository through the port with the full input, exactly once', async () => {
    createInvitation.mockResolvedValueOnce(INVITATION)
    const { result } = renderHook(() => useCreateInvitation(), { wrapper })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(createInvitation).toHaveBeenCalledTimes(1)
    expect(createInvitation).toHaveBeenCalledWith(INPUT)
    expect(result.current.data).toEqual(INVITATION)
  })

  it('surfaces a repository failure as a mutation error without swallowing its typed code', async () => {
    createInvitation.mockRejectedValueOnce(new InvitationRepositoryError('tenant_not_linked'))
    const { result } = renderHook(() => useCreateInvitation(), { wrapper })

    result.current.mutate(INPUT)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as InvitationRepositoryError).code).toBe('tenant_not_linked')
  })
})

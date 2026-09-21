import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { TenantCandidateRepositoryError } from '../domain/tenant-candidate.types'
import { tenantCandidateQueryKeys } from './tenant-candidate-query-keys'
import { useTenantCandidates } from './useTenantCandidates'

const { listByAdministration } = vi.hoisted(() => ({ listByAdministration: vi.fn() }))

vi.mock('../infrastructure/supabase-tenant-candidate.repository', () => ({
  supabaseTenantCandidateRepository: { listByAdministration },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useTenantCandidates', () => {
  it('does not fetch while no administrationId is resolved yet', () => {
    const { result } = renderHook(() => useTenantCandidates(undefined), { wrapper })

    expect(listByAdministration).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches through the port once an administrationId is resolved', async () => {
    listByAdministration.mockResolvedValueOnce([{ id: 'person-1', fullName: 'María Pérez' }])

    const { result } = renderHook(() => useTenantCandidates('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(listByAdministration).toHaveBeenCalledWith('admin-1')
    expect(result.current.data).toHaveLength(1)
  })

  it('uses the ["administration", administrationId, "tenant-candidates"] key shape', () => {
    expect(tenantCandidateQueryKeys.list('admin-1')).toEqual(['administration', 'admin-1', 'tenant-candidates'])
  })

  it('surfaces a repository failure as a query error', async () => {
    listByAdministration.mockRejectedValueOnce(
      new TenantCandidateRepositoryError('Failed to list people linked to the administration'),
    )

    const { result } = renderHook(() => useTenantCandidates('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})

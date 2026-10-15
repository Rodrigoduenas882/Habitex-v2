import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { RentalSubjectRepositoryError } from '../domain/rental-subject.types'
import { rentalQueryKeys } from './rental-query-keys'
import { useRentalSubjectLinks } from './useRentalSubjectLinks'

const { listRelationshipLinksByAdministration } = vi.hoisted(() => ({
  listRelationshipLinksByAdministration: vi.fn(),
}))

vi.mock('../infrastructure/supabase-rental-subject.repository', () => ({
  supabaseRentalSubjectRepository: { listRelationshipLinksByAdministration },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useRentalSubjectLinks', () => {
  it('does not fetch while no administrationId is available', () => {
    const { result } = renderHook(() => useRentalSubjectLinks(undefined), { wrapper })

    expect(listRelationshipLinksByAdministration).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches through the port, scoped under ["administration", administrationId, "rental-subject-links"], once an administrationId is available', async () => {
    listRelationshipLinksByAdministration.mockResolvedValueOnce([
      { rentalRelationshipId: 'rel-1', rentalSubjectId: 'subj-1' },
    ])

    const { result } = renderHook(() => useRentalSubjectLinks('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(listRelationshipLinksByAdministration).toHaveBeenCalledWith('admin-1')
    expect(result.current.data).toHaveLength(1)
  })

  it('uses the ["administration", administrationId, "rental-subject-links"] key shape', () => {
    expect(rentalQueryKeys.subjectLinks('admin-1')).toEqual(['administration', 'admin-1', 'rental-subject-links'])
  })

  it('surfaces a repository failure as a query error', async () => {
    listRelationshipLinksByAdministration.mockRejectedValueOnce(
      new RentalSubjectRepositoryError('Failed to list rental relationship subject links for the administration'),
    )

    const { result } = renderHook(() => useRentalSubjectLinks('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})

import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { RentalSubjectRepositoryError } from '../domain/rental-subject.types'
import { rentalSubjectQueryKeys } from './rental-subject-query-keys'
import { useRentalSubjects } from './useRentalSubjects'

const { listByAdministration } = vi.hoisted(() => ({ listByAdministration: vi.fn() }))

vi.mock('../infrastructure/supabase-rental-subject.repository', () => ({
  supabaseRentalSubjectRepository: { listByAdministration },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useRentalSubjects', () => {
  it('does not fetch while administrationId is not resolved', () => {
    const { result } = renderHook(() => useRentalSubjects(undefined, 'FULL_PROPERTY'), { wrapper })

    expect(listByAdministration).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('does not fetch while subjectType is not chosen yet', () => {
    const { result } = renderHook(() => useRentalSubjects('admin-1', undefined), { wrapper })

    expect(listByAdministration).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches through the port once both administrationId and subjectType are resolved', async () => {
    listByAdministration.mockResolvedValueOnce([
      { id: 'subj-1', administrationId: 'admin-1', subjectType: 'FULL_PROPERTY', label: 'la florida' },
    ])

    const { result } = renderHook(() => useRentalSubjects('admin-1', 'FULL_PROPERTY'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(listByAdministration).toHaveBeenCalledWith('admin-1', 'FULL_PROPERTY')
    expect(result.current.data).toHaveLength(1)
  })

  it('uses the ["administration", administrationId, "rental-subjects", subjectType] key shape', () => {
    expect(rentalSubjectQueryKeys.list('admin-1', 'FULL_PROPERTY')).toEqual([
      'administration',
      'admin-1',
      'rental-subjects',
      'FULL_PROPERTY',
    ])
  })

  it('surfaces a repository failure as a query error', async () => {
    listByAdministration.mockRejectedValueOnce(
      new RentalSubjectRepositoryError('Failed to list rental subjects for the administration'),
    )

    const { result } = renderHook(() => useRentalSubjects('admin-1', 'ROOM'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})

import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { AdministrationContextError } from '../domain/administration.types'
import { useAccessibleAdministrations } from './useAccessibleAdministrations'

const { listAccessibleAdministrations } = vi.hoisted(() => ({
  listAccessibleAdministrations: vi.fn(),
}))

vi.mock('../infrastructure/supabase-administration.repository', () => ({
  supabaseAdministrationRepository: { listAccessibleAdministrations },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useAccessibleAdministrations', () => {
  it('resolves the accessible administrations through the port, mapped to the domain shape', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([
      { id: 'admin-1', name: 'Administración Uno', status: 'some-status' },
    ])

    const { result } = renderHook(() => useAccessibleAdministrations(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toEqual([
      { id: 'admin-1', name: 'Administración Uno', status: 'some-status' },
    ])
  })

  it('resolves to an empty list without treating it as an error', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([])

    const { result } = renderHook(() => useAccessibleAdministrations(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toEqual([])
  })

  it('surfaces a repository failure as a query error', async () => {
    listAccessibleAdministrations.mockRejectedValueOnce(
      new AdministrationContextError('Failed to list accessible administrations'),
    )

    const { result } = renderHook(() => useAccessibleAdministrations(), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})

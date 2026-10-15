import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { AdministrationContextError } from '../domain/administration.types'
import { useActiveAdministration } from './useActiveAdministration'

const { listAccessibleAdministrations } = vi.hoisted(() => ({
  listAccessibleAdministrations: vi.fn(),
}))

vi.mock('../infrastructure/supabase-administration.repository', () => ({
  supabaseAdministrationRepository: { listAccessibleAdministrations },
}))

const STORAGE_KEY = 'habitex:selected-administration-id'

const ADMIN_1 = { id: 'admin-1', name: 'Administración Uno', status: 'ACTIVE' } as const
const ADMIN_2 = { id: 'admin-2', name: 'Administración Dos', status: 'ACTIVE' } as const

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  window.localStorage.clear()
})

describe('useActiveAdministration', () => {
  it('reports "loading" before the accessible administrations query settles', () => {
    listAccessibleAdministrations.mockReturnValueOnce(new Promise(() => {}))

    const { result } = renderHook(() => useActiveAdministration(), { wrapper })

    expect(result.current).toEqual({ status: 'loading' })
  })

  it('reports "none" for zero accessible administrations', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([])

    const { result } = renderHook(() => useActiveAdministration(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).not.toBe('loading')
    })
    expect(result.current).toEqual({ status: 'none' })
  })

  it('reports "error" when the accessible administrations query fails', async () => {
    listAccessibleAdministrations.mockRejectedValueOnce(
      new AdministrationContextError('Failed to list accessible administrations'),
    )

    const { result } = renderHook(() => useActiveAdministration(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).not.toBe('loading')
    })
    expect(result.current.status).toBe('error')
  })

  it('passes through "resolved" for exactly one accessible administration', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([ADMIN_1])

    const { result } = renderHook(() => useActiveAdministration(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).not.toBe('loading')
    })
    expect(result.current).toEqual({ status: 'resolved', administration: ADMIN_1 })
  })

  it('reports "selection-required" with a select() function when nothing is persisted', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([ADMIN_1, ADMIN_2])

    const { result } = renderHook(() => useActiveAdministration(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('selection-required')
    })
    if (result.current.status !== 'selection-required') {
      throw new Error('expected selection-required')
    }
    expect(result.current.options).toEqual([ADMIN_1, ADMIN_2])
    expect(typeof result.current.select).toBe('function')
  })

  it('resolves directly from a previously persisted, still-accessible selection', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'admin-2')
    listAccessibleAdministrations.mockResolvedValueOnce([ADMIN_1, ADMIN_2])

    const { result } = renderHook(() => useActiveAdministration(), { wrapper })

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'resolved', administration: ADMIN_2 })
    })
  })

  it('falls back to "selection-required" when the persisted id is no longer accessible', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'admin-revoked')
    listAccessibleAdministrations.mockResolvedValueOnce([ADMIN_1, ADMIN_2])

    const { result } = renderHook(() => useActiveAdministration(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('selection-required')
    })
  })

  it('select(id) persists the choice and re-derives to "resolved" without a new fetch', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([ADMIN_1, ADMIN_2])

    const { result } = renderHook(() => useActiveAdministration(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('selection-required')
    })
    const before = result.current
    if (before.status !== 'selection-required') {
      throw new Error('expected selection-required')
    }

    act(() => {
      before.select('admin-2')
    })

    expect(result.current).toEqual({ status: 'resolved', administration: ADMIN_2 })
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('admin-2')
    expect(listAccessibleAdministrations).toHaveBeenCalledTimes(1)
  })
})

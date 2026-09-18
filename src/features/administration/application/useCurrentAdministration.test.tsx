import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { AdministrationContextError } from '../domain/administration.types'
import { useCurrentAdministration } from './useCurrentAdministration'

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

describe('useCurrentAdministration', () => {
  it('reports "loading" before the accessible administrations query settles', () => {
    listAccessibleAdministrations.mockReturnValueOnce(new Promise(() => {}))

    const { result } = renderHook(() => useCurrentAdministration(), { wrapper })

    expect(result.current).toEqual({ status: 'loading' })
  })

  it('reports "none" for zero accessible administrations', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([])

    const { result } = renderHook(() => useCurrentAdministration(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).not.toBe('loading')
    })
    expect(result.current).toEqual({ status: 'none' })
  })

  it('auto-resolves "resolved" for exactly one accessible administration', async () => {
    const administration = { id: 'admin-1', name: 'Administración Uno', status: 'some-status' }
    listAccessibleAdministrations.mockResolvedValueOnce([administration])

    const { result } = renderHook(() => useCurrentAdministration(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).not.toBe('loading')
    })
    expect(result.current).toEqual({ status: 'resolved', administration })
  })

  it('never auto-picks options[0] for multiple accessible administrations - reports "selection-required" instead', async () => {
    const administrations = [
      { id: 'admin-1', name: 'Administración Uno', status: 'some-status' },
      { id: 'admin-2', name: 'Administración Dos', status: 'some-status' },
    ]
    listAccessibleAdministrations.mockResolvedValueOnce(administrations)

    const { result } = renderHook(() => useCurrentAdministration(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).not.toBe('loading')
    })
    expect(result.current).toEqual({ status: 'selection-required', options: administrations })
  })

  it('reports "error" when the accessible administrations query fails', async () => {
    listAccessibleAdministrations.mockRejectedValueOnce(
      new AdministrationContextError('Failed to list accessible administrations'),
    )

    const { result } = renderHook(() => useCurrentAdministration(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).not.toBe('loading')
    })
    expect(result.current.status).toBe('error')
  })
})

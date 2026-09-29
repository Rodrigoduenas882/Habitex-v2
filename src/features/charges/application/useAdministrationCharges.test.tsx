import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { ChargeRepositoryError } from '../domain/charge.types'
import { chargeQueryKeys } from './charge-query-keys'
import { useAdministrationCharges } from './useAdministrationCharges'

const { listByAdministration } = vi.hoisted(() => ({ listByAdministration: vi.fn() }))

vi.mock('../infrastructure/supabase-charge.repository', () => ({
  supabaseChargeRepository: { listByAdministration },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const RANGE = { from: '2026-09-01', toExclusive: '2026-10-01' }

describe('useAdministrationCharges', () => {
  it('does not fetch while no administrationId is available', () => {
    const { result } = renderHook(() => useAdministrationCharges(undefined, RANGE), { wrapper })

    expect(listByAdministration).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('does not fetch while no range is available', () => {
    const { result } = renderHook(() => useAdministrationCharges('admin-1', undefined), { wrapper })

    expect(listByAdministration).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches through the port once both administrationId and range are resolved', async () => {
    listByAdministration.mockResolvedValueOnce([{ id: 'charge-1' }])

    const { result } = renderHook(() => useAdministrationCharges('admin-1', RANGE), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(listByAdministration).toHaveBeenCalledWith('admin-1', RANGE)
    expect(result.current.data).toHaveLength(1)
  })

  it('uses the ["administration", administrationId, "charges", "range", from, toExclusive] key shape', () => {
    expect(chargeQueryKeys.listByAdministration('admin-1', RANGE)).toEqual([
      'administration',
      'admin-1',
      'charges',
      'range',
      '2026-09-01',
      '2026-10-01',
    ])
  })

  it('surfaces a repository failure as a query error', async () => {
    listByAdministration.mockRejectedValueOnce(new ChargeRepositoryError('unknown'))

    const { result } = renderHook(() => useAdministrationCharges('admin-1', RANGE), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})

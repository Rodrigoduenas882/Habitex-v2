import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { PropertyRepositoryError } from '../domain/property.types'
import { propertyQueryKeys } from './property-query-keys'
import { useProperties } from './useProperties'

const { listByAdministration } = vi.hoisted(() => ({ listByAdministration: vi.fn() }))

vi.mock('../infrastructure/supabase-property.repository', () => ({
  supabasePropertyRepository: { listByAdministration },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useProperties', () => {
  it('does not fetch while no administrationId is resolved yet', () => {
    const { result } = renderHook(() => useProperties(undefined), { wrapper })

    expect(listByAdministration).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches through the port, scoped under the administration query key, once an administrationId is resolved', async () => {
    listByAdministration.mockResolvedValueOnce([
      {
        id: 'prop-1',
        administrationId: 'admin-1',
        propertyType: 'HOUSE',
        rentalMode: 'FULL_PROPERTY',
        name: 'Casa 14',
        countryCode: 'CO',
        city: 'Medellín',
        address: 'Cra 1 # 2-3',
        hasAdministration: false,
        administrationFee: null,
      },
    ])

    const { result } = renderHook(() => useProperties('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(listByAdministration).toHaveBeenCalledWith('admin-1')
    expect(result.current.data).toHaveLength(1)
  })

  it('uses the ["administration", administrationId, "properties"] key shape', () => {
    expect(propertyQueryKeys.list('admin-1')).toEqual(['administration', 'admin-1', 'properties'])
  })

  it('surfaces a repository failure as a query error', async () => {
    listByAdministration.mockRejectedValueOnce(
      new PropertyRepositoryError('Failed to list properties for the administration'),
    )

    const { result } = renderHook(() => useProperties('admin-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})

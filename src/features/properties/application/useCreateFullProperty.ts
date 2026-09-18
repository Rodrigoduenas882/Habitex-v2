import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreatePropertyInput } from '../domain/property.types'
import { propertyRepository } from '../composition'
import { propertyQueryKeys } from './property-query-keys'

/**
 * Creates a FULL_PROPERTY asset. On success, invalidates the administration's
 * properties list - navigation back to /properties is the caller's
 * responsibility (a presentation concern, not this mutation's).
 */
export function useCreateFullProperty(administrationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: Omit<CreatePropertyInput, 'administrationId'>) =>
      propertyRepository.createFullProperty({ ...input, administrationId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: propertyQueryKeys.list(administrationId) })
    },
  })
}

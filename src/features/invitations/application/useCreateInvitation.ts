import { useMutation } from '@tanstack/react-query'
import { invitationRepository } from '../composition'
import type { CreateTenantInvitationInput } from '../domain/invitation.types'

/**
 * Creates a TENANT_INVITATION via create_tenant_invitation (see
 * InvitationRepository.createInvitation's own doc comment). No invalidation
 * needed - nothing in this app currently reads or lists invitations.
 */
export function useCreateInvitation() {
  return useMutation({
    mutationFn: (input: CreateTenantInvitationInput) => invitationRepository.createInvitation(input),
  })
}

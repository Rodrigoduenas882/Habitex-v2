import { useMutation, useQueryClient } from '@tanstack/react-query'
// Cross-feature import, explicitly authorized for this increment (a
// successful claim creates the accounts row server-side, so the cached "no
// account yet" result must be invalidated or RequiresAccount would
// incorrectly stay on a stale null and redirect to /bootstrap even though an
// account now exists) - reused exactly as exported, never redefined.
import { administrationQueryKeys } from '@/features/administration/application/administration-query-keys'
import { invitationRepository } from '../composition'

/**
 * Claims a pending TENANT_INVITATION via claim_tenant_invitation (see
 * InvitationRepository.claim's own doc comment - the raw token is sent as-is,
 * the RPC hashes it server-side itself). On success, invalidates
 * administrationQueryKeys.account so useAccount()/RequiresAccount picks up
 * the freshly-created account on the very next render.
 */
export function useClaimInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (rawToken: string) => invitationRepository.claim(rawToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: administrationQueryKeys.account })
    },
  })
}

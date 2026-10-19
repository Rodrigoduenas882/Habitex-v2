import { useMutation, useQueryClient } from '@tanstack/react-query'
import { sessionRepository } from '../composition'
import { authQueryKeys } from './auth-query-keys'

/**
 * Updates the password, then unconditionally signs out - a recovery session
 * must never remain usable after the password it was meant to let the user
 * set has actually been set (see ResetPasswordPage's own doc comment: the
 * destination after this succeeds is always /login, a fresh sign-in with
 * the new password, never a silent continuation into the dashboard on the
 * leftover recovery session). Eagerly nulls the session query cache for the
 * same reason useLogout does: ProtectedRoute/RequiresAccount must see
 * "signed out" immediately, not after the asynchronous onAuthStateChange
 * round trip.
 *
 * Independent review (MEDIUM, fixed): signOut() failing (network, a
 * transient GoTrue error) must never fail this whole mutation - the
 * password has, by that point, already been changed for real. Letting that
 * propagate used to put the mutation in isError and show the generic
 * "couldn't update your password" message even though it DID update,
 * leaving the user confused and likely to retry against a password that is
 * now the SAME as what they just set (triggering a second, equally
 * confusing same_password error). signOut is therefore best-effort here:
 * its own failure is swallowed (DEV-logged only, mirroring useLogout's own
 * onError handling), never surfaced as this mutation's error.
 */
export function useUpdatePassword() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (newPassword: string) => {
      await sessionRepository.updatePassword(newPassword)
      try {
        await sessionRepository.signOut()
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('signOut after a successful password update failed:', error)
        }
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(authQueryKeys.session, null)
    },
  })
}

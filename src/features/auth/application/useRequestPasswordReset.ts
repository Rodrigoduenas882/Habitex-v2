import { useMutation } from '@tanstack/react-query'
import { sessionRepository } from '../composition'

/**
 * No query-cache write on success (unlike useLogin/useSignUp): a password
 * reset request never changes the current session, so there is nothing to
 * update. ForgotPasswordPage shows the same success state regardless of
 * whether the email actually belongs to an account - see
 * SessionRepository.requestPasswordReset's own doc comment for why that is
 * correct, not a gap: Supabase itself never distinguishes the two cases in
 * its response, to avoid account enumeration.
 */
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (email: string) => sessionRepository.requestPasswordReset(email),
  })
}

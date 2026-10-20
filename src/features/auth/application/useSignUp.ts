import { useMutation, useQueryClient } from '@tanstack/react-query'
import { sessionRepository } from '../composition'
import type { AuthSession, SessionAuthError, SessionCredentials, SignUpOptions } from '../domain/session.types'
import { authQueryKeys } from './auth-query-keys'

/** SessionCredentials plus the one optional extra signUp itself accepts, folded in here rather than a second mutate() argument. */
type SignUpVariables = SessionCredentials & SignUpOptions

/**
 * Mirrors useLogin exactly (see its own doc comment): eagerly writes the
 * returned session into the query cache on success so the UI reacts
 * immediately, instead of waiting on the asynchronous onAuthStateChange round
 * trip that AuthSessionListener also reacts to.
 */
export function useSignUp() {
  const queryClient = useQueryClient()

  return useMutation<AuthSession, SessionAuthError, SignUpVariables>({
    // Calls with exactly one argument when no fullName is given (never an
    // explicit trailing `undefined`) - byte-for-byte the same call
    // InvitationClaimPage's sign-up tab already made before this change.
    mutationFn: ({ fullName, ...credentials }) =>
      fullName ? sessionRepository.signUp(credentials, { fullName }) : sessionRepository.signUp(credentials),
    onSuccess: (session) => {
      queryClient.setQueryData(authQueryKeys.session, session)
    },
  })
}

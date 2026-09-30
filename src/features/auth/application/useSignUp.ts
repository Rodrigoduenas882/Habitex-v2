import { useMutation, useQueryClient } from '@tanstack/react-query'
import { sessionRepository } from '../composition'
import type { AuthSession, SessionAuthError, SessionCredentials } from '../domain/session.types'
import { authQueryKeys } from './auth-query-keys'

/**
 * Mirrors useLogin exactly (see its own doc comment): eagerly writes the
 * returned session into the query cache on success so the UI reacts
 * immediately, instead of waiting on the asynchronous onAuthStateChange round
 * trip that AuthSessionListener also reacts to.
 */
export function useSignUp() {
  const queryClient = useQueryClient()

  return useMutation<AuthSession, SessionAuthError, SessionCredentials>({
    mutationFn: (credentials) => sessionRepository.signUp(credentials),
    onSuccess: (session) => {
      queryClient.setQueryData(authQueryKeys.session, session)
    },
  })
}

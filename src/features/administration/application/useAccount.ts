import { useQuery } from '@tanstack/react-query'
import { accountRepository } from '../composition'
import { administrationQueryKeys } from './administration-query-keys'

/** The account of the currently authenticated person, or null if none exists yet. */
export function useAccount() {
  return useQuery({
    queryKey: administrationQueryKeys.account,
    queryFn: () => accountRepository.getCurrentAccount(),
  })
}

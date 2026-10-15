import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AdministrationFeeMode, UtilitiesResponsibility } from '../domain/rental-terms.types'
import type { PaymentTiming } from '../domain/rental.types'
import { rentalRepository, rentalTermsRepository } from '../composition'
import { rentalQueryKeys } from './rental-query-keys'

export interface SaveRentalTermsInput {
  administrationId: string
  relationshipId: string
  realStartDate: string
  trackingStartDate: string
  paymentDay: number
  paymentTiming: PaymentTiming
  expectedEndDate: string | null
  rentAmount: number
  administrationMode: AdministrationFeeMode
  utilitiesMode: UtilitiesResponsibility | null
}

/**
 * There is no RPC wrapping updateSchedule + rentalTermsRepository.create
 * into one transaction (see RentalRepository.updateSchedule's own doc
 * comment) - this mutation cannot be atomic from the client, and this
 * increment is not authorized to add a new RPC/migration to make it so.
 *
 * Thrown only when step 1 (updateSchedule) already succeeded and step 2
 * (rentalTermsRepository.create) then failed - i.e. the dates/payment
 * schedule ARE already saved, only the financial terms are missing. If step
 * 1 itself fails, its raw error propagates unwrapped instead (nothing was
 * saved at all). Callers distinguish "nothing saved yet" from "schedule
 * saved, rent amount still missing" with `error instanceof
 * SaveRentalTermsError` - retrying "from scratch" in the second case would
 * otherwise resubmit already-successful data and confuse the user about
 * what actually happened.
 */
export class SaveRentalTermsError extends Error {
  constructor(cause: unknown) {
    super('The schedule was saved, but creating the rental term version failed')
    this.name = 'SaveRentalTermsError'
    this.cause = cause
  }
}

/**
 * Sequences the two writes "Rental Terms" actually requires (see this
 * increment's own research notes): first updateSchedule (the 4
 * rental_relationships columns activate_rental_relationship needs), then
 * rentalTermsRepository.create (the first rental_term_versions row), using
 * realStartDate as both the schedule's realStartDate and the term
 * version's effectiveFrom (not collected twice - see RentalScheduleInput's
 * own doc comment).
 *
 * If step 1 throws, the raw error propagates as-is (nothing was saved). If
 * step 2 throws after step 1 succeeded, throws SaveRentalTermsError instead,
 * so the UI can distinguish "nothing saved" from "dates saved, rent amount
 * still missing".
 *
 * On success (both writes complete), invalidates this relationship's terms
 * query key and the administration's rentals list (already displays
 * realStartDate/paymentDay/paymentTiming when present).
 */
export function useSaveRentalTerms() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SaveRentalTermsInput) => {
      await rentalRepository.updateSchedule(input.relationshipId, {
        realStartDate: input.realStartDate,
        trackingStartDate: input.trackingStartDate,
        paymentDay: input.paymentDay,
        paymentTiming: input.paymentTiming,
        expectedEndDate: input.expectedEndDate,
      })

      try {
        return await rentalTermsRepository.create({
          rentalRelationshipId: input.relationshipId,
          effectiveFrom: input.realStartDate,
          rentAmount: input.rentAmount,
          administrationMode: input.administrationMode,
          utilitiesMode: input.utilitiesMode,
        })
      } catch (error) {
        throw new SaveRentalTermsError(error)
      }
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: rentalQueryKeys.terms(variables.administrationId, variables.relationshipId),
      })
      void queryClient.invalidateQueries({ queryKey: rentalQueryKeys.list(variables.administrationId) })
    },
  })
}

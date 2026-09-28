import { z } from 'zod'
import type { TFunction } from 'i18next'

/**
 * Same shape principle as payment-report-form.ts's own doc comment: amount
 * stays a string in the form (native <input> value), parsed with Number()
 * only at submit time - never z.coerce. `maximum` is a schema-factory
 * parameter (same dynamic-bound pattern as rentalTermsFormSchema(t) taking
 * `t`, generalized here to a numeric bound) since the maximum allocatable
 * amount (min(paymentRemainingAmount, charge.balance)) changes per selected
 * charge and can't be a static schema constant. Two separate refinements so
 * "invalid/empty" and "exceeds the maximum" get distinct copy - mirrors
 * allocate_payment's own two distinct guards (ALLOCATION_EXCEEDS_PAYMENT/
 * ALLOCATION_EXCEEDS_CHARGE) being surfaced as this component's own
 * server-side fallback for the same class of failure.
 */
export function paymentAllocationFormSchema(t: TFunction<'payments'>, maximum: number) {
  return z
    .object({ amount: z.string() })
    .refine(
      (values) => {
        if (values.amount.trim() === '') return false
        const parsed = Number(values.amount)
        return Number.isFinite(parsed) && parsed > 0
      },
      { message: t('card.allocations.form.validation.amountInvalid'), path: ['amount'] },
    )
    .refine(
      (values) => {
        const parsed = Number(values.amount)
        if (!Number.isFinite(parsed) || parsed <= 0) return true
        return parsed <= maximum
      },
      { message: t('card.allocations.form.validation.amountExceedsMaximum'), path: ['amount'] },
    )
}

export type PaymentAllocationFormValues = z.infer<ReturnType<typeof paymentAllocationFormSchema>>

export const PAYMENT_ALLOCATION_FORM_DEFAULTS: PaymentAllocationFormValues = {
  amount: '',
}

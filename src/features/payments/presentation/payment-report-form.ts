import { z } from 'zod'
import type { TFunction } from 'i18next'
import type { ReportPaymentInput } from '../domain/payment.types'

/**
 * Same shape principle as rental-terms-form.ts/property-base-form.ts:
 * amount stays a string in the form (native <input> value), parsed with
 * Number() only at validation/mapping time - never z.coerce, so an
 * invalid/empty string surfaces its own validation message instead of
 * silently becoming NaN/0. paymentMethod follows utilitiesMode's own
 * "empty string means unset" convention - '' is a valid, deliberate
 * selection ("no especifico"), mapped to undefined only in
 * toReportPaymentInput.
 */
export function paymentReportFormSchema(t: TFunction<'payments'>) {
  return z
    .object({
      amount: z.string(),
      paymentDate: z.string(),
      paymentMethod: z.enum(['', 'BANK_TRANSFER', 'CASH', 'DIGITAL_WALLET', 'OTHER']),
      externalReference: z.string(),
      notes: z.string(),
    })
    .refine((values) => values.paymentDate.trim() !== '', {
      message: t('reportForm.validation.paymentDateRequired'),
      path: ['paymentDate'],
    })
    .refine(
      // Mirrors report_payment's own INVALID_AMOUNT check (p_amount <= 0)
      // client-side.
      (values) => {
        if (values.amount.trim() === '') return false
        const parsed = Number(values.amount)
        return Number.isFinite(parsed) && parsed > 0
      },
      { message: t('reportForm.validation.amountInvalid'), path: ['amount'] },
    )
}

export type PaymentReportFormValues = z.infer<ReturnType<typeof paymentReportFormSchema>>

export const PAYMENT_REPORT_FORM_DEFAULTS: PaymentReportFormValues = {
  amount: '',
  paymentDate: '',
  paymentMethod: '',
  externalReference: '',
  notes: '',
}

/**
 * Does not carry proofFileId - that value comes from a separate, local
 * (non-RHF) file-upload orchestration in the presentation layer (see
 * RentalPaymentsPage's own doc comment) and is merged in by the caller.
 * Builds paymentMethod/externalReference/notes conditionally (never
 * assigning an explicit `undefined`) since ReportPaymentInput's optional
 * fields are plain `?:` under this project's exactOptionalPropertyTypes -
 * an absent property, not a present-but-undefined one.
 */
export function toReportPaymentInput(
  values: PaymentReportFormValues,
  administrationId: string,
  relationshipId: string,
): ReportPaymentInput {
  const externalReference = values.externalReference.trim()
  const notes = values.notes.trim()

  return {
    administrationId,
    rentalRelationshipId: relationshipId,
    amount: Number(values.amount),
    paymentDate: values.paymentDate,
    ...(values.paymentMethod !== '' ? { paymentMethod: values.paymentMethod } : {}),
    ...(externalReference !== '' ? { externalReference } : {}),
    ...(notes !== '' ? { notes } : {}),
  }
}

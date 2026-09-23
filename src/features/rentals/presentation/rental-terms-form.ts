import { z } from 'zod'
import type { TFunction } from 'i18next'
import type { SaveRentalTermsInput } from '../application/useSaveRentalTerms'

/**
 * Same shape principle as property-base-form.ts/add-rental-draft-form.ts:
 * numeric fields stay strings in the form (native <input> values), parsed
 * with Number() only at validation/mapping time - never z.coerce, so an
 * invalid/empty string surfaces its own validation message instead of
 * silently becoming NaN/0.
 */
export function rentalTermsFormSchema(t: TFunction<'rentals'>) {
  return z
    .object({
      realStartDate: z.string(),
      trackingStartDate: z.string(),
      paymentDay: z.string(),
      paymentTiming: z.enum(['ADVANCE', 'ARREARS']),
      expectedEndDate: z.string(),
      rentAmount: z.string(),
      administrationMode: z.enum(['NONE', 'INCLUDED', 'TENANT_DIRECT']),
      utilitiesMode: z.enum(['', 'TENANT', 'LESSOR', 'SPECIAL_AGREEMENT']),
    })
    .refine((values) => values.realStartDate.trim() !== '', {
      message: t('termsForm.validation.realStartDateRequired'),
      path: ['realStartDate'],
    })
    .refine((values) => values.trackingStartDate.trim() !== '', {
      message: t('termsForm.validation.trackingStartDateRequired'),
      path: ['trackingStartDate'],
    })
    .refine(
      // Mirrors the DB's own effective_from/tracking ordering principle
      // client-side - ISO 'YYYY-MM-DD' strings sort correctly lexically, so
      // a plain string comparison is exact, no Date parsing needed.
      (values) => {
        if (values.realStartDate.trim() === '' || values.trackingStartDate.trim() === '') return true
        return values.trackingStartDate >= values.realStartDate
      },
      { message: t('termsForm.validation.trackingStartDateBeforeReal'), path: ['trackingStartDate'] },
    )
    .refine(
      (values) => {
        if (values.paymentDay.trim() === '') return false
        const parsed = Number(values.paymentDay)
        return Number.isInteger(parsed) && parsed >= 1 && parsed <= 31
      },
      { message: t('termsForm.validation.paymentDayInvalid'), path: ['paymentDay'] },
    )
    .refine(
      (values) => {
        if (values.rentAmount.trim() === '') return false
        const parsed = Number(values.rentAmount)
        return Number.isFinite(parsed) && parsed >= 0
      },
      { message: t('termsForm.validation.rentAmountInvalid'), path: ['rentAmount'] },
    )
    .refine(
      (values) => {
        if (values.expectedEndDate.trim() === '' || values.realStartDate.trim() === '') return true
        return values.expectedEndDate >= values.realStartDate
      },
      { message: t('termsForm.validation.expectedEndDateBeforeReal'), path: ['expectedEndDate'] },
    )
}

export type RentalTermsFormValues = z.infer<ReturnType<typeof rentalTermsFormSchema>>

export const RENTAL_TERMS_FORM_DEFAULTS: RentalTermsFormValues = {
  realStartDate: '',
  trackingStartDate: '',
  paymentDay: '',
  paymentTiming: 'ADVANCE',
  expectedEndDate: '',
  rentAmount: '',
  administrationMode: 'NONE',
  utilitiesMode: '',
}

export function toSaveRentalTermsInput(
  values: RentalTermsFormValues,
  administrationId: string,
  relationshipId: string,
): SaveRentalTermsInput {
  return {
    administrationId,
    relationshipId,
    realStartDate: values.realStartDate,
    trackingStartDate: values.trackingStartDate,
    paymentDay: Number(values.paymentDay),
    paymentTiming: values.paymentTiming,
    expectedEndDate: values.expectedEndDate.trim() === '' ? null : values.expectedEndDate,
    rentAmount: Number(values.rentAmount),
    administrationMode: values.administrationMode,
    utilitiesMode: values.utilitiesMode === '' ? null : values.utilitiesMode,
  }
}

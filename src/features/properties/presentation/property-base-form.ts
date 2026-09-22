import { z } from 'zod'
import type { TFunction } from 'i18next'
import type { CreatePropertyInput } from '../domain/property.types'

/**
 * Shared by AddFullPropertyForm and AddRoomRentalPropertyForm - same base
 * fields, different RPC/mutation per screen (see PropertyRepository's doc
 * comment for why createFullProperty/createRoomRentalProperty stay separate
 * methods). Sharing the schema/fields here is not a "form engine": each
 * screen still owns its own useForm, submit handler and mutation.
 */
export function propertyBaseFormSchema(t: TFunction<'properties'>) {
  return z
    .object({
      propertyType: z.enum(['HOUSE', 'APARTMENT']),
      name: z.string().min(1, t('form.validation.nameRequired')),
      address: z.string().min(1, t('form.validation.addressRequired')),
      city: z.string().min(1, t('form.validation.cityRequired')),
      hasAdministration: z.enum(['yes', 'no']),
      administrationFee: z.string(),
    })
    .refine(
      (values) => {
        if (values.hasAdministration !== 'yes') return true
        if (values.administrationFee.trim() === '') return false
        const parsed = Number(values.administrationFee)
        return Number.isFinite(parsed) && parsed >= 0
      },
      { message: t('form.validation.administrationFeeRequired'), path: ['administrationFee'] },
    )
}

export type PropertyBaseFormValues = z.infer<ReturnType<typeof propertyBaseFormSchema>>

export const PROPERTY_BASE_FORM_DEFAULTS: PropertyBaseFormValues = {
  propertyType: 'APARTMENT',
  name: '',
  address: '',
  city: '',
  hasAdministration: 'no',
  administrationFee: '',
}

/** MVP Colombia only - see this form's own country field, deliberately not editable. */
const COUNTRY_CODE = 'CO'

export function toCreatePropertyInput(
  values: PropertyBaseFormValues,
): Omit<CreatePropertyInput, 'administrationId'> {
  const hasAdministration = values.hasAdministration === 'yes'

  return {
    propertyType: values.propertyType,
    name: values.name,
    address: values.address,
    city: values.city,
    countryCode: COUNTRY_CODE,
    hasAdministration,
    administrationFee: hasAdministration ? Number(values.administrationFee) : null,
  }
}

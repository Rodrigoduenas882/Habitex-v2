import { z } from 'zod'
import type { TFunction } from 'i18next'
import type { CreateParkingInput } from '../domain/parking.types'

export function parkingFormSchema(t: TFunction<'parking'>) {
  return z
    .object({
      associated: z.enum(['yes', 'no']),
      propertyId: z.string(),
      identifier: z.string(),
      location: z.string(),
      covered: z.enum(['', 'yes', 'no']),
      vehicleType: z.enum(['', 'CAR', 'MOTORCYCLE', 'BOTH']),
      accessType: z.string(),
      observations: z.string(),
    })
    .refine((values) => values.identifier.trim().length > 0, {
      message: t('form.validation.identifierRequired'),
      path: ['identifier'],
    })
    .refine((values) => values.associated !== 'yes' || values.propertyId !== '', {
      message: t('form.validation.propertyRequired'),
      path: ['propertyId'],
    })
}

export type ParkingFormValues = z.infer<ReturnType<typeof parkingFormSchema>>

export const PARKING_FORM_DEFAULTS: ParkingFormValues = {
  associated: 'no',
  propertyId: '',
  identifier: '',
  location: '',
  covered: '',
  vehicleType: '',
  accessType: '',
  observations: '',
}

export function toCreateParkingInput(
  values: ParkingFormValues,
): Omit<CreateParkingInput, 'administrationId'> {
  return {
    propertyId: values.associated === 'yes' && values.propertyId !== '' ? values.propertyId : null,
    identifier: values.identifier,
    location: values.location.trim() === '' ? null : values.location,
    covered: values.covered === '' ? null : values.covered === 'yes',
    allowedVehicleType: values.vehicleType === '' ? null : values.vehicleType,
    accessType: values.accessType.trim() === '' ? null : values.accessType,
    observations: values.observations.trim() === '' ? null : values.observations,
  }
}

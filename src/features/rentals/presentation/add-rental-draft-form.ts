import { z } from 'zod'
import type { TFunction } from 'i18next'
import type { CreateRentalDraftInput, RentalDraftTenantInput } from '../domain/rental.types'

/** MVP default - editable, unlike Property's locked country field, because
 * create_rental_draft must accept foreign tenants too. */
const DEFAULT_COUNTRY = 'CO'

/**
 * document_type is confirmed `text` (not a Postgres enum) on
 * create_tenant_person/create_rental_draft - there is no backend-confirmed
 * fixed list of values. CC/CE are unambiguous (cédula de ciudadanía/
 * extranjería, standard Colombian document types). PASSPORT has NO
 * confirmed backend convention anywhere in this repo or prior session
 * context - this is the minimal, spelled-out value chosen in the absence of
 * one (not an assumed enum member). Flag this to the backend team before
 * relying on it for anything beyond this form.
 */
export const DOCUMENT_TYPE_OPTIONS = ['CC', 'CE', 'PASSPORT'] as const

/**
 * Minimal seed catalog - MVP only needs Colombia today, but the shape
 * (code + i18n-looked-up label) is what lets a future country get added by
 * appending one entry here (+ one i18n key) without touching
 * AddRentalDraftForm's contract or markup at all.
 */
export const COUNTRY_OPTIONS = ['CO'] as const

/**
 * documentCountry defaults to 'CO' as a convenience for when the admin DOES
 * fill in document info - but that default must never, by itself, trigger
 * the backend's "document_type/document_number/document_country all null or
 * all informed" rule. Intent is judged from documentType/documentNumber
 * only: if neither is filled, documentCountry's pre-filled default is
 * ignored both by validation and by what gets sent to create_rental_draft.
 */
function hasDocumentIntent(values: Pick<AddRentalDraftFormValues, 'documentType' | 'documentNumber'>): boolean {
  return values.documentType.trim() !== '' || values.documentNumber.trim() !== ''
}

export function addRentalDraftFormSchema(t: TFunction<'rentals'>) {
  return z
    .object({
      rentalSubjectId: z.string(),
      tenantMode: z.enum(['existing', 'new']),
      existingTenantPersonId: z.string(),
      fullName: z.string(),
      documentType: z.string(),
      documentNumber: z.string(),
      documentCountry: z.string(),
      nationalityCountry: z.string(),
      email: z.string(),
      phone: z.string(),
    })
    .refine((values) => values.rentalSubjectId !== '', {
      message: t('form.validation.subjectRequired'),
      path: ['rentalSubjectId'],
    })
    .refine((values) => values.tenantMode !== 'existing' || values.existingTenantPersonId !== '', {
      message: t('form.validation.existingTenantRequired'),
      path: ['existingTenantPersonId'],
    })
    .refine((values) => values.tenantMode !== 'new' || values.fullName.trim() !== '', {
      message: t('form.validation.fullNameRequired'),
      path: ['fullName'],
    })
    .refine(
      (values) => {
        if (values.tenantMode !== 'new' || !hasDocumentIntent(values)) return true
        return values.documentType.trim() !== '' && values.documentNumber.trim() !== '' && values.documentCountry.trim() !== ''
      },
      { message: t('form.validation.documentAllOrNothing'), path: ['documentNumber'] },
    )
    .refine(
      (values) => {
        if (values.tenantMode !== 'new' || values.email.trim() === '') return true
        return z.email().safeParse(values.email.trim()).success
      },
      { message: t('form.validation.emailInvalid'), path: ['email'] },
    )
}

export type AddRentalDraftFormValues = z.infer<ReturnType<typeof addRentalDraftFormSchema>>

export const ADD_RENTAL_DRAFT_FORM_DEFAULTS: AddRentalDraftFormValues = {
  rentalSubjectId: '',
  tenantMode: 'new',
  existingTenantPersonId: '',
  fullName: '',
  documentType: '',
  documentNumber: '',
  documentCountry: DEFAULT_COUNTRY,
  nationalityCountry: DEFAULT_COUNTRY,
  email: '',
  phone: '',
}

function toTenantInput(values: AddRentalDraftFormValues): RentalDraftTenantInput {
  if (values.tenantMode === 'existing') {
    return { kind: 'existing', personId: values.existingTenantPersonId }
  }

  const documentIntent = hasDocumentIntent(values)

  return {
    kind: 'new',
    fullName: values.fullName.trim(),
    // documentCountry's 'CO' default is only ever sent alongside real
    // documentType/documentNumber values - never alone (see
    // hasDocumentIntent's own doc comment).
    documentType: documentIntent ? values.documentType.trim() || null : null,
    documentNumber: documentIntent ? values.documentNumber.trim() || null : null,
    documentCountry: documentIntent ? values.documentCountry.trim() || null : null,
    nationalityCountry: values.nationalityCountry.trim() === '' ? null : values.nationalityCountry.trim(),
    email: values.email.trim() === '' ? null : values.email.trim(),
    phone: values.phone.trim() === '' ? null : values.phone.trim(),
  }
}

export function toCreateRentalDraftInput(
  values: AddRentalDraftFormValues,
  administrationId: string,
): CreateRentalDraftInput {
  return {
    administrationId,
    rentalSubjectId: values.rentalSubjectId,
    tenant: toTenantInput(values),
  }
}

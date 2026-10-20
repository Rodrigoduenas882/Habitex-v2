import { z } from 'zod'
import type { TFunction } from 'i18next'
import type { BootstrapAccountInput } from '../domain/administration.types'

/**
 * Same molde as properties/presentation/property-base-form.ts: a schema
 * factory that receives `t`, plus defaults and a mapper to the port's input
 * shape. administrationName stays a plain (untrimmed-required) string - it's
 * optional on BootstrapAccountInput, the backend already defaults to "Mi
 * administración" when it's blank (see bootstrap_account RPC / the account
 * repository), so this form never invents its own default.
 */
export function bootstrapAccountFormSchema(t: TFunction<'administration'>) {
  return z.object({
    fullName: z.string().trim().min(1, t('bootstrap.validation.fullNameRequired')),
    administrationName: z.string(),
  })
}

export type BootstrapAccountFormValues = z.infer<ReturnType<typeof bootstrapAccountFormSchema>>

/**
 * Pre-fills fullName from the signed-in session's own user_metadata (see
 * AuthSession.fullNameFromMetadata's own doc comment: a UX convenience
 * only, never trusted as verified data) when the owner already gave their
 * name at /signup - still fully editable here, never auto-submitted
 * without the user seeing/confirming it. Falls back to the empty default
 * exactly like before when metadata has no name (accounts created before
 * this field existed, or a future signup path that never collected one).
 */
export function bootstrapAccountFormDefaults(fullNameFromMetadata: string | null | undefined): BootstrapAccountFormValues {
  return {
    fullName: fullNameFromMetadata ?? '',
    administrationName: '',
  }
}

export function toBootstrapAccountInput(values: BootstrapAccountFormValues): BootstrapAccountInput {
  const administrationName = values.administrationName.trim()

  return {
    fullName: values.fullName.trim(),
    ...(administrationName ? { administrationName } : {}),
  }
}

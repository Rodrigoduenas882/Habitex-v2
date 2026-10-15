import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useManagementGate } from '@/features/administration/application/useManagementGate'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { useCreateFullProperty } from '../application/useCreateFullProperty'
import styles from './AddPropertyPage.module.css'
import { PropertyBaseFormFields } from './PropertyBaseFormFields'
import {
  PROPERTY_BASE_FORM_DEFAULTS,
  propertyBaseFormSchema,
  toCreatePropertyInput,
  type PropertyBaseFormValues,
} from './property-base-form'

export interface AddFullPropertyFormProps {
  administrationId: string
  onBack: () => void
}

/** "Casa o apartamento completo" - calls createFullProperty (FULL_PROPERTY, implied). */
export function AddFullPropertyForm({ administrationId, onBack }: AddFullPropertyFormProps) {
  const { t } = useTranslation(['properties', 'administration'])
  const navigate = useNavigate()
  const createFullProperty = useCreateFullProperty(administrationId)
  const managementGate = useManagementGate(administrationId)

  const schema = propertyBaseFormSchema(t)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PropertyBaseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: PROPERTY_BASE_FORM_DEFAULTS,
    shouldUnregister: false,
  })
  const hasAdministration = watch('hasAdministration') === 'yes'

  const onSubmit = handleSubmit((values) => {
    createFullProperty.mutate(toCreatePropertyInput(values), {
      onSuccess: () => {
        void navigate('/properties')
      },
    })
  })

  return (
    <div className={styles['page']}>
      <button type="button" className={styles['back']} onClick={onBack}>
        {t('addProperty.back')}
      </button>
      <h1 className="text-h2">{t('addProperty.optionFull.title')}</h1>

      {createFullProperty.isError ? <Alert tone="danger">{t('form.errors.createFailed')}</Alert> : null}

      <form
        onSubmit={(event) => {
          void onSubmit(event)
        }}
        noValidate
        className={styles['form']}
      >
        <PropertyBaseFormFields
          register={register}
          errors={errors}
          hasAdministration={hasAdministration}
          disabled={createFullProperty.isPending}
        />
        <Button
          type="submit"
          loading={createFullProperty.isPending}
          disabled={managementGate.blocked || createFullProperty.isPending}
          aria-disabled={managementGate.blocked ? 'true' : undefined}
          className={styles['submit']}
        >
          {createFullProperty.isPending ? t('form.submitting') : t('form.submitFull')}
        </Button>
        {managementGate.blocked ? (
          <p className="text-caption text-muted">{t('administration:managementAccessGate.blocked')}</p>
        ) : null}
      </form>
    </div>
  )
}

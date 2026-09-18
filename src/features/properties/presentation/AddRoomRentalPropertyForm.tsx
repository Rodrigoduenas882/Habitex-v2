import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { useCreateRoomRentalProperty } from '../application/useCreateRoomRentalProperty'
import styles from './AddPropertyPage.module.css'
import { PropertyBaseFormFields } from './PropertyBaseFormFields'
import {
  PROPERTY_BASE_FORM_DEFAULTS,
  propertyBaseFormSchema,
  toCreatePropertyInput,
  type PropertyBaseFormValues,
} from './property-base-form'

export interface AddRoomRentalPropertyFormProps {
  administrationId: string
  onBack: () => void
}

/**
 * "Habitaciones de una propiedad" - calls createRoomRentalProperty
 * (BY_ROOMS, implied). Does not go back to /properties on success - it
 * continues straight to configuring rooms, since a BY_ROOMS property with
 * zero rooms isn't a usable state yet.
 */
export function AddRoomRentalPropertyForm({ administrationId, onBack }: AddRoomRentalPropertyFormProps) {
  const { t } = useTranslation('properties')
  const navigate = useNavigate()
  const createRoomRentalProperty = useCreateRoomRentalProperty(administrationId)

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
    createRoomRentalProperty.mutate(toCreatePropertyInput(values), {
      onSuccess: (property) => {
        // No navigation state - RoomSetupPage relies on useRooms(propertyId)
        // (the backend) as the sole authority for room count, not on how
        // the visitor got here. See RoomSetupPage's own doc comment.
        void navigate(`/properties/${property.id}/rooms/setup`)
      },
    })
  })

  return (
    <div className={styles['page']}>
      <button type="button" className={styles['back']} onClick={onBack}>
        {t('addProperty.back')}
      </button>
      <h1 className="text-h2">{t('addProperty.optionRooms.title')}</h1>

      {createRoomRentalProperty.isError ? (
        <Alert tone="danger">{t('form.errors.createFailed')}</Alert>
      ) : null}

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
          disabled={createRoomRentalProperty.isPending}
        />
        <Button type="submit" loading={createRoomRentalProperty.isPending} className={styles['submit']}>
          {createRoomRentalProperty.isPending ? t('form.submitting') : t('form.submitRooms')}
        </Button>
      </form>
    </div>
  )
}

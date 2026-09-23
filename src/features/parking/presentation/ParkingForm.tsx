import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useManagementGate } from '@/features/administration/application/useManagementGate'
import { useProperties } from '@/features/properties/application/useProperties'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Textarea } from '@/shared/ui/Textarea'
import { useCreateParking } from '../application/useCreateParking'
import styles from './ParkingForm.module.css'
import {
  PARKING_FORM_DEFAULTS,
  parkingFormSchema,
  toCreateParkingInput,
  type ParkingFormValues,
} from './parking-form'

export interface ParkingFormProps {
  administrationId: string
  onBack: () => void
}

/**
 * "Parqueadero" - calls ParkingRepository.create. Reuses
 * features/properties' useProperties for the optional association selector
 * (not moved, not duplicated). A parking now genuinely appears in
 * /properties (Parqueaderos section, via useParkings) once its query is
 * invalidated on success - but success still doesn't navigate
 * automatically. The explicit confirmation + manual "Volver a inmuebles" is
 * kept as the better UX on its own merits (it names what was just saved
 * instead of relying on the visitor to spot it in a list), not as a
 * workaround for a screen that couldn't show it yet.
 */
export function ParkingForm({ administrationId, onBack }: ParkingFormProps) {
  const { t } = useTranslation(['parking', 'properties', 'administration'])
  const navigate = useNavigate()
  const createParking = useCreateParking()
  const managementGate = useManagementGate(administrationId)
  const propertiesQuery = useProperties(administrationId)
  const properties = propertiesQuery.data ?? []

  const schema = parkingFormSchema(t)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ParkingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: PARKING_FORM_DEFAULTS,
    shouldUnregister: false,
  })
  const isAssociated = watch('associated') === 'yes'
  // "Sí" is only a trustworthy choice once we know for certain there is at
  // least one real property to associate - not while that's still loading,
  // failed, or confirmed empty.
  const associationUnavailable = propertiesQuery.isLoading || propertiesQuery.isError || properties.length === 0

  const onSubmit = handleSubmit((values) => {
    createParking.mutate({ ...toCreateParkingInput(values), administrationId })
  })

  if (createParking.isSuccess) {
    return (
      <div className={styles['page']}>
        <Alert tone="success" title={t('success.title')}>
          {t('success.description', { identifier: createParking.variables.identifier })}
        </Alert>
        <Button
          onClick={() => {
            void navigate('/properties')
          }}
        >
          {t('success.back')}
        </Button>
      </div>
    )
  }

  return (
    <div className={styles['page']}>
      <button type="button" className={styles['back']} onClick={onBack}>
        {t('properties:addProperty.back')}
      </button>
      <h1 className="text-h2">{t('form.title')}</h1>

      {createParking.isError ? <Alert tone="danger">{t('form.errors.createFailed')}</Alert> : null}

      <form
        onSubmit={(event) => {
          void onSubmit(event)
        }}
        noValidate
        className={styles['form']}
      >
        <h2 className="text-h3">{t('form.sectionAssociation')}</h2>

        <Select label={t('form.associated.label')} disabled={createParking.isPending} {...register('associated')}>
          <option value="no">{t('form.associated.no')}</option>
          <option value="yes" disabled={associationUnavailable}>
            {t('form.associated.yes')}
          </option>
        </Select>

        {associationUnavailable ? (
          <p className="text-caption text-muted">
            {propertiesQuery.isLoading
              ? t('form.property.loadingHint')
              : propertiesQuery.isError
                ? t('form.property.errorHint')
                : t('form.property.emptyHint')}
          </p>
        ) : null}

        {isAssociated && !associationUnavailable ? (
          <Select
            label={t('form.property.label')}
            error={errors.propertyId?.message}
            disabled={createParking.isPending}
            {...register('propertyId')}
          >
            <option value="">{t('form.property.placeholder')}</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </Select>
        ) : null}

        <h2 className="text-h3">{t('form.sectionDetails')}</h2>

        <Input
          label={t('form.identifier.label')}
          hint={t('form.identifier.hint')}
          error={errors.identifier?.message}
          disabled={createParking.isPending}
          {...register('identifier')}
        />

        <Input
          label={t('form.location.label')}
          disabled={createParking.isPending}
          {...register('location')}
        />

        <Select label={t('form.covered.label')} disabled={createParking.isPending} {...register('covered')}>
          <option value="">{t('form.covered.unspecified')}</option>
          <option value="yes">{t('form.covered.yes')}</option>
          <option value="no">{t('form.covered.no')}</option>
        </Select>

        <Select
          label={t('form.vehicleType.label')}
          disabled={createParking.isPending}
          {...register('vehicleType')}
        >
          <option value="">{t('form.vehicleType.unspecified')}</option>
          <option value="CAR">{t('form.vehicleType.CAR')}</option>
          <option value="MOTORCYCLE">{t('form.vehicleType.MOTORCYCLE')}</option>
          <option value="BOTH">{t('form.vehicleType.BOTH')}</option>
        </Select>

        <Input
          label={t('form.accessType.label')}
          disabled={createParking.isPending}
          {...register('accessType')}
        />

        <Textarea
          label={t('form.observations.label')}
          disabled={createParking.isPending}
          {...register('observations')}
        />

        <Button
          type="submit"
          loading={createParking.isPending}
          disabled={managementGate.blocked || createParking.isPending}
          aria-disabled={managementGate.blocked ? 'true' : undefined}
          className={styles['submit']}
        >
          {createParking.isPending ? t('form.submitting') : t('form.submit')}
        </Button>
        {managementGate.blocked ? (
          <p className="text-caption text-muted">{t('administration:managementAccessGate.blocked')}</p>
        ) : null}
      </form>
    </div>
  )
}

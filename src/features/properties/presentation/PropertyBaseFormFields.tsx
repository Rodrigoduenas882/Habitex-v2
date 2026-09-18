import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import fieldStyles from '@/shared/ui/Field.module.css'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import type { PropertyBaseFormValues } from './property-base-form'

export interface PropertyBaseFormFieldsProps {
  register: UseFormRegister<PropertyBaseFormValues>
  errors: FieldErrors<PropertyBaseFormValues>
  hasAdministration: boolean
  disabled: boolean
}

/**
 * The fields shared by "Casa o apartamento completo" and "Habitaciones de
 * una propiedad" - see property-base-form.ts for why this is a shared
 * presentational piece, not a shared mutation.
 */
export function PropertyBaseFormFields({
  register,
  errors,
  hasAdministration,
  disabled,
}: PropertyBaseFormFieldsProps) {
  const { t } = useTranslation('properties')

  return (
    <>
      <h2 className="text-h3">{t('form.sectionInfo')}</h2>

      <Select label={t('form.propertyType.label')} disabled={disabled} {...register('propertyType')}>
        <option value="APARTMENT">{t('propertyType.APARTMENT')}</option>
        <option value="HOUSE">{t('propertyType.HOUSE')}</option>
      </Select>

      <Input
        label={t('form.name.label')}
        hint={t('form.name.hint')}
        error={errors.name?.message}
        disabled={disabled}
        {...register('name')}
      />

      <Input
        label={t('form.address.label')}
        error={errors.address?.message}
        disabled={disabled}
        {...register('address')}
      />

      <Input
        label={t('form.city.label')}
        error={errors.city?.message}
        disabled={disabled}
        {...register('city')}
      />

      {/* Not an editable control on purpose - MVP Colombia only. */}
      <div className={fieldStyles['field']}>
        <span className={fieldStyles['label']}>{t('form.country.label')}</span>
        <p>{t('form.country.value')}</p>
      </div>

      <h2 className="text-h3">{t('form.sectionCosts')}</h2>

      <Select
        label={t('form.hasAdministration.label')}
        disabled={disabled}
        {...register('hasAdministration')}
      >
        <option value="no">{t('form.hasAdministration.no')}</option>
        <option value="yes">{t('form.hasAdministration.yes')}</option>
      </Select>

      {hasAdministration ? (
        <Input
          type="number"
          min={0}
          step="any"
          label={t('form.administrationFee.label')}
          error={errors.administrationFee?.message}
          disabled={disabled}
          {...register('administrationFee')}
        />
      ) : null}
    </>
  )
}

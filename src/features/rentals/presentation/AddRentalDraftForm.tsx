import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useManagementGate } from '@/features/administration/application/useManagementGate'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Skeleton } from '@/shared/ui/Skeleton'
import {
  ADD_RENTAL_DRAFT_FORM_DEFAULTS,
  addRentalDraftFormSchema,
  toCreateRentalDraftInput,
  COUNTRY_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
  type AddRentalDraftFormValues,
} from './add-rental-draft-form'
import styles from './AddRentalDraftForm.module.css'
import { useCreateRentalDraft } from '../application/useCreateRentalDraft'
import { useRentalSubjects } from '../application/useRentalSubjects'
import { useTenantCandidates } from '../application/useTenantCandidates'
import type { RentalSubjectType } from '../domain/rental-subject.types'

export interface AddRentalDraftFormProps {
  administrationId: string
  subjectType: RentalSubjectType
  onBack: () => void
}

/**
 * The actual "¿A quién se lo arriendas?" + subject picker + Continuar step,
 * once a subjectType has been chosen. Fetches the real rental_subjects for
 * that category (never fabricated from Property/Room/Parking) and the real
 * tenant candidates already linked to this administration. Nothing is
 * written to the backend until Continuar is pressed - create_rental_draft
 * is the only mutation this form performs.
 */
export function AddRentalDraftForm({ administrationId, subjectType, onBack }: AddRentalDraftFormProps) {
  const { t } = useTranslation(['rentals', 'administration'])
  const navigate = useNavigate()
  const subjectsQuery = useRentalSubjects(administrationId, subjectType)
  const tenantCandidatesQuery = useTenantCandidates(administrationId)
  const createRentalDraft = useCreateRentalDraft()
  const managementGate = useManagementGate(administrationId)

  const schema = addRentalDraftFormSchema(t)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AddRentalDraftFormValues>({
    resolver: zodResolver(schema),
    defaultValues: ADD_RENTAL_DRAFT_FORM_DEFAULTS,
    shouldUnregister: false,
  })
  const tenantMode = watch('tenantMode')

  const candidates = tenantCandidatesQuery.data ?? []
  // "Existente" is only a trustworthy choice once we know for certain there
  // is at least one real person linked to this administration - not while
  // that's still loading, failed, or confirmed empty (same principle as
  // ParkingForm's associationUnavailable).
  const existingTenantUnavailable =
    tenantCandidatesQuery.isLoading || tenantCandidatesQuery.isError || candidates.length === 0

  const onSubmit = handleSubmit((values) => {
    createRentalDraft.mutate(toCreateRentalDraftInput(values, administrationId), {
      onSuccess: () => {
        void navigate('/rentals')
      },
    })
  })

  if (subjectsQuery.isLoading) {
    return (
      <div className={styles['page']} data-testid="add-rental-subjects-loading">
        <button type="button" className={styles['back']} onClick={onBack}>
          {t('addRental.back')}
        </button>
        <Skeleton height={32} width={240} />
        <Skeleton height={120} radius="lg" />
      </div>
    )
  }

  if (subjectsQuery.isError) {
    return (
      <div className={styles['page']}>
        <button type="button" className={styles['back']} onClick={onBack}>
          {t('addRental.back')}
        </button>
        <Alert tone="danger" title={t('errors.subjectsTitle')}>
          {t('errors.subjectsDescription')}
        </Alert>
      </div>
    )
  }

  const subjects = subjectsQuery.data ?? []

  if (subjects.length === 0) {
    return (
      <div className={styles['page']}>
        <button type="button" className={styles['back']} onClick={onBack}>
          {t('addRental.back')}
        </button>
        <EmptyState
          title={t(`empty.subjects.${subjectType}.title`)}
          description={t(`empty.subjects.${subjectType}.description`)}
          action={<Button onClick={onBack}>{t('addRental.chooseAnother')}</Button>}
        />
      </div>
    )
  }

  return (
    <div className={styles['page']}>
      <button type="button" className={styles['back']} onClick={onBack}>
        {t('addRental.back')}
      </button>
      <h1 className="text-h2">{t('addRental.title')}</h1>

      {createRentalDraft.isError ? <Alert tone="danger">{t('form.errors.createFailed')}</Alert> : null}

      <form
        onSubmit={(event) => {
          void onSubmit(event)
        }}
        noValidate
        className={styles['form']}
      >
        <h2 className="text-h3">{t(`form.sectionSubject.${subjectType}`)}</h2>

        <Select
          label={t('form.subject.label')}
          error={errors.rentalSubjectId?.message}
          disabled={createRentalDraft.isPending}
          {...register('rentalSubjectId')}
        >
          <option value="">{t('form.subject.placeholder')}</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.label}
            </option>
          ))}
        </Select>

        <h2 className="text-h3">{t('form.sectionTenant')}</h2>

        <Select
          label={t('form.tenantMode.label')}
          disabled={createRentalDraft.isPending}
          {...register('tenantMode')}
        >
          <option value="new">{t('form.tenantMode.new')}</option>
          <option value="existing" disabled={existingTenantUnavailable}>
            {t('form.tenantMode.existing')}
          </option>
        </Select>

        {existingTenantUnavailable ? (
          <p className="text-caption text-muted">
            {tenantCandidatesQuery.isLoading
              ? t('form.existingTenant.loadingHint')
              : tenantCandidatesQuery.isError
                ? t('form.existingTenant.errorHint')
                : t('form.existingTenant.emptyHint')}
          </p>
        ) : null}

        {tenantMode === 'existing' && !existingTenantUnavailable ? (
          <Select
            label={t('form.existingTenant.label')}
            error={errors.existingTenantPersonId?.message}
            disabled={createRentalDraft.isPending}
            {...register('existingTenantPersonId')}
          >
            <option value="">{t('form.existingTenant.placeholder')}</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.fullName}
              </option>
            ))}
          </Select>
        ) : null}

        {tenantMode === 'new' ? (
          <>
            <Input
              label={t('form.newTenant.fullName.label')}
              error={errors.fullName?.message}
              disabled={createRentalDraft.isPending}
              {...register('fullName')}
            />
            <Select
              label={t('form.newTenant.documentType.label')}
              disabled={createRentalDraft.isPending}
              {...register('documentType')}
            >
              <option value="">{t('form.newTenant.documentType.none')}</option>
              {DOCUMENT_TYPE_OPTIONS.map((documentType) => (
                <option key={documentType} value={documentType}>
                  {t(`form.newTenant.documentType.${documentType}`)}
                </option>
              ))}
            </Select>
            <Input
              label={t('form.newTenant.documentNumber.label')}
              error={errors.documentNumber?.message}
              disabled={createRentalDraft.isPending}
              {...register('documentNumber')}
            />
            <Select
              label={t('form.newTenant.documentCountry.label')}
              disabled={createRentalDraft.isPending}
              {...register('documentCountry')}
            >
              <option value="">{t('form.newTenant.documentCountry.none')}</option>
              {COUNTRY_OPTIONS.map((country) => (
                <option key={country} value={country}>
                  {t(`countries.${country}`)}
                </option>
              ))}
            </Select>
            <Select
              label={t('form.newTenant.nationalityCountry.label')}
              disabled={createRentalDraft.isPending}
              {...register('nationalityCountry')}
            >
              <option value="">{t('form.newTenant.nationalityCountry.none')}</option>
              {COUNTRY_OPTIONS.map((country) => (
                <option key={country} value={country}>
                  {t(`countries.${country}`)}
                </option>
              ))}
            </Select>
            <Input
              type="email"
              label={t('form.newTenant.email.label')}
              error={errors.email?.message}
              disabled={createRentalDraft.isPending}
              {...register('email')}
            />
            <Input
              label={t('form.newTenant.phone.label')}
              disabled={createRentalDraft.isPending}
              {...register('phone')}
            />
          </>
        ) : null}

        <Button
          type="submit"
          loading={createRentalDraft.isPending}
          disabled={managementGate.blocked || createRentalDraft.isPending}
          aria-disabled={managementGate.blocked ? 'true' : undefined}
          className={styles['submit']}
        >
          {createRentalDraft.isPending ? t('form.submitting') : t('form.submit')}
        </Button>
        {managementGate.blocked ? (
          <p className="text-caption text-muted">{t('administration:managementAccessGate.blocked')}</p>
        ) : null}
      </form>
    </div>
  )
}

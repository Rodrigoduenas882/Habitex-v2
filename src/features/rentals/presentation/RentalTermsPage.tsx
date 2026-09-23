import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useActiveAdministration } from '@/features/administration/application/useActiveAdministration'
import { useManagementGate } from '@/features/administration/application/useManagementGate'
import { AdministrationPicker } from '@/features/administration/presentation/AdministrationPicker'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Skeleton } from '@/shared/ui/Skeleton'
import styles from './RentalTermsPage.module.css'
import {
  RENTAL_TERMS_FORM_DEFAULTS,
  rentalTermsFormSchema,
  toSaveRentalTermsInput,
  type RentalTermsFormValues,
} from './rental-terms-form'
import { useRentalTermVersion } from '../application/useRentalTermVersion'
import { useRentals } from '../application/useRentals'
import { SaveRentalTermsError, useSaveRentalTerms } from '../application/useSaveRentalTerms'
import type { RentalRelationship } from '../domain/rental.types'
import type { RentalTermVersion } from '../domain/rental-terms.types'

const UTILITIES_MODE_OPTIONS = ['TENANT', 'LESSOR', 'SPECIAL_AGREEMENT'] as const
const ADMINISTRATION_MODE_OPTIONS = ['NONE', 'INCLUDED', 'TENANT_DIRECT'] as const

/**
 * Read-only rendering once either a RentalTermVersion already exists for
 * this relationship, or the relationship itself is no longer DRAFT (see
 * RentalTermsForm's own doc comment for why the latter matters even without
 * a term version) - this increment is create+read only, not edit (see
 * useSaveRentalTerms/RentalTermsRepository's own doc comments). A later
 * increment can add real editing if product asks for it; nothing here is
 * built speculatively for that. Schedule fields (trackingStartDate,
 * paymentDay, paymentTiming, expectedEndDate) come from the matching
 * RentalRelationship in the already-fetched administration rentals list -
 * there is no getById/detail read for a single relationship in this
 * feature (no rental detail view - see this increment's own scope notes),
 * so the list is the only place those already-saved values can be read
 * from.
 *
 * `termVersion` is nullable: a non-DRAFT relationship with no term version
 * yet is not expected in practice (activation itself requires one - see
 * INITIAL_TERM_VERSION_REQUIRED), but this view must still render sensibly
 * rather than crash on it (stale client state, RLS edge case, etc.) - the
 * schedule fields still come from `relationship` either way, and the
 * financial fields (rentAmount/administrationMode/utilitiesMode only ever
 * exist on RentalTermVersion) show an explicit "not available" message
 * instead of reading properties off `null`.
 */
function RentalTermsReadOnlyView({
  termVersion,
  relationship,
}: {
  termVersion: RentalTermVersion | null
  relationship: RentalRelationship
}) {
  const { t } = useTranslation('rentals')

  return (
    <div className={styles['form']}>
      <p className="text-body-sm text-muted">{t('termsForm.readOnly.notice')}</p>
      <Input
        label={t('termsForm.realStartDate.label')}
        type="date"
        disabled
        defaultValue={termVersion?.effectiveFrom ?? relationship.realStartDate ?? ''}
      />
      <Input
        label={t('termsForm.trackingStartDate.label')}
        type="date"
        disabled
        defaultValue={relationship.trackingStartDate ?? ''}
      />
      <Input
        label={t('termsForm.paymentDay.label')}
        type="number"
        disabled
        defaultValue={relationship.paymentDay ?? ''}
      />
      <Select label={t('termsForm.paymentTiming.label')} disabled defaultValue={relationship.paymentTiming ?? ''}>
        <option value="ADVANCE">{t('paymentTiming.ADVANCE')}</option>
        <option value="ARREARS">{t('paymentTiming.ARREARS')}</option>
      </Select>
      <Input
        label={t('termsForm.expectedEndDate.label')}
        type="date"
        disabled
        defaultValue={relationship.expectedEndDate ?? ''}
      />
      {termVersion ? (
        <>
          <Input
            label={t('termsForm.rentAmount.label')}
            type="number"
            disabled
            defaultValue={termVersion.rentAmount}
          />
          <Select
            label={t('termsForm.administrationMode.label')}
            disabled
            defaultValue={termVersion.administrationMode}
          >
            {ADMINISTRATION_MODE_OPTIONS.map((mode) => (
              <option key={mode} value={mode}>
                {t(`termsForm.administrationMode.${mode}`)}
              </option>
            ))}
          </Select>
          <Select label={t('termsForm.utilitiesMode.label')} disabled defaultValue={termVersion.utilitiesMode ?? ''}>
            <option value="">{t('termsForm.utilitiesMode.none')}</option>
            {UTILITIES_MODE_OPTIONS.map((mode) => (
              <option key={mode} value={mode}>
                {t(`termsForm.utilitiesMode.${mode}`)}
              </option>
            ))}
          </Select>
        </>
      ) : (
        <p className="text-body-sm text-muted">{t('termsForm.readOnly.financialUnavailable')}</p>
      )}
    </div>
  )
}

export interface RentalTermsFormProps {
  administrationId: string
  relationshipId: string
}

/**
 * The real page body, mounted only once administrationId is resolved (same
 * split as AddRentalPage -> AddRentalDraftForm) - owns its own useForm,
 * fetches this relationship's schedule (via useRentals, the only existing
 * read path - see RentalTermsReadOnlyView's own doc comment) and current
 * term version (via useRentalTermVersion), and decides between the
 * read-only view and the editable form.
 *
 * No capacity check here - capacity only gates activation, not entering
 * terms on a still-DRAFT rental (same reasoning already established for
 * AddRentalDraftForm in INC-004).
 */
function RentalTermsForm({ administrationId, relationshipId }: RentalTermsFormProps) {
  const { t } = useTranslation(['rentals', 'administration'])
  const navigate = useNavigate()
  const rentalsQuery = useRentals(administrationId)
  const termVersionQuery = useRentalTermVersion(administrationId, relationshipId)
  const managementGate = useManagementGate(administrationId)
  const saveRentalTerms = useSaveRentalTerms()

  const schema = rentalTermsFormSchema(t)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RentalTermsFormValues>({
    resolver: zodResolver(schema),
    defaultValues: RENTAL_TERMS_FORM_DEFAULTS,
  })

  if (rentalsQuery.isLoading || termVersionQuery.isLoading) {
    return (
      <div className={styles['page']} data-testid="rental-terms-loading">
        <Skeleton height={32} width={240} />
        <Skeleton height={320} radius="lg" />
      </div>
    )
  }

  if (rentalsQuery.isError || termVersionQuery.isError) {
    return (
      <div className={styles['page']}>
        <Alert tone="danger" title={t('errors.rentalsTitle')}>
          {t('errors.rentalsDescription')}
        </Alert>
      </div>
    )
  }

  const relationship = (rentalsQuery.data ?? []).find((rental) => rental.id === relationshipId) ?? null
  const termVersion = termVersionQuery.data ?? null

  if (!relationship) {
    return (
      <div className={styles['page']}>
        <Alert tone="danger">{t('termsForm.errors.relationshipNotFound')}</Alert>
      </div>
    )
  }

  // Read-only whenever a term version already exists OR the relationship is
  // no longer DRAFT - RLS (rental_terms_insert/rental_relationships_update_draft)
  // already blocks any real write once non-DRAFT, so this is about not
  // presenting a live, submittable form the backend would reject anyway
  // (fixes the LOW finding from the INC-006 review: the previous condition
  // only checked termVersion, so a non-DRAFT relationship with no term
  // version somehow still rendered as an editable, submittable form).
  if (termVersion || relationship.status !== 'DRAFT') {
    return (
      <div className={styles['page']}>
        <h1 className="text-h2">{t('termsForm.title')}</h1>
        <RentalTermsReadOnlyView termVersion={termVersion} relationship={relationship} />
      </div>
    )
  }

  const isPartialFailure = saveRentalTerms.error instanceof SaveRentalTermsError

  const onSubmit = handleSubmit((values) => {
    saveRentalTerms.mutate(toSaveRentalTermsInput(values, administrationId, relationshipId), {
      onSuccess: () => {
        void navigate('/rentals')
      },
    })
  })

  return (
    <div className={styles['page']}>
      <h1 className="text-h2">{t('termsForm.title')}</h1>
      <p className="text-body-sm text-muted">{t('termsForm.description')}</p>

      {saveRentalTerms.isError ? (
        <Alert tone="danger">
          {isPartialFailure ? t('termsForm.errors.partialFailure') : t('termsForm.errors.saveFailed')}
        </Alert>
      ) : null}

      <form
        onSubmit={(event) => {
          void onSubmit(event)
        }}
        noValidate
        className={styles['form']}
      >
        <h2 className="text-h3">{t('termsForm.sectionSchedule')}</h2>

        <Input
          type="date"
          label={t('termsForm.realStartDate.label')}
          error={errors.realStartDate?.message}
          disabled={saveRentalTerms.isPending}
          {...register('realStartDate')}
        />
        <Input
          type="date"
          label={t('termsForm.trackingStartDate.label')}
          error={errors.trackingStartDate?.message}
          disabled={saveRentalTerms.isPending}
          {...register('trackingStartDate')}
        />
        <Input
          type="number"
          min={1}
          max={31}
          step={1}
          label={t('termsForm.paymentDay.label')}
          error={errors.paymentDay?.message}
          disabled={saveRentalTerms.isPending}
          {...register('paymentDay')}
        />
        <Select
          label={t('termsForm.paymentTiming.label')}
          disabled={saveRentalTerms.isPending}
          {...register('paymentTiming')}
        >
          <option value="ADVANCE">{t('paymentTiming.ADVANCE')}</option>
          <option value="ARREARS">{t('paymentTiming.ARREARS')}</option>
        </Select>
        <Input
          type="date"
          label={t('termsForm.expectedEndDate.label')}
          hint={t('termsForm.expectedEndDate.hint')}
          error={errors.expectedEndDate?.message}
          disabled={saveRentalTerms.isPending}
          {...register('expectedEndDate')}
        />

        <h2 className="text-h3">{t('termsForm.sectionFinancial')}</h2>

        <Input
          type="number"
          min={0}
          step="any"
          label={t('termsForm.rentAmount.label')}
          error={errors.rentAmount?.message}
          disabled={saveRentalTerms.isPending}
          {...register('rentAmount')}
        />
        <Select
          label={t('termsForm.administrationMode.label')}
          disabled={saveRentalTerms.isPending}
          {...register('administrationMode')}
        >
          {ADMINISTRATION_MODE_OPTIONS.map((mode) => (
            <option key={mode} value={mode}>
              {t(`termsForm.administrationMode.${mode}`)}
            </option>
          ))}
        </Select>
        <Select
          label={t('termsForm.utilitiesMode.label')}
          disabled={saveRentalTerms.isPending}
          {...register('utilitiesMode')}
        >
          <option value="">{t('termsForm.utilitiesMode.none')}</option>
          {UTILITIES_MODE_OPTIONS.map((mode) => (
            <option key={mode} value={mode}>
              {t(`termsForm.utilitiesMode.${mode}`)}
            </option>
          ))}
        </Select>

        <Button
          type="submit"
          loading={saveRentalTerms.isPending}
          disabled={managementGate.blocked || saveRentalTerms.isPending}
          aria-disabled={managementGate.blocked ? 'true' : undefined}
          className={styles['submit']}
        >
          {saveRentalTerms.isPending ? t('termsForm.submitting') : t('termsForm.submit')}
        </Button>
        {managementGate.blocked ? (
          <p className="text-caption text-muted">{t('administration:managementAccessGate.blocked')}</p>
        ) : null}
      </form>
    </div>
  )
}

/**
 * /rentals/:id/terms - the narrow, single-purpose page (same principle as
 * RoomSetupPage, not a general rental detail view - see this increment's
 * own scope notes) that lets a DRAFT rental receive the data
 * activate_rental_relationship requires: the 4 rental_relationships
 * schedule columns (via RentalRepository.updateSchedule) and the first
 * rental_term_versions row (via RentalTermsRepository.create), sequenced by
 * useSaveRentalTerms since no RPC makes this one transaction.
 */
export default function RentalTermsPage() {
  const { t } = useTranslation('rentals')
  const { id } = useParams<{ id: string }>()
  const currentAdministration = useActiveAdministration()

  if (!id) {
    return (
      <div className={styles['page']}>
        <Alert tone="danger">{t('termsForm.errors.missingRelationship')}</Alert>
      </div>
    )
  }

  if (currentAdministration.status === 'loading') {
    return (
      <div className={styles['page']} data-testid="rental-terms-loading">
        <Skeleton height={32} width={240} />
        <Skeleton height={320} radius="lg" />
      </div>
    )
  }

  if (currentAdministration.status === 'error') {
    return (
      <div className={styles['page']}>
        <Alert tone="danger" title={t('errors.administrationTitle')}>
          {t('errors.administrationDescription')}
        </Alert>
      </div>
    )
  }

  if (currentAdministration.status === 'none') {
    return (
      <div className={styles['page']}>
        <Alert tone="danger">{t('noAdministration.title')}</Alert>
      </div>
    )
  }

  if (currentAdministration.status === 'selection-required') {
    return (
      <div className={styles['page']}>
        <AdministrationPicker
          options={currentAdministration.options}
          onSelect={currentAdministration.select}
        />
      </div>
    )
  }

  return <RentalTermsForm administrationId={currentAdministration.administration.id} relationshipId={id} />
}

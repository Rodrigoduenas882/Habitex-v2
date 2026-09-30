import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation, type UseTranslationResponse } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useManagementGate } from '@/features/administration/application/useManagementGate'
// Cross-feature import, explicitly authorized for this increment (INC-007):
// AddRentalDraftForm is the single MVP entry point allowed to generate a
// tenant invitation (see this file's own AddRentalDraftInvitationStep doc
// comment) - reused exactly as exported, never redefined. generateInvitationToken/
// sha256Hex are pure domain helpers (no Supabase SDK), safe to call directly
// from presentation the same way this file already calls other domain code.
import { useCreateInvitation } from '@/features/invitations/application/useCreateInvitation'
import { InvitationRepositoryError } from '@/features/invitations/domain/invitation.types'
import { generateInvitationToken, sha256Hex } from '@/features/invitations/domain/token'
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

type RentalsT = UseTranslationResponse<['rentals', 'administration'], undefined>['t']

/** Maps a caught create_tenant_invitation error to its specific copy - only
 * 'tenant_not_linked'/'management_access_required' are realistic from this
 * single call site (see InvitationErrorCode's own doc comment); anything
 * else falls into one generic fallback. */
function createInvitationErrorMessage(t: RentalsT, error: unknown): string {
  if (error instanceof InvitationRepositoryError) {
    switch (error.code) {
      case 'tenant_not_linked':
        return t('invitationStep.errors.tenant_not_linked')
      case 'management_access_required':
        return t('invitationStep.errors.management_access_required')
      default:
        return t('invitationStep.errors.unknown')
    }
  }
  return t('invitationStep.errors.unknown')
}

export interface AddRentalDraftInvitationStepProps {
  administrationId: string
  rentalRelationshipId: string
  tenantPersonId: string
  onContinue: () => void
}

/**
 * The optional, inline step shown right after create_rental_draft succeeds -
 * never forced (see this file's own AddRentalDraftForm doc comment). Offers
 * "Generar invitación para el inquilino" (create_tenant_invitation, hashing
 * the token client-side via sha256Hex before it ever reaches the mutation)
 * alongside an always-available "Ir a arriendos" escape hatch, so the admin
 * is never trapped into generating one. `rawToken` lives only in this
 * component's own local state for as long as this panel stays mounted - it
 * is never written to localStorage/sessionStorage/any log, only interpolated
 * into the displayed link and the clipboard write below.
 */
function AddRentalDraftInvitationStep({
  administrationId,
  rentalRelationshipId,
  tenantPersonId,
  onContinue,
}: AddRentalDraftInvitationStepProps) {
  const { t } = useTranslation(['rentals', 'administration'])
  const createInvitation = useCreateInvitation()
  const [rawToken, setRawToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = () => {
    void (async () => {
      const token = generateInvitationToken()
      const tokenHash = await sha256Hex(token)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      createInvitation.mutate(
        {
          administrationId,
          personId: tenantPersonId,
          rentalRelationshipId,
          tokenHash,
          expiresAt,
        },
        {
          onSuccess: () => {
            setRawToken(token)
          },
        },
      )
    })()
  }

  const invitationLink = rawToken ? `${window.location.origin}/invitations/${rawToken}` : null

  const handleCopy = () => {
    if (!invitationLink) return
    navigator.clipboard
      .writeText(invitationLink)
      .then(() => {
        setCopied(true)
      })
      .catch(() => {
        setCopied(false)
      })
  }

  return (
    <div className={styles['page']} data-testid="add-rental-invitation-step">
      <h1 className="text-h2">{t('addRental.success.title')}</h1>
      <p className="text-body-sm text-muted">{t('addRental.success.description')}</p>

      {invitationLink ? (
        <div className={styles['invitationLinkBox']}>
          <Input label={t('invitationStep.linkLabel')} readOnly value={invitationLink} />
          <Button type="button" variant="secondary" onClick={handleCopy}>
            {t('invitationStep.copyLink')}
          </Button>
          <span role="status" aria-live="polite" className={styles['copyStatus']}>
            {copied ? t('invitationStep.copied') : ''}
          </span>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          loading={createInvitation.isPending}
          disabled={createInvitation.isPending}
          onClick={handleGenerate}
        >
          {createInvitation.isPending ? t('invitationStep.generating') : t('invitationStep.generate')}
        </Button>
      )}

      {createInvitation.isError ? (
        <Alert tone="danger">{createInvitationErrorMessage(t, createInvitation.error)}</Alert>
      ) : null}

      <Button type="button" onClick={onContinue} className={styles['submit']}>
        {t('addRental.success.goToRentals')}
      </Button>
    </div>
  )
}

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
 *
 * A successful create_rental_draft no longer navigates away immediately -
 * it swaps to AddRentalDraftInvitationStep (this file's own optional,
 * never-forced "Generar invitación" step - see its doc comment), which is
 * the only place that actually leaves for /rentals.
 */
export function AddRentalDraftForm({ administrationId, subjectType, onBack }: AddRentalDraftFormProps) {
  const { t } = useTranslation(['rentals', 'administration'])
  const navigate = useNavigate()
  const subjectsQuery = useRentalSubjects(administrationId, subjectType)
  const tenantCandidatesQuery = useTenantCandidates(administrationId)
  const createRentalDraft = useCreateRentalDraft()
  const managementGate = useManagementGate(administrationId)
  const [draftResult, setDraftResult] = useState<{ rentalRelationshipId: string; tenantPersonId: string } | null>(
    null,
  )

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
      onSuccess: (result) => {
        setDraftResult(result)
      },
    })
  })

  if (draftResult) {
    return (
      <AddRentalDraftInvitationStep
        administrationId={administrationId}
        rentalRelationshipId={draftResult.rentalRelationshipId}
        tenantPersonId={draftResult.tenantPersonId}
        onContinue={() => {
          void navigate('/rentals')
        }}
      />
    )
  }

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

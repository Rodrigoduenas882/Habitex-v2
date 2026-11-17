import { useEffect, useRef, useState } from 'react'
import { useTranslation, type UseTranslationResponse } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useActiveAdministration } from '@/features/administration/application/useActiveAdministration'
import { useManagementGate } from '@/features/administration/application/useManagementGate'
import { AdministrationPicker } from '@/features/administration/presentation/AdministrationPicker'
import { fileRepository } from '@/features/documents/composition'
import type { FileMetadata } from '@/features/documents/domain/file.types'
import { useRentalIdentities } from '@/features/rentals/application/useRentalIdentities'
import { useRentalTermVersion } from '@/features/rentals/application/useRentalTermVersion'
import { useRentals } from '@/features/rentals/application/useRentals'
import type { RentalTermVersion } from '@/features/rentals/domain/rental-terms.types'
import type { RentalRelationship } from '@/features/rentals/domain/rental.types'
import { RentalContextHeader } from '@/features/rentals/presentation/RentalContextHeader'
import { RentalFlowLayout } from '@/features/rentals/presentation/RentalFlowLayout'
import { Alert } from '@/shared/ui/Alert'
import { Badge, type BadgeTone } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { FileTextIcon } from '@/shared/ui/icons'
import { IconBadge } from '@/shared/ui/IconBadge'
import { Input } from '@/shared/ui/Input'
import { Skeleton } from '@/shared/ui/Skeleton'
import styles from './RentalContractsPage.module.css'
import { useAttachSignedCopy } from '../application/useAttachSignedCopy'
import { useContractFile } from '../application/useContractFile'
import { useContracts } from '../application/useContracts'
import { useMarkContractShared } from '../application/useMarkContractShared'
import { useRegisterExternalSignedContract } from '../application/useRegisterExternalSignedContract'
import { useRegisterHabitexGeneratedContract } from '../application/useRegisterHabitexGeneratedContract'
import { useTerminateContract } from '../application/useTerminateContract'
import { useUploadContractFile } from '../application/useUploadContractFile'
import { ContractRepositoryError, type Contract, type ContractStatus } from '../domain/contract.types'
import { computeSha256Hex } from '../domain/sha256'
import { buildTermsSnapshot } from '../domain/terms-snapshot'

type ContractsT = UseTranslationResponse<['contracts', 'administration'], undefined>['t']

/**
 * Existing semantic tones only (see DESIGN.md), same principle as
 * RentalListCard's STATUS_TONE. SIGNED is the one unambiguously positive
 * state; TERMINATED is the one closest to "stopped"; GENERATED/SHARED are
 * both non-urgent, in-progress states; DRAFT is a plain neutral state
 * (unreachable in practice - see ContractStatus's own doc comment).
 */
const STATUS_TONE: Record<ContractStatus, BadgeTone> = {
  DRAFT: 'neutral',
  GENERATED: 'neutral',
  SHARED: 'info',
  SIGNED: 'success',
  TERMINATED: 'danger',
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

/** Maps a caught mutation error to the specific mapped copy for its
 * ContractErrorCode, or the generic 'unknown' fallback for anything else
 * (including plain upload failures, which never carry a ContractErrorCode -
 * see this feature's own scope notes on deliberately coarse error copy). */
function contractErrorMessage(t: ContractsT, error: unknown): string {
  const code = error instanceof ContractRepositoryError ? error.code : 'unknown'
  return t(`errors.contract.${code}`)
}

/**
 * Downloads fileId's bytes via fileRepository.download() once its
 * FileMetadata resolves (see useContractFile's own doc comment for why a
 * lookup is needed first). Read-only convenience action - RLS on
 * public.files/storage.objects is what actually protects this file,
 * regardless of how its metadata got fetched here.
 */
function ContractFileDownloadButton({
  administrationId,
  fileId,
  label,
}: {
  administrationId: string
  fileId: string
  label: string
}) {
  const { t } = useTranslation('contracts')
  const fileQuery = useContractFile(administrationId, fileId)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadFailed, setDownloadFailed] = useState(false)

  if (!fileQuery.data) {
    return null
  }

  const file = fileQuery.data

  const handleClick = () => {
    setDownloadFailed(false)
    setIsDownloading(true)
    fileRepository
      .download(file)
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = file.originalName ?? file.id
        link.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => {
        setDownloadFailed(true)
      })
      .finally(() => {
        setIsDownloading(false)
      })
  }

  return (
    <div className={styles['downloadAction']}>
      <Button type="button" variant="ghost" size="sm" loading={isDownloading} disabled={isDownloading} onClick={handleClick}>
        {label}
      </Button>
      {downloadFailed ? <p className="text-caption text-muted">{t('list.downloadError')}</p> : null}
    </div>
  )
}

interface AttachSignedCopyActionProps {
  administrationId: string
  relationshipId: string
  contractId: string
  managementBlocked: boolean
  /** True only inside RentalsVisualPreview (P2 fix, Codex NO-GO on PR #29):
   * guards submit() so this action never issues a real upload/attach call
   * against the backend from the unauthenticated demo - see ContractCard's
   * own doc comment for the full previewMode rationale. Defaults to false,
   * so the real page's behavior is unchanged. */
  previewMode?: boolean
}

/**
 * Per-contract "Adjuntar copia firmada" action (GENERATED/SHARED ->
 * SIGNED). Owns its own upload-then-attach orchestration, same principle as
 * the two creation forms below: upload and attachSignedCopy are separate
 * mutations, and the already-uploaded FileMetadata is held in local state
 * (`uploadedFile`) so a retry after an attachSignedCopy failure reuses the
 * same file id instead of re-invoking the upload mutation. `uploadedFile`
 * is reset to null whenever a different file is picked, so it never gets
 * silently reused across an unrelated file selection.
 */
function AttachSignedCopyAction({
  administrationId,
  relationshipId,
  contractId,
  managementBlocked,
  previewMode = false,
}: AttachSignedCopyActionProps) {
  const { t } = useTranslation(['contracts', 'administration'])
  const uploadFile = useUploadContractFile()
  const attachSignedCopy = useAttachSignedCopy()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadedFile, setUploadedFile] = useState<FileMetadata | null>(null)
  const [fileRequired, setFileRequired] = useState(false)

  const isPending = uploadFile.isPending || attachSignedCopy.isPending

  const submit = () => {
    if (previewMode) return
    const file = selectedFile
    if (!file) {
      setFileRequired(true)
      return
    }
    setFileRequired(false)

    void (async () => {
      try {
        const uploaded =
          uploadedFile ??
          (await uploadFile.mutateAsync({
            administrationId,
            rentalRelationshipId: relationshipId,
            purpose: 'CONTRACT_SIGNED',
            blob: file,
            originalName: file.name,
          }))
        if (!uploadedFile) {
          setUploadedFile(uploaded)
        }

        await attachSignedCopy.mutateAsync({
          administrationId,
          rentalRelationshipId: relationshipId,
          contractId,
          signedFileId: uploaded.id,
        })
        setSelectedFile(null)
        setUploadedFile(null)
      } catch {
        // uploadFile.isError / attachSignedCopy.isError already reflect the
        // failure - nothing else to do here.
      }
    })()
  }

  const errorMessage = attachSignedCopy.isError
    ? contractErrorMessage(t, attachSignedCopy.error)
    : uploadFile.isError
      ? t('errors.contract.unknown')
      : null

  return (
    <form
      className={styles['attachForm']}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <Input
        type="file"
        label={t('actions.attachSignedCopy.fileLabel')}
        error={fileRequired ? t('create.fileRequired') : undefined}
        disabled={isPending || managementBlocked}
        onChange={(event) => {
          setSelectedFile(event.target.files?.[0] ?? null)
          setUploadedFile(null)
          setFileRequired(false)
        }}
      />
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        loading={isPending}
        disabled={managementBlocked || isPending}
        aria-disabled={managementBlocked ? 'true' : undefined}
      >
        {isPending ? t('actions.attachSignedCopy.submitting') : t('actions.attachSignedCopy.submit')}
      </Button>
      {managementBlocked ? <p className="text-caption text-muted">{t('administration:managementAccessGate.blocked')}</p> : null}
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
    </form>
  )
}

interface TerminateContractActionProps {
  disabled: boolean
  blockReasonText: string | null
  isPending: boolean
  errorMessage: string | null
  onConfirm: () => void
}

/**
 * Two-step inline confirmation for terminate (SIGNED -> TERMINATED), the
 * one irreversible-negative contract action - same principle as
 * RentalListCard's LifecycleConfirmAction (INC-009), reimplemented locally
 * here rather than imported/shared, since that component isn't exported and
 * this fix's scope is limited to this feature (no cross-feature refactor).
 *
 * The first click only flips local `confirming` state - it never calls
 * onConfirm. Once confirming, the single trigger button is replaced by two
 * distinct elements (destructive "Confirmar terminación" + secondary
 * "Volver"), never the same element relabeled in place, and focus moves to
 * the confirm button on that transition - and back to the original trigger
 * when "Volver" exits confirming (P2 fix, Codex NO-GO on PR #29: focus
 * previously fell back to <body>, breaking the keyboard Tab sequence for
 * anyone leaving the confirmation without committing it).
 */
function TerminateContractAction({
  disabled,
  blockReasonText,
  isPending,
  errorMessage,
  onConfirm,
}: TerminateContractActionProps) {
  const { t } = useTranslation('contracts')
  const [confirming, setConfirming] = useState(false)
  const triggerButtonRef = useRef<HTMLButtonElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const wasConfirmingRef = useRef(false)

  useEffect(() => {
    if (confirming) {
      confirmButtonRef.current?.focus()
    } else if (wasConfirmingRef.current) {
      triggerButtonRef.current?.focus()
    }
    wasConfirmingRef.current = confirming
  }, [confirming])

  if (!confirming) {
    return (
      <>
        <Button
          ref={triggerButtonRef}
          type="button"
          variant="destructive"
          size="sm"
          disabled={disabled}
          aria-disabled={disabled ? 'true' : undefined}
          onClick={() => {
            setConfirming(true)
          }}
        >
          {t('actions.terminate.cta')}
        </Button>
        {disabled && blockReasonText ? <p className="text-caption text-muted">{blockReasonText}</p> : null}
      </>
    )
  }

  return (
    <>
      <div className={styles['confirmActions']}>
        <Button
          ref={confirmButtonRef}
          type="button"
          variant="destructive"
          size="sm"
          loading={isPending}
          disabled={isPending}
          onClick={onConfirm}
        >
          {t('actions.terminate.confirmCta')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setConfirming(false)
          }}
        >
          {t('actions.terminate.back')}
        </Button>
      </div>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
    </>
  )
}

export interface ContractCardProps {
  contract: Contract
  administrationId: string
  relationshipId: string
  managementBlocked: boolean
  /**
   * True only inside RentalsVisualPreview. P2 fix (Codex NO-GO on PR #29):
   * this component previously still made real, automatic GET calls on mount
   * (useContractFile, via the download buttons below, whenever a fixture
   * carries a documentFileId/signedFileId) and real mutate() calls on click
   * (markShared/terminate) from the unauthenticated demo - both now reaching
   * an actual Supabase endpoint instead of staying purely visual. previewMode
   * skips the download buttons entirely (no useContractFile query ever
   * mounts) and turns the mutating actions' callbacks into no-ops, the same
   * convention RentalListCard's own preview wiring already uses for its
   * lifecycle actions - the two-step confirm/back UI stays fully
   * demonstrable, only the final network call is suppressed. Defaults to
   * false, so the real /rentals/:id/contracts page is unaffected.
   */
  previewMode?: boolean
}

/** One contract row: origin/status/version/dates, download links for
 * whichever file is present, and the status-exact action set (see this
 * feature's own scope notes: GENERATED gets markShared + attachSignedCopy,
 * SHARED gets attachSignedCopy only, SIGNED gets terminate only,
 * TERMINATED/DRAFT get none).
 *
 * Exported (Sprint 3, same reuse principle as PropertiesSection/
 * ParkingsSection in Sprint 2) so RentalsVisualPreview can render this exact
 * component instead of a look-alike copy - with previewMode true there (see
 * this props' own doc comment) so that reuse never reaches the real
 * backend. */
export function ContractCard({
  contract,
  administrationId,
  relationshipId,
  managementBlocked,
  previewMode = false,
}: ContractCardProps) {
  const { t } = useTranslation(['contracts', 'administration'])
  const markShared = useMarkContractShared()
  const terminate = useTerminateContract()

  const isMarkSharedPending = markShared.isPending && markShared.variables.contractId === contract.id
  const markSharedError =
    markShared.isError && markShared.variables.contractId === contract.id ? markShared.error : null

  const isTerminatePending = terminate.isPending && terminate.variables.contractId === contract.id
  const terminateError = terminate.isError && terminate.variables.contractId === contract.id ? terminate.error : null

  return (
    <Card className={styles['contractCard']}>
      <div className={styles['contractHeader']}>
        <IconBadge icon={<FileTextIcon size={18} />} tone="neutral" size={36} radius="md" />
        <div className={styles['contractIdentity']}>
          <p className="text-body-sm text-muted">{t(`origin.${contract.origin}`)}</p>
          <span className="text-caption text-muted">{t('list.version', { version: contract.versionNumber })}</span>
        </div>
        <Badge tone={STATUS_TONE[contract.status]}>{t(`status.${contract.status}`)}</Badge>
      </div>
      {contract.generatedAt ? (
        <p className="text-caption text-muted">{t('list.generatedAt', { date: formatDateTime(contract.generatedAt) })}</p>
      ) : null}
      {contract.sharedAt ? (
        <p className="text-caption text-muted">{t('list.sharedAt', { date: formatDateTime(contract.sharedAt) })}</p>
      ) : null}
      {contract.signedAt ? (
        <p className="text-caption text-muted">{t('list.signedAt', { date: formatDateTime(contract.signedAt) })}</p>
      ) : null}
      {contract.terminatedAt ? (
        <p className="text-caption text-muted">{t('list.terminatedAt', { date: formatDateTime(contract.terminatedAt) })}</p>
      ) : null}

      <div className={styles['downloadRow']}>
        {contract.documentFileId && !previewMode ? (
          <ContractFileDownloadButton
            administrationId={administrationId}
            fileId={contract.documentFileId}
            label={t('list.downloadDocument')}
          />
        ) : null}
        {contract.signedFileId && !previewMode ? (
          <ContractFileDownloadButton
            administrationId={administrationId}
            fileId={contract.signedFileId}
            label={t('list.downloadSigned')}
          />
        ) : null}
      </div>

      {contract.status === 'GENERATED' ? (
        <div className={styles['actionsRow']}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={isMarkSharedPending}
            disabled={managementBlocked || isMarkSharedPending}
            aria-disabled={managementBlocked ? 'true' : undefined}
            onClick={() => {
              if (previewMode) return
              markShared.mutate({ administrationId, rentalRelationshipId: relationshipId, contractId: contract.id })
            }}
          >
            {t('actions.markShared.cta')}
          </Button>
          {managementBlocked ? <p className="text-caption text-muted">{t('administration:managementAccessGate.blocked')}</p> : null}
          {markSharedError ? <Alert tone="danger">{contractErrorMessage(t, markSharedError)}</Alert> : null}
        </div>
      ) : null}

      {contract.status === 'GENERATED' || contract.status === 'SHARED' ? (
        <div className={styles['actionsRow']}>
          <AttachSignedCopyAction
            administrationId={administrationId}
            relationshipId={relationshipId}
            contractId={contract.id}
            managementBlocked={managementBlocked}
            previewMode={previewMode}
          />
        </div>
      ) : null}

      {contract.status === 'SIGNED' ? (
        <div className={styles['actionsRow']}>
          <TerminateContractAction
            disabled={managementBlocked}
            blockReasonText={managementBlocked ? t('administration:managementAccessGate.blocked') : null}
            isPending={isTerminatePending}
            errorMessage={terminateError ? contractErrorMessage(t, terminateError) : null}
            onConfirm={() => {
              if (previewMode) return
              terminate.mutate({ administrationId, rentalRelationshipId: relationshipId, contractId: contract.id })
            }}
          />
        </div>
      ) : null}
    </Card>
  )
}

interface CreationFormProps {
  administrationId: string
  relationshipId: string
  relationship: RentalRelationship
  termVersion: RentalTermVersion
  managementBlocked: boolean
}

/**
 * "Registrar contrato Habitex": the owner uploads a real, user-supplied
 * document (any file) through this app's own upload flow - "Habitex-
 * generated" describes the registration path, not an auto-generated PDF;
 * nothing here or in register_habitex_generated_contract implies template
 * generation (see this feature's own scope notes).
 *
 * Upload (purpose CONTRACT_GENERATED) and registration are separate
 * mutations - `uploadedFile` holds the already-uploaded FileMetadata across
 * a retry, same orchestration as AttachSignedCopyAction. The SHA-256 is
 * computed from the exact same File object that was uploaded, so hashing
 * never requires a second round trip to Storage.
 */
function RegisterHabitexGeneratedForm({
  administrationId,
  relationshipId,
  relationship,
  termVersion,
  managementBlocked,
}: CreationFormProps) {
  const { t } = useTranslation(['contracts', 'administration'])
  const uploadFile = useUploadContractFile()
  const registerHabitexGenerated = useRegisterHabitexGeneratedContract()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadedFile, setUploadedFile] = useState<FileMetadata | null>(null)
  const [fileRequired, setFileRequired] = useState(false)

  const isPending = uploadFile.isPending || registerHabitexGenerated.isPending

  const submit = () => {
    const file = selectedFile
    if (!file) {
      setFileRequired(true)
      return
    }
    setFileRequired(false)

    void (async () => {
      try {
        const uploaded =
          uploadedFile ??
          (await uploadFile.mutateAsync({
            administrationId,
            rentalRelationshipId: relationshipId,
            purpose: 'CONTRACT_GENERATED',
            blob: file,
            originalName: file.name,
          }))
        if (!uploadedFile) {
          setUploadedFile(uploaded)
        }

        const documentHash = await computeSha256Hex(file)
        const termsSnapshot = buildTermsSnapshot(relationship, termVersion)

        await registerHabitexGenerated.mutateAsync({
          administrationId,
          rentalRelationshipId: relationshipId,
          documentFileId: uploaded.id,
          documentHash,
          termsSnapshot,
        })
        setSelectedFile(null)
        setUploadedFile(null)
      } catch {
        // uploadFile.isError / registerHabitexGenerated.isError already
        // reflect the failure - nothing else to do here.
      }
    })()
  }

  const errorMessage = registerHabitexGenerated.isError
    ? contractErrorMessage(t, registerHabitexGenerated.error)
    : uploadFile.isError
      ? t('errors.contract.unknown')
      : null

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <Card className={styles['creationForm']}>
        <h3 className="text-h3">{t('create.habitex.title')}</h3>
        <p className="text-body-sm text-muted">{t('create.habitex.description')}</p>
        <Input
          type="file"
          label={t('create.habitex.fileLabel')}
          error={fileRequired ? t('create.fileRequired') : undefined}
          disabled={isPending || managementBlocked}
          onChange={(event) => {
            setSelectedFile(event.target.files?.[0] ?? null)
            setUploadedFile(null)
            setFileRequired(false)
          }}
        />
        <Button
          type="submit"
          loading={isPending}
          disabled={managementBlocked || isPending}
          aria-disabled={managementBlocked ? 'true' : undefined}
          className={styles['creationSubmit']}
        >
          {isPending ? t('create.habitex.submitting') : t('create.habitex.submit')}
        </Button>
        {managementBlocked ? <p className="text-caption text-muted">{t('administration:managementAccessGate.blocked')}</p> : null}
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      </Card>
    </form>
  )
}

/**
 * "Registrar contrato externo firmado": the same upload-then-register
 * orchestration as RegisterHabitexGeneratedForm, but purpose
 * CONTRACT_SIGNED and no document hash (register_external_signed_contract
 * doesn't take one - this path records a contract already fully executed
 * outside the app).
 *
 * Visually split into the three sections the Figma candidate 370:716
 * documents (docs/DESIGN.md §16.6): "Documento del contrato" (the real file
 * upload below), "Fecha de firma" and "Partes del contrato". The signature
 * date is a note, not a field - this form/RPC has no persisted signature
 * date of its own (confirmed against register_external_signed_contract's
 * own signature, see this file's scope notes), so showing an editable or
 * even read-only date input here would fabricate a value nothing backs; the
 * note says so honestly instead (Codex NO-GO on PR #29: do not invent a
 * persistent field the model/RPC doesn't support). "Partes del contrato"
 * shows only what this frontend actually resolves - the current tenant name
 * via useRentalIdentities, same source as RentalContextHeader/
 * RentalSummaryPanel - and an honest "Sin definir" for the lessor, since no
 * repository in this feature reads the LESSOR participant's name.
 */
function RegisterExternalSignedForm({
  administrationId,
  relationshipId,
  relationship,
  termVersion,
  managementBlocked,
}: CreationFormProps) {
  const { t } = useTranslation(['contracts', 'administration', 'rentals'])
  const identities = useRentalIdentities(administrationId)
  const tenantName = identities.byRelationshipId.get(relationshipId)?.tenantName ?? null
  const uploadFile = useUploadContractFile()
  const registerExternalSigned = useRegisterExternalSignedContract()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadedFile, setUploadedFile] = useState<FileMetadata | null>(null)
  const [fileRequired, setFileRequired] = useState(false)

  const isPending = uploadFile.isPending || registerExternalSigned.isPending

  const submit = () => {
    const file = selectedFile
    if (!file) {
      setFileRequired(true)
      return
    }
    setFileRequired(false)

    void (async () => {
      try {
        const uploaded =
          uploadedFile ??
          (await uploadFile.mutateAsync({
            administrationId,
            rentalRelationshipId: relationshipId,
            purpose: 'CONTRACT_SIGNED',
            blob: file,
            originalName: file.name,
          }))
        if (!uploadedFile) {
          setUploadedFile(uploaded)
        }

        const termsSnapshot = buildTermsSnapshot(relationship, termVersion)

        await registerExternalSigned.mutateAsync({
          administrationId,
          rentalRelationshipId: relationshipId,
          signedFileId: uploaded.id,
          termsSnapshot,
        })
        setSelectedFile(null)
        setUploadedFile(null)
      } catch {
        // uploadFile.isError / registerExternalSigned.isError already
        // reflect the failure - nothing else to do here.
      }
    })()
  }

  const errorMessage = registerExternalSigned.isError
    ? contractErrorMessage(t, registerExternalSigned.error)
    : uploadFile.isError
      ? t('errors.contract.unknown')
      : null

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <Card className={styles['creationForm']}>
        <h3 className="text-h3">{t('create.external.title')}</h3>
        <p className="text-body-sm text-muted">{t('create.external.description')}</p>

        <div className={styles['creationSubsection']}>
          <h4 className={styles['creationSubsectionTitle']}>{t('create.external.documentSection')}</h4>
          <Input
            type="file"
            label={t('create.external.fileLabel')}
            error={fileRequired ? t('create.fileRequired') : undefined}
            disabled={isPending || managementBlocked}
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] ?? null)
              setUploadedFile(null)
              setFileRequired(false)
            }}
          />
        </div>

        <div className={styles['creationSubsection']}>
          <h4 className={styles['creationSubsectionTitle']}>{t('create.external.signatureDateSection')}</h4>
          <p className="text-caption text-muted">{t('create.external.signatureDateNote')}</p>
        </div>

        <div className={styles['creationSubsection']}>
          <h4 className={styles['creationSubsectionTitle']}>{t('create.external.partiesSection')}</h4>
          <p className="text-body-sm">
            <span className="text-muted">{t('create.external.lessorLabel')}: </span>
            {t('rentals:summary.undefined')}
          </p>
          <p className="text-body-sm">
            <span className="text-muted">{t('create.external.tenantLabel')}: </span>
            {tenantName ?? t('rentals:summary.undefined')}
          </p>
        </div>

        <Button
          type="submit"
          loading={isPending}
          disabled={managementBlocked || isPending}
          aria-disabled={managementBlocked ? 'true' : undefined}
          className={styles['creationSubmit']}
        >
          {isPending ? t('create.external.submitting') : t('create.external.submit')}
        </Button>
        {managementBlocked ? <p className="text-caption text-muted">{t('administration:managementAccessGate.blocked')}</p> : null}
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      </Card>
    </form>
  )
}

export interface RentalContractsViewProps {
  administrationId: string
  relationshipId: string
}

/**
 * The real page body, mounted only once administrationId is resolved (same
 * split as RentalTermsForm/RentalTermsPage). Resolves the relationship from
 * the already-fetched administration rentals list (no getById - same
 * reasoning as RentalTermsPage) and reads/mutates this relationship's
 * contracts.
 *
 * The creation section (register Habitex-generated / register external
 * signed) only renders while relationship.status is ACTIVE or ENDING - a
 * deliberate UX-sequencing decision (product decision, not a security
 * boundary: register_habitex_generated_contract/register_external_signed_contract
 * themselves place no such restriction on rental_relationships.status, only
 * on management access and file ownership). DRAFT/ENDED/CANCELLED never
 * show it. The contract list and its download actions remain visible
 * regardless of status or expired management access - contracts_select RLS
 * only requires can_view_relationship(), not management access, so this
 * page never hides read-only historical data behind that gate; only the
 * mutating actions are gated by useManagementGate below.
 */
function RentalContractsView({ administrationId, relationshipId }: RentalContractsViewProps) {
  const { t } = useTranslation(['contracts', 'administration'])
  const rentalsQuery = useRentals(administrationId)
  const contractsQuery = useContracts(administrationId, relationshipId)
  const termVersionQuery = useRentalTermVersion(administrationId, relationshipId)
  const managementGate = useManagementGate(administrationId)
  // Shares the same TanStack Query cache RentalContextHeader's own
  // useRentalIdentities call below already populates (DS-002) - never a
  // second network request in practice.
  const identities = useRentalIdentities(administrationId)

  if (rentalsQuery.isLoading || contractsQuery.isLoading) {
    return (
      <div className={styles['page']} data-testid="rental-contracts-loading">
        <Skeleton height={32} width={240} />
        <Skeleton height={160} radius="lg" />
        <Skeleton height={160} radius="lg" />
      </div>
    )
  }

  if (rentalsQuery.isError || contractsQuery.isError) {
    return (
      <div className={styles['page']}>
        <Alert tone="danger" title={t('errors.contractsTitle')}>
          {t('errors.contractsDescription')}
        </Alert>
      </div>
    )
  }

  const relationship = (rentalsQuery.data ?? []).find((rental) => rental.id === relationshipId) ?? null

  if (!relationship) {
    return (
      <div className={styles['page']}>
        <Alert tone="danger">{t('errors.relationshipNotFound')}</Alert>
      </div>
    )
  }

  const contracts = contractsQuery.data ?? []
  const canCreate = relationship.status === 'ACTIVE' || relationship.status === 'ENDING'
  const termVersion = termVersionQuery.data ?? null
  const identity = identities.byRelationshipId.get(relationshipId) ?? {
    subjectLabel: null,
    tenantName: null,
    rentAmount: null,
  }

  return (
    <RentalFlowLayout
      step={4}
      summary={{
        subjectLabel: identity.subjectLabel,
        tenantName: identity.tenantName,
        rentAmount: termVersion?.rentAmount ?? identity.rentAmount,
        startDate: termVersion?.effectiveFrom ?? relationship.realStartDate,
        endDate: relationship.expectedEndDate,
      }}
    >
      <RentalContextHeader administrationId={administrationId} relationshipId={relationshipId} activeSection="contracts" />
      <p className="text-body-sm text-muted">{t('description')}</p>

      <section className={styles['section']}>
        {contracts.length === 0 ? (
          <p className="text-body-sm text-muted">{t('list.empty')}</p>
        ) : (
          <div className={styles['list']}>
            {contracts.map((contract) => (
              <ContractCard
                key={contract.id}
                contract={contract}
                administrationId={administrationId}
                relationshipId={relationshipId}
                managementBlocked={managementGate.blocked}
              />
            ))}
          </div>
        )}
      </section>

      {canCreate ? (
        <section className={styles['creationSection']}>
          <h2 className="text-h3">{t('create.title')}</h2>
          {termVersion ? (
            <div className={styles['creationGrid']}>
              <RegisterHabitexGeneratedForm
                administrationId={administrationId}
                relationshipId={relationshipId}
                relationship={relationship}
                termVersion={termVersion}
                managementBlocked={managementGate.blocked}
              />
              <RegisterExternalSignedForm
                administrationId={administrationId}
                relationshipId={relationshipId}
                relationship={relationship}
                termVersion={termVersion}
                managementBlocked={managementGate.blocked}
              />
            </div>
          ) : (
            <Alert tone="danger">{t('create.termsUnavailable')}</Alert>
          )}
        </section>
      ) : null}
    </RentalFlowLayout>
  )
}

/**
 * /rentals/:id/contracts - a narrow, single-purpose page (same principle as
 * RentalTermsPage, explicitly not a general rental detail view - see this
 * increment's own scope notes) for reading a rental relationship's contract
 * history and registering/progressing contracts through their lifecycle
 * (GENERATED -> SHARED -> SIGNED -> TERMINATED, or EXTERNAL straight to
 * SIGNED -> TERMINATED). No advanced/cryptographic signature, no document
 * generation - see this feature's own scope notes.
 */
export default function RentalContractsPage() {
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
      <div className={styles['page']} data-testid="rental-contracts-loading">
        <Skeleton height={32} width={240} />
        <Skeleton height={160} radius="lg" />
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
        <AdministrationPicker options={currentAdministration.options} onSelect={currentAdministration.select} />
      </div>
    )
  }

  return <RentalContractsView administrationId={currentAdministration.administration.id} relationshipId={id} />
}

import { useState } from 'react'
import { useTranslation, type UseTranslationResponse } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useActiveAdministration } from '@/features/administration/application/useActiveAdministration'
import { useManagementGate } from '@/features/administration/application/useManagementGate'
import { AdministrationPicker } from '@/features/administration/presentation/AdministrationPicker'
import { fileRepository } from '@/features/documents/composition'
import type { FileMetadata } from '@/features/documents/domain/file.types'
import { useRentalTermVersion } from '@/features/rentals/application/useRentalTermVersion'
import { useRentals } from '@/features/rentals/application/useRentals'
import type { RentalTermVersion } from '@/features/rentals/domain/rental-terms.types'
import type { RentalRelationship } from '@/features/rentals/domain/rental.types'
import { Alert } from '@/shared/ui/Alert'
import { Badge, type BadgeTone } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
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
}: AttachSignedCopyActionProps) {
  const { t } = useTranslation(['contracts', 'administration'])
  const uploadFile = useUploadContractFile()
  const attachSignedCopy = useAttachSignedCopy()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadedFile, setUploadedFile] = useState<FileMetadata | null>(null)
  const [fileRequired, setFileRequired] = useState(false)

  const isPending = uploadFile.isPending || attachSignedCopy.isPending

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

interface ContractCardProps {
  contract: Contract
  administrationId: string
  relationshipId: string
  managementBlocked: boolean
}

/** One contract row: origin/status/version/dates, download links for
 * whichever file is present, and the status-exact action set (see this
 * feature's own scope notes: GENERATED gets markShared + attachSignedCopy,
 * SHARED gets attachSignedCopy only, SIGNED gets terminate only,
 * TERMINATED/DRAFT get none). */
function ContractCard({ contract, administrationId, relationshipId, managementBlocked }: ContractCardProps) {
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
        <Badge tone={STATUS_TONE[contract.status]}>{t(`status.${contract.status}`)}</Badge>
        <span className="text-caption text-muted">{t('list.version', { version: contract.versionNumber })}</span>
      </div>
      <p className="text-body-sm text-muted">{t(`origin.${contract.origin}`)}</p>
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
        {contract.documentFileId ? (
          <ContractFileDownloadButton
            administrationId={administrationId}
            fileId={contract.documentFileId}
            label={t('list.downloadDocument')}
          />
        ) : null}
        {contract.signedFileId ? (
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
          />
        </div>
      ) : null}

      {contract.status === 'SIGNED' ? (
        <div className={styles['actionsRow']}>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            loading={isTerminatePending}
            disabled={managementBlocked || isTerminatePending}
            aria-disabled={managementBlocked ? 'true' : undefined}
            onClick={() => {
              terminate.mutate({ administrationId, rentalRelationshipId: relationshipId, contractId: contract.id })
            }}
          >
            {t('actions.terminate.cta')}
          </Button>
          {managementBlocked ? <p className="text-caption text-muted">{t('administration:managementAccessGate.blocked')}</p> : null}
          {terminateError ? <Alert tone="danger">{contractErrorMessage(t, terminateError)}</Alert> : null}
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
      className={styles['creationForm']}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <h3 className={styles['creationFormTitle']}>{t('create.habitex.title')}</h3>
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
    </form>
  )
}

/**
 * "Registrar contrato externo firmado": the same upload-then-register
 * orchestration as RegisterHabitexGeneratedForm, but purpose
 * CONTRACT_SIGNED and no document hash (register_external_signed_contract
 * doesn't take one - this path records a contract already fully executed
 * outside the app).
 */
function RegisterExternalSignedForm({
  administrationId,
  relationshipId,
  relationship,
  termVersion,
  managementBlocked,
}: CreationFormProps) {
  const { t } = useTranslation(['contracts', 'administration'])
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
      className={styles['creationForm']}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <h3 className={styles['creationFormTitle']}>{t('create.external.title')}</h3>
      <p className="text-body-sm text-muted">{t('create.external.description')}</p>
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

  return (
    <div className={styles['page']}>
      <h1 className="text-h2">{t('title')}</h1>
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
    </div>
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

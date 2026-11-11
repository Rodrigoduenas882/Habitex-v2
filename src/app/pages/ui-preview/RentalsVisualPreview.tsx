import { useTranslation } from 'react-i18next'
import { ContractCard } from '@/features/contracts/presentation/RentalContractsPage'
import type { Contract } from '@/features/contracts/domain/contract.types'
import { RentalListCard, type RentalListCardIdentity } from '@/features/rentals/presentation/RentalListCard'
import type { RentalRelationship } from '@/features/rentals/domain/rental.types'
import { Alert } from '@/shared/ui/Alert'
import { AppShellPreview } from './AppShellPreview'
import styles from './RentalsVisualPreview.module.css'

// Design fixtures only. Never consumed by the authenticated /rentals or
// /rentals/:id/contracts routes.
const BASE_RELATIONSHIP: RentalRelationship = {
  id: 'demo-rental-base',
  administrationId: 'demo',
  status: 'DRAFT',
  jurisdictionCountry: 'CO',
  realStartDate: null,
  trackingStartDate: null,
  expectedEndDate: null,
  actualEndDate: null,
  paymentDay: null,
  paymentTiming: null,
}

const DRAFT_READY: RentalRelationship = { ...BASE_RELATIONSHIP, id: 'demo-rental-draft-ready' }
const DRAFT_BLOCKED: RentalRelationship = { ...BASE_RELATIONSHIP, id: 'demo-rental-draft-blocked' }
const ACTIVE: RentalRelationship = {
  ...BASE_RELATIONSHIP,
  id: 'demo-rental-active',
  status: 'ACTIVE',
  realStartDate: '2026-02-01',
  trackingStartDate: '2026-02-01',
  paymentDay: 5,
  paymentTiming: 'ADVANCE',
}
const ENDING: RentalRelationship = {
  ...BASE_RELATIONSHIP,
  id: 'demo-rental-ending',
  status: 'ENDING',
  realStartDate: '2025-06-01',
  trackingStartDate: '2025-06-01',
  paymentDay: 1,
  paymentTiming: 'ARREARS',
  expectedEndDate: '2026-12-01',
}
const ENDED: RentalRelationship = {
  ...BASE_RELATIONSHIP,
  id: 'demo-rental-ended',
  status: 'ENDED',
  realStartDate: '2024-01-01',
  trackingStartDate: '2024-01-01',
  paymentDay: 15,
  paymentTiming: 'ADVANCE',
  actualEndDate: '2025-12-31',
}
const CANCELLED: RentalRelationship = { ...BASE_RELATIONSHIP, id: 'demo-rental-cancelled', status: 'CANCELLED' }

// One distinct identity per card (not reused across statuses) - both so the
// grid actually demonstrates variety, and so E2E text queries never hit a
// Playwright strict-mode multiple-match violation.
const IDENTITY_FULL: RentalListCardIdentity = {
  subjectLabel: 'Apartamento 302',
  tenantName: 'María Pérez',
  rentAmount: 1500000,
}
const IDENTITY_ROOM: RentalListCardIdentity = {
  subjectLabel: 'Habitación 2 - Casa 14',
  tenantName: 'Carlos Gómez',
  rentAmount: 650000,
}
const IDENTITY_PARKING: RentalListCardIdentity = {
  subjectLabel: 'Parqueadero 12',
  tenantName: 'Luisa Ramírez',
  rentAmount: 250000,
}
const IDENTITY_HOUSE: RentalListCardIdentity = {
  subjectLabel: 'Casa 22',
  tenantName: 'Jorge Londoño',
  rentAmount: 1200000,
}
const IDENTITY_APARTMENT_501: RentalListCardIdentity = {
  subjectLabel: 'Apartamento 501',
  tenantName: 'Ana Torres',
  rentAmount: 900000,
}
const IDENTITY_UNKNOWN: RentalListCardIdentity = { subjectLabel: null, tenantName: null, rentAmount: null }

const CONTRACT_BASE: Contract = {
  id: 'demo-contract-base',
  administrationId: 'demo',
  rentalRelationshipId: 'demo-rental-active',
  origin: 'HABITEX',
  status: 'GENERATED',
  versionNumber: 1,
  documentFileId: null,
  signedFileId: null,
  termsSnapshot: {
    rentAmount: 1500000,
    administrationMode: 'INCLUDED',
    utilitiesMode: 'TENANT',
    effectiveFrom: '2026-02-01',
    realStartDate: '2026-02-01',
    trackingStartDate: '2026-02-01',
    paymentDay: 5,
    paymentTiming: 'ADVANCE',
    expectedEndDate: null,
  },
  documentHash: null,
  generatedAt: '2026-02-02T10:00:00Z',
  sharedAt: null,
  signedAt: null,
  terminatedAt: null,
  createdAt: '2026-02-02T10:00:00Z',
  updatedAt: '2026-02-02T10:00:00Z',
}

const CONTRACT_SHARED: Contract = {
  ...CONTRACT_BASE,
  id: 'demo-contract-shared',
  status: 'SHARED',
  sharedAt: '2026-02-03T10:00:00Z',
}
const CONTRACT_SIGNED: Contract = {
  ...CONTRACT_BASE,
  id: 'demo-contract-signed',
  origin: 'EXTERNAL',
  status: 'SIGNED',
  versionNumber: 2,
  signedFileId: 'demo-file-signed',
  sharedAt: '2026-02-03T10:00:00Z',
  signedAt: '2026-02-05T10:00:00Z',
}
const CONTRACT_TERMINATED: Contract = {
  ...CONTRACT_BASE,
  id: 'demo-contract-terminated',
  status: 'TERMINATED',
  signedFileId: 'demo-file-signed-2',
  sharedAt: '2025-01-03T10:00:00Z',
  signedAt: '2025-01-05T10:00:00Z',
  terminatedAt: '2025-11-30T10:00:00Z',
}

/**
 * Visual-only preview of the real /rentals list (RentalListCard) and the
 * real /rentals/:id/contracts contract rows (ContractCard) through mock
 * fixtures - same technique and same reason as PropertiesVisualPreview
 * (Sprint 2): reached the same way (`/ui-preview?view=rentals`), gated by
 * UiPreviewPage behind `VITE_ENABLE_RENTALS_PREVIEW` so a real `pnpm build`
 * never emits this chunk (see UiPreviewPage.tsx/vite.config.ts), but still
 * reachable from the review/E2E production-style build (`.env.e2e`), since
 * neither Playwright nor an independent reviewer can obtain a real
 * authenticated session against the real /rentals routes here.
 *
 * Renders the exact exported RentalListCard/ContractCard components instead
 * of a re-implementation, so this preview can't visually drift from what
 * the real pages render. ContractCard's own mutation hooks
 * (useMarkContractShared/useTerminateContract) stay real - clicking one of
 * its actions here against a fixture id simply fails the same way an
 * invalid/unauthenticated call would in production, through the component's
 * own existing error handling; nothing here fakes a success.
 * RentalListCard's own lifecycle actions are wired to plain no-op callbacks
 * instead (not real mutations) because, unlike ContractCard, RentalListCard
 * takes its action callbacks as props rather than calling mutation hooks
 * itself - RentalsPage is what wires those for the real page, so this
 * preview wires harmless no-ops the same way.
 */
export default function RentalsVisualPreview() {
  const { t } = useTranslation(['rentals', 'contracts'])

  return (
    <AppShellPreview fullViewport>
      <div className={styles['notice']}>
        <Alert tone="info" title="Vista de demostración · Arriendos y Contratos">
          Todos los arriendos y contratos de esta vista son ficticios. Las acciones de esta página pueden intentar
          una llamada real (sin sesión) y fallarán de forma segura - ningún dato ficticio existe en el backend.
        </Alert>
      </div>

      <div className={styles['page']}>
        <div className={styles['header']}>
          <h1 className="text-h2">{t('rentals:title')}</h1>
        </div>

        <section className={styles['section']}>
          <h2 className="text-h3">{t('rentals:title')}</h2>
          <div className={styles['rentalsGrid']} data-testid="rentals-preview-grid">
            <RentalListCard
              rental={DRAFT_READY}
              identity={IDENTITY_FULL}
              activation={{ disabled: false, blockReason: null, isPending: false, errorCode: null, onActivate: () => {} }}
              cancelDraft={{ disabled: false, blockReason: null, isPending: false, errorCode: null, onConfirm: () => {} }}
            />
            <RentalListCard
              rental={DRAFT_BLOCKED}
              identity={IDENTITY_UNKNOWN}
              activation={{
                disabled: true,
                blockReason: 'termsIncomplete',
                isPending: false,
                errorCode: null,
                onActivate: () => {},
              }}
            />
            <RentalListCard
              rental={ACTIVE}
              identity={IDENTITY_ROOM}
              startEnding={{ isPending: false, errorCode: null, onStartEnding: () => {} }}
            />
            <RentalListCard
              rental={ENDING}
              identity={IDENTITY_PARKING}
              endRental={{ isPending: false, errorCode: null, onConfirm: () => {} }}
            />
            <RentalListCard rental={ENDED} identity={IDENTITY_HOUSE} />
            <RentalListCard rental={CANCELLED} identity={IDENTITY_APARTMENT_501} />
          </div>
        </section>

        <section className={styles['section']}>
          <h2 className="text-h3">{t('contracts:title')}</h2>
          <div className={styles['contractsGrid']} data-testid="contracts-preview-grid">
            <ContractCard
              contract={CONTRACT_BASE}
              administrationId="demo"
              relationshipId="demo-rental-active"
              managementBlocked={false}
            />
            <ContractCard
              contract={CONTRACT_SHARED}
              administrationId="demo"
              relationshipId="demo-rental-active"
              managementBlocked={false}
            />
            <ContractCard
              contract={CONTRACT_SIGNED}
              administrationId="demo"
              relationshipId="demo-rental-active"
              managementBlocked={false}
            />
            <ContractCard
              contract={CONTRACT_TERMINATED}
              administrationId="demo"
              relationshipId="demo-rental-active"
              managementBlocked={false}
            />
          </div>
        </section>
      </div>
    </AppShellPreview>
  )
}

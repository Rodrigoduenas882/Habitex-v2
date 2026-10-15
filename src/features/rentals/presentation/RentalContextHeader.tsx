import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { cx } from '@/shared/lib/cx'
import { Alert } from '@/shared/ui/Alert'
import { Badge } from '@/shared/ui/Badge'
import { Skeleton } from '@/shared/ui/Skeleton'
import styles from './RentalContextHeader.module.css'
import { RENTAL_STATUS_TONE } from './rental-status-tone'
import { useRentalIdentities } from '../application/useRentalIdentities'
import { useRentals } from '../application/useRentals'

export type RentalContextSection = 'terms' | 'contracts' | 'charges' | 'payments'

export interface RentalContextHeaderProps {
  administrationId: string
  relationshipId: string
  activeSection: RentalContextSection
}

const NAV_SECTIONS: RentalContextSection[] = ['terms', 'contracts', 'charges', 'payments']

/**
 * Shared sub-navigation header for the 4 narrow /rentals/:id/* pages
 * (terms/contracts/charges/payments) - replaces each page's own bare
 * `<h1>{t('title')}</h1>` with the resolved rental's own identity (subject
 * label, status, tenant) plus a nav row between its 4 sibling sections
 * (DS-002). Mounted once per page with a different `activeSection` each
 * time; the 4 routes themselves stay exactly as already defined in
 * router.tsx - this is pure page-level sub-navigation, not a route
 * consolidation.
 *
 * Resolves the relationship from the already-fetched administration rentals
 * list (useRentals - no getById, same "list is the only read path" pattern
 * every one of the 4 pages already follows) and the identity from
 * useRentalIdentities - both share the same TanStack Query cache the host
 * page's own calls already populated, so this is never a second network
 * request in practice.
 *
 * A relationship genuinely not found in the list (or a failed rentals read)
 * renders a dedicated not-found Alert here - defensive, since in every
 * current call site the host page already performs (and keeps) its own
 * equivalent check before ever mounting this header. A failed *identity*
 * resolution never blocks this header the same way: it degrades to the
 * honest null-field fallback (same convention as RentalListCard/RentalsPage)
 * rather than hiding the header or the page below it.
 */
export function RentalContextHeader({ administrationId, relationshipId, activeSection }: RentalContextHeaderProps) {
  const { t } = useTranslation('rentals')
  const rentalsQuery = useRentals(administrationId)
  const identities = useRentalIdentities(administrationId)

  if (rentalsQuery.isLoading || identities.status === 'loading') {
    return (
      <div className={styles['header']} data-testid="rental-context-header-loading">
        <Skeleton height={32} width={240} />
        <Skeleton height={36} width={360} />
      </div>
    )
  }

  if (rentalsQuery.isError) {
    return <Alert tone="danger">{t('contextHeader.relationshipNotFound')}</Alert>
  }

  const relationship = (rentalsQuery.data ?? []).find((rental) => rental.id === relationshipId) ?? null

  if (!relationship) {
    return <Alert tone="danger">{t('contextHeader.relationshipNotFound')}</Alert>
  }

  // identities.status === 'error' degrades to this same fallback (its own
  // byRelationshipId is then an empty Map, so .get always misses) - never
  // blocks this header from rendering the rest of the page below it.
  const identity = identities.byRelationshipId.get(relationshipId) ?? {
    subjectLabel: null,
    tenantName: null,
    rentAmount: null,
  }

  return (
    <div className={styles['header']}>
      <div className={styles['titleRow']}>
        <h1 className="text-h2">{identity.subjectLabel ?? t('list.subjectUnknown')}</h1>
        <Badge tone={RENTAL_STATUS_TONE[relationship.status]}>{t(`status.${relationship.status}`)}</Badge>
      </div>
      {identity.tenantName ? <p className="text-body-sm text-muted">{identity.tenantName}</p> : null}
      <nav className={styles['nav']} aria-label={t('contextHeader.navLabel')}>
        {NAV_SECTIONS.map((section) => (
          <Link
            key={section}
            to={`/rentals/${relationshipId}/${section}`}
            className={cx(styles['navItem'], activeSection === section && styles['navItemActive'])}
            aria-current={activeSection === section ? 'page' : undefined}
          >
            {t(`contextHeader.nav.${section}`)}
          </Link>
        ))}
      </nav>
    </div>
  )
}

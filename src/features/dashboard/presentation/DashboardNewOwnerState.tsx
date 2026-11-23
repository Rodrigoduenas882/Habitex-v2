import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { cx } from '@/shared/lib/cx'
import buttonStyles from '@/shared/ui/Button.module.css'
import { Card } from '@/shared/ui/Card'
import { IconBadge } from '@/shared/ui/IconBadge'
import { BuildingIcon } from '@/shared/ui/icons'
import styles from './DashboardNewOwnerState.module.css'

export interface DashboardNewOwnerStateProps {
  /** The signed-in owner's display name (see getDisplayNameFromEmail) -
   * `null` falls back to a generic greeting, same convention as
   * DashboardHeader's own name prop. */
  name: string | null
}

/**
 * Estado A (INC-DASH-01) - real implementation of the approved prototype
 * (src/app/pages/ui-preview/dashboard-redesign/StateNewOwner.tsx): a
 * personalized greeting, one short explanation, and a single real CTA to
 * add the first property. Deliberately no empty charts/zeroed KPIs and no
 * action the owner can't complete yet - same rationale as the prototype's
 * own doc comment.
 *
 * Differences from the prototype (this is the real page, not a visual
 * exploration):
 * - `name` comes from the real auth session (via getDisplayNameFromEmail),
 *   never the prototype's REDESIGN_OWNER_NAME fixture.
 * - The CTA is a real `<Link to="/properties/new">` (react-router-dom),
 *   styled with the shared Button's own classes (Button.module.css) - same
 *   "Link styled as a Button" pattern NotFoundPage already uses, not a
 *   `<button onClick={() => {}}>` no-op.
 * - The card reads its surface/border from the shared Card primitive
 *   (--color-surface/-border via shared/ui/Card), not the prototype-only
 *   --dashboard-redesign-card-* tokens, which don't exist outside
 *   /ui-preview.
 */
export function DashboardNewOwnerState({ name }: DashboardNewOwnerStateProps) {
  const { t } = useTranslation('dashboard')

  return (
    <div className={styles['wrapper']}>
      <div className={styles['intro']}>
        <p className={cx('text-caption', styles['eyebrow'])}>{t('lifecycle.newOwner.eyebrow')}</p>
        <h1 className={cx('text-display', styles['title'])}>
          {name ? t('lifecycle.newOwner.titleWithName', { name }) : t('lifecycle.newOwner.titleGeneric')}
        </h1>
        <p className={cx('text-body', 'text-muted', styles['subtitle'])}>{t('lifecycle.newOwner.subtitle')}</p>
      </div>

      <Card className={styles['addCard']}>
        <IconBadge icon={<BuildingIcon size={28} />} tone="primary" size={56} radius="full" />
        <div className={styles['addBody']}>
          <p className="text-h3">{t('lifecycle.newOwner.addCardTitle')}</p>
          <p className={cx('text-body-sm', 'text-muted')}>{t('lifecycle.newOwner.addCardDescription')}</p>
          <Link
            to="/properties/new"
            className={cx(buttonStyles['button'], buttonStyles['primary'], buttonStyles['md'], styles['addButton'])}
          >
            {t('lifecycle.newOwner.cta')}
          </Link>
        </div>
      </Card>
    </div>
  )
}

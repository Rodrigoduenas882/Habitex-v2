import { cx } from '@/shared/lib/cx'
import { Button } from '@/shared/ui/Button'
import { IconBadge } from '@/shared/ui/IconBadge'
import { BuildingIcon } from '@/shared/ui/icons'
import { REDESIGN_OWNER_NAME } from './dashboard-redesign-mock-data'
import styles from './StateNewOwner.module.css'

/**
 * Estado A - propietario nuevo, sin inmuebles. Deliberately minimal: a
 * personalized greeting, one short plain-language explanation of what to do
 * first, and a single primary action. No empty charts, no zeroed-out
 * metrics (0 arriendos, $0 cobrado...) and no action the user can't actually
 * complete yet (no "Registrar pago"/"Ver reportes") - see docs/DESIGN.md §1
 * (claridad antes que decoración) and the Parte 1 brief for this prototype.
 *
 * Iteration (Parte 2, 2026-11): left-aligned instead of centered, so the
 * section reads like every other real page header (DashboardHeader,
 * PropertiesPage, etc.) and the CTA card spans the content width instead of
 * floating as a small centered block - that fills the otherwise-empty page
 * without inventing any fake metric or decorative filler, which the brief
 * explicitly rules out. The greeting itself uses `.text-display` (the
 * existing 40px token in shared/theme/typography.css, already cataloged in
 * the UI preview's TypographySection but not yet used by any real page) for
 * more visual weight than the real Dashboard's own `.text-h1` greeting -
 * justified here because this is the single thing on the page, acting as a
 * first-run hero moment rather than a routine page header.
 *
 * The CTA is no longer the whole-card-is-a-button pattern: a plain
 * (non-interactive) card now carries the icon/copy, and a real `Button`
 * (`variant="primary"`) is the one unambiguous affordance to add the first
 * property - clearer for sighted users than a card that merely looks
 * clickable, and avoids nesting a <button> inside a <button> for
 * assistive tech. Still visual-only (no real navigation) - this is a design
 * exploration, not a wired flow; see DashboardRedesignPrototype's own Alert.
 */
export function StateNewOwner() {
  return (
    <div className={styles['wrapper']}>
      <div className={styles['intro']}>
        <p className={cx('text-caption', styles['eyebrow'])}>Hola</p>
        <h1 className={cx('text-display', styles['title'])}>¡Bienvenida, {REDESIGN_OWNER_NAME}!</h1>
        <p className={cx('text-body', 'text-muted', styles['subtitle'])}>
          Todavía no tienes inmuebles registrados. Agrega el primero para empezar a administrarlo desde aquí.
        </p>
      </div>

      <div className={styles['addCard']}>
        <IconBadge icon={<BuildingIcon size={28} />} tone="primary" size={56} radius="full" />
        <div className={styles['addBody']}>
          <p className="text-h3">Agregar tu primer inmueble</p>
          <p className={cx('text-body-sm', 'text-muted')}>Registra su dirección y tipo en pocos minutos.</p>
          <Button variant="primary" className={styles['addButton']} onClick={() => {}}>
            Agregar inmueble
          </Button>
        </div>
      </div>
    </div>
  )
}

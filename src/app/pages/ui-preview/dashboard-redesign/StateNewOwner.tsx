import { cx } from '@/shared/lib/cx'
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
 * The CTA is visual-only (no real navigation) - this is a design
 * exploration, not a wired flow; see DashboardRedesignPrototype's own Alert.
 */
export function StateNewOwner() {
  return (
    <div className={styles['wrapper']}>
      <div className={styles['intro']}>
        <p className={cx('text-caption', styles['eyebrow'])}>Hola</p>
        <h1 className="text-h1">¡Bienvenida, {REDESIGN_OWNER_NAME}!</h1>
        <p className={cx('text-body', 'text-muted', styles['subtitle'])}>
          Todavía no tienes inmuebles registrados. Agrega el primero para empezar a administrarlo desde aquí.
        </p>
      </div>

      <button type="button" className={styles['addCard']} onClick={() => {}}>
        <IconBadge
          icon={<BuildingIcon size={28} />}
          tone="primary"
          size={56}
          radius="full"
          className={styles['addIcon']}
        />
        <div className={styles['addBody']}>
          <p className="text-h3">Agregar tu primer inmueble</p>
          <p className={cx('text-body-sm', 'text-muted')}>Registra su dirección y tipo en pocos minutos.</p>
        </div>
      </button>
    </div>
  )
}

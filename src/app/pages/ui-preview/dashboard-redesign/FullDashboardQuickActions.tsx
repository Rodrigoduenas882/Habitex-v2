import type { ReactNode } from 'react'
import { cx } from '@/shared/lib/cx'
import { IconBadge } from '@/shared/ui/IconBadge'
import { ArrowRightIcon, BuildingIcon, UsersIcon, WalletIcon, type IconProps } from '@/shared/ui/icons'
import styles from './FullDashboardQuickActions.module.css'

const ACTIONS: Array<{ key: string; label: string; icon: (props: IconProps) => ReactNode; primary?: boolean }> = [
  { key: 'register-payment', label: 'Registrar pago', icon: WalletIcon, primary: true },
  { key: 'view-properties', label: 'Ver inmuebles', icon: BuildingIcon },
  { key: 'add-property', label: 'Agregar inmueble', icon: BuildingIcon },
  { key: 'view-rentals', label: 'Ver arriendos', icon: UsersIcon },
]

/**
 * Decisión de diseño 5 (Accesos rápidos contextuales): 4 botones, ninguno
 * duplica un CTA ya presente como protagonista de otra sección de este mismo
 * Estado C (atención/obligaciones/gráfico son listas informativas, no CTAs).
 * "Registrar arriendo" se queda fuera deliberadamente - Camila ya tiene
 * arriendos activos en este estado, así que esa acción pertenece a los
 * Estados A/B, no a este. Igual que el resto del prototipo, son 100%
 * visuales: `onClick={() => {}}`, sin navegación real (ver el Alert de
 * DashboardRedesignPrototype).
 *
 * Iteración (Parte 2, 2026-11): los 4 botones ya no tienen el mismo peso
 * visual. "Registrar pago" es, de las 4, la acción que más directamente
 * resuelve lo que "Elementos que requiere atención" de arriba ya señaló
 * (pago reportado por confirmar, cargo vencido) - se marca `primary: true` y
 * usa `--color-primary` como fondo sólido (mismo tono que un `Button`
 * `variant="primary"`, pero manteniendo el tile existente en vez de
 * introducir el primitive `Button` aquí, para no arriesgar la misma pelea
 * de especificidad CSS entre módulos que motivó los tokens
 * `--dashboard-redesign-card-*` - ver el comentario de tokens.css). Las
 * otras 3 se quedan en el tratamiento "secundario" que ya tenían (tile con
 * borde, fondo `--color-surface`).
 */
export function FullDashboardQuickActions() {
  return (
    <div>
      <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>
        Accesos rápidos
      </h2>
      <div className={styles['grid']}>
        {ACTIONS.map(({ key, label, icon: Icon, primary = false }) => (
          <button
            key={key}
            type="button"
            className={cx(styles['action'], primary && styles['actionPrimary'])}
            onClick={() => {}}
          >
            {primary ? (
              <Icon size={18} className={styles['primaryIcon']} />
            ) : (
              <IconBadge icon={<Icon size={16} />} tone="primary" size={28} radius="sm" />
            )}
            <span className={cx('text-body-sm', styles['label'])}>{label}</span>
            <ArrowRightIcon size={16} className={styles['arrow']} />
          </button>
        ))}
      </div>
    </div>
  )
}

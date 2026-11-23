import type { ReactNode } from 'react'
import { cx } from '@/shared/lib/cx'
import { Badge, type BadgeTone } from '@/shared/ui/Badge'
import { IconBadge, type IconBadgeTone } from '@/shared/ui/IconBadge'
import { AlertTriangleIcon, FileTextIcon, WalletIcon, type IconProps } from '@/shared/ui/icons'
import { REDESIGN_ATTENTION_ITEMS, type RedesignAttentionKind } from './dashboard-redesign-mock-data'
import styles from './FullDashboardAttention.module.css'

const KIND_ICON: Record<RedesignAttentionKind, (props: IconProps) => ReactNode> = {
  reportedPayment: WalletIcon,
  overdueCharge: AlertTriangleIcon,
  endingContract: FileTextIcon,
}

const KIND_TONE: Record<RedesignAttentionKind, IconBadgeTone> = {
  reportedPayment: 'info',
  overdueCharge: 'danger',
  endingContract: 'warning',
}

const KIND_BADGE: Record<RedesignAttentionKind, { label: string; tone: BadgeTone }> = {
  reportedPayment: { label: 'Por confirmar', tone: 'info' },
  overdueCharge: { label: 'Vencido', tone: 'danger' },
  endingContract: { label: 'Por vencer', tone: 'warning' },
}

/** Matching `styles['item-<kind>']` modifier per severity - see the
 * .module.css's own comment on the left-border treatment this adds. */
const KIND_ITEM_CLASS: Record<RedesignAttentionKind, string> = {
  reportedPayment: 'itemInfo',
  overdueCharge: 'itemDanger',
  endingContract: 'itemWarning',
}

/**
 * Decisión de diseño 2 (Elementos que requieren atención): panel
 * independiente del resumen financiero, con 3 ítems ficticios concretos
 * (pago reportado sin confirmar, cargo vencido, contrato por vencer) - cada
 * uno trazable a un concepto real (PaymentStatus 'REPORTED',
 * ChargeFinancialStatus 'OVERDUE', RentalRelationship.expectedEndDate). Sigue
 * la misma filosofía de accesibilidad que AttentionPanel.tsx real: un
 * `role="list"`/`aria-label`, encabezado real por ítem (no solo color) y un
 * Badge de texto explícito (no solo el tono del IconBadge) para cada estado.
 *
 * Iteración (Parte 2, 2026-11):
 * - Decisión 2: este panel ahora ocupa la columna ANCHA del grid de
 *   analytics en desktop (ver StateFullDashboard.module.css) en vez de la
 *   angosta que ocupaba antes junto al gráfico de ingresos.
 * - Ya no usa el `<Card>` compartido (evita pelear especificidad CSS con
 *   Card.module.css - ver el comentario de tokens.css sobre
 *   --dashboard-redesign-card-surface) - el `<div>` de abajo replica la
 *   misma forma (radius-lg/shadow-sm/space-6) pero lee su superficie de los
 *   tokens `--dashboard-redesign-card-*`.
 * - Cada ítem ahora tiene un borde lateral de color por severidad (info/
 *   danger/warning, misma asignación que KIND_TONE/KIND_BADGE) además del
 *   IconBadge + Badge de texto ya existentes - un tercer refuerzo visual sin
 *   depender de neón/gradiente.
 */
export function FullDashboardAttention() {
  return (
    <div className={styles['panel']}>
      <div className={styles['header']}>
        <h2 className="text-h3">Elementos que requieren atención</h2>
        <p className="text-caption">Pagos, cargos y contratos que necesitan una acción ahora</p>
      </div>

      <ul className={styles['list']} role="list" aria-label="Elementos que requieren atención">
        {REDESIGN_ATTENTION_ITEMS.map((item) => {
          const Icon = KIND_ICON[item.kind]
          const badge = KIND_BADGE[item.kind]
          return (
            <li key={item.id} className={cx(styles['item'], styles[KIND_ITEM_CLASS[item.kind]])}>
              <IconBadge icon={<Icon size={18} />} tone={KIND_TONE[item.kind]} size={36} radius="md" />
              <div className={styles['itemBody']}>
                <p className={styles['itemTitle']}>{item.title}</p>
                <p className="text-caption text-muted">{item.subtitle}</p>
              </div>
              <div className={styles['itemMeta']}>
                <Badge tone={badge.tone}>{badge.label}</Badge>
                <span className="text-body-sm tabular-nums">{item.amountLabel}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

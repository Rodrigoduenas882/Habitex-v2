import type { ReactNode } from 'react'
import { Badge, type BadgeTone } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
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

/**
 * Decisión de diseño 2 (Elementos que requieren atención): panel
 * independiente del resumen financiero, con 3 ítems ficticios concretos
 * (pago reportado sin confirmar, cargo vencido, contrato por vencer) - cada
 * uno trazable a un concepto real (PaymentStatus 'REPORTED',
 * ChargeFinancialStatus 'OVERDUE', RentalRelationship.expectedEndDate). Sigue
 * la misma filosofía de accesibilidad que AttentionPanel.tsx real: un
 * `role="list"`/`aria-label`, encabezado real por ítem (no solo color) y un
 * Badge de texto explícito (no solo el tono del IconBadge) para cada estado.
 */
export function FullDashboardAttention() {
  return (
    <Card className={styles['panel']}>
      <div className={styles['header']}>
        <h2 className="text-h3">Elementos que requieren atención</h2>
        <p className="text-caption">Pagos, cargos y contratos que necesitan una acción ahora</p>
      </div>

      <ul className={styles['list']} role="list" aria-label="Elementos que requieren atención">
        {REDESIGN_ATTENTION_ITEMS.map((item) => {
          const Icon = KIND_ICON[item.kind]
          const badge = KIND_BADGE[item.kind]
          return (
            <li key={item.id} className={styles['item']}>
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
    </Card>
  )
}

import type { ReactNode } from 'react'
import { RentalStepper, type RentalFlowStep } from './RentalStepper'
import { RentalSummaryPanel, type RentalSummaryPanelProps } from './RentalSummaryPanel'
import styles from './RentalFlowLayout.module.css'

export type RentalFlowLayoutVariant = 'stacked' | 'sidebar'

export interface RentalFlowLayoutProps {
  step: RentalFlowStep
  /**
   * 'sidebar' (default, unchanged since the first P1 fix - Contrato,
   * step 4): the resumen is a right-hand sidebar on desktop (>=1024px),
   * stacked below `children` on narrower widths. Requires `summary`.
   *
   * 'stacked' (Creación/Selección, Arrendatario, Condiciones - steps 1-3,
   * second correction, docs/DESIGN.md §16.6 - Figma `Habitex-Design-Lab`
   * 370:3/370:477/370:622): no grid, no side-by-side column - the resumen
   * is rendered by the caller as part of `children` itself (right after the
   * title/header, before the step's own main content), so its position on
   * screen is identical at every viewport width, never reordered by a media
   * query. `summary` is ignored in this mode - pass the resumen panel
   * inline instead.
   */
  variant?: RentalFlowLayoutVariant
  summary?: RentalSummaryPanelProps
  children: ReactNode
}

/**
 * Shared stepper + content shell for the 4 steps of the Arriendos creation
 * flow (docs/DESIGN.md §16.6).
 */
export function RentalFlowLayout({ step, variant = 'sidebar', summary, children }: RentalFlowLayoutProps) {
  if (variant === 'stacked') {
    return (
      <div className={styles['pageStacked']}>
        <RentalStepper currentStep={step} />
        {children}
      </div>
    )
  }

  return (
    <div className={styles['page']}>
      <RentalStepper currentStep={step} />
      <div className={styles['layout']}>
        <div className={styles['main']}>{children}</div>
        {summary ? <RentalSummaryPanel {...summary} /> : null}
      </div>
    </div>
  )
}

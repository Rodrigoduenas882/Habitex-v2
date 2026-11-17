import type { ReactNode } from 'react'
import { RentalStepper, type RentalFlowStep } from './RentalStepper'
import { RentalSummaryPanel, type RentalSummaryPanelProps } from './RentalSummaryPanel'
import styles from './RentalFlowLayout.module.css'

export interface RentalFlowLayoutProps {
  step: RentalFlowStep
  summary: RentalSummaryPanelProps
  children: ReactNode
}

/**
 * Shared stepper + two-column (content/resumen) shell for the 4 steps of the
 * Arriendos creation flow (docs/DESIGN.md §16.6 - Figma `Habitex-Design-Lab`
 * 370:3/370:477/370:716): used by AddRentalPage (step 1), AddRentalDraftForm
 * (step 2), RentalTermsPage (step 3), and RentalContractsPage (step 4,
 * cross-feature import - same established pattern as RentalContextHeader).
 *
 * Desktop (>=1024px) shows the resumen as a sidebar next to the step
 * content; below that it stacks underneath - reuses the existing 1024px
 * breakpoint (docs/DESIGN.md §7/§8), no new one introduced.
 */
export function RentalFlowLayout({ step, summary, children }: RentalFlowLayoutProps) {
  return (
    <div className={styles['page']}>
      <RentalStepper currentStep={step} />
      <div className={styles['layout']}>
        <div className={styles['main']}>{children}</div>
        <RentalSummaryPanel {...summary} />
      </div>
    </div>
  )
}

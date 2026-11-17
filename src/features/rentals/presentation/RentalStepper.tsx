import { useTranslation } from 'react-i18next'
import { cx } from '@/shared/lib/cx'
import { CheckIcon } from '@/shared/ui/icons'
import styles from './RentalStepper.module.css'

export type RentalFlowStep = 1 | 2 | 3 | 4

const STEP_KEYS = ['selection', 'tenant', 'terms', 'contract'] as const

/**
 * Purely informational progress indicator for the Arriendos creation flow
 * (01 Selección -> 02 Arrendatario -> 03 Condiciones -> 04 Contrato,
 * docs/DESIGN.md §16.6 - Figma `Habitex-Design-Lab` 370:3/370:477/370:716).
 *
 * Deliberately NOT a wizard: `currentStep` is derived by each host page from
 * where the user actually is (which real route/sub-state they're on), never
 * from local stepper state - clicking a step does nothing (no `onStepClick`
 * prop exists) and no new route is introduced. A step below `currentStep` is
 * shown as "done" because reaching a later step is only possible once the
 * earlier ones' backend preconditions are already met (e.g. reaching
 * /rentals/:id/terms means create_rental_draft already succeeded) - never a
 * client-side guess about data that might not exist.
 *
 * Renders as a plain <ol>, never a heading, so it can sit above
 * RentalContextHeader's own <h1> without producing a second level-1 (or any)
 * heading on the page.
 */
export function RentalStepper({ currentStep }: { currentStep: RentalFlowStep }) {
  const { t } = useTranslation('rentals')

  return (
    <ol className={styles['list']} aria-label={t('stepper.ariaLabel')}>
      {STEP_KEYS.map((key, index) => {
        const step = (index + 1) as RentalFlowStep
        const state = step < currentStep ? 'done' : step === currentStep ? 'current' : 'upcoming'

        return (
          <li key={key} className={styles['step']}>
            {index > 0 ? <span className={styles['connector']} aria-hidden="true" /> : null}
            <span
              className={cx(styles['badge'], state === 'done' && styles['badgeDone'], state === 'current' && styles['badgeCurrent'])}
              aria-hidden="true"
            >
              {state === 'done' ? <CheckIcon size={12} /> : step}
            </span>
            <span
              className={cx(styles['label'], state === 'current' && styles['labelCurrent'])}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              {t(`stepper.steps.${key}`)}
              <span className="sr-only">
                {' '}
                {t(`stepper.status.${state}`)}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

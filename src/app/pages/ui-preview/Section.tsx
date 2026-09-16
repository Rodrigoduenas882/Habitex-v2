import type { ReactNode } from 'react'
import styles from './Section.module.css'

export interface SectionProps {
  id: string
  title: string
  description?: string
  children: ReactNode
}

export function Section({ id, title, description, children }: SectionProps) {
  const headingId = `${id}-heading`

  return (
    <section id={id} className={styles['section']} aria-labelledby={headingId}>
      <div className={styles['sectionHeader']}>
        <h2 id={headingId} className="text-h2">
          {title}
        </h2>
        {description ? <p className="text-body-sm text-muted">{description}</p> : null}
      </div>
      <div className={styles['sectionBody']}>{children}</div>
    </section>
  )
}

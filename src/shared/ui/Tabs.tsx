import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '@/shared/lib/cx'
import styles from './Tabs.module.css'

export interface TabItem {
  value: string
  label: string
  content: ReactNode
}

export interface TabsProps {
  items: TabItem[]
  defaultValue?: string
  /** Accessible name for the tablist (translated by the caller). */
  ariaLabel?: string
  className?: string
}

export function Tabs({ items, defaultValue, ariaLabel, className }: TabsProps) {
  const idPrefix = useId()
  const [active, setActive] = useState(defaultValue ?? items[0]?.value ?? '')
  const tablistRef = useRef<HTMLDivElement>(null)

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return

    event.preventDefault()
    const currentIndex = items.findIndex((item) => item.value === active)
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const nextIndex = (currentIndex + direction + items.length) % items.length
    const nextItem = items[nextIndex]
    if (!nextItem) return

    setActive(nextItem.value)
    const nextTab = tablistRef.current?.querySelectorAll('[role="tab"]')[nextIndex]
    if (nextTab instanceof HTMLElement) nextTab.focus()
  }

  return (
    <div className={className}>
      <div role="tablist" ref={tablistRef} aria-label={ariaLabel} className={styles['tablist']}>
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${item.value}`}
            aria-selected={item.value === active}
            aria-controls={`${idPrefix}-panel-${item.value}`}
            tabIndex={item.value === active ? 0 : -1}
            className={cx(styles['tab'], item.value === active && styles['tabActive'])}
            onClick={() => {
              setActive(item.value)
            }}
            onKeyDown={handleKeyDown}
          >
            {item.label}
          </button>
        ))}
      </div>
      {items.map((item) =>
        item.value === active ? (
          <div
            key={item.value}
            role="tabpanel"
            id={`${idPrefix}-panel-${item.value}`}
            aria-labelledby={`${idPrefix}-tab-${item.value}`}
            className={styles['panel']}
          >
            {item.content}
          </div>
        ) : null,
      )}
    </div>
  )
}

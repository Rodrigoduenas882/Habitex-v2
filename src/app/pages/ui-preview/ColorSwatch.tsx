import styles from './ColorSwatch.module.css'

export interface ColorToken {
  name: string
  cssVar: string
}

export function ColorSwatchGrid({ tokens }: { tokens: ColorToken[] }) {
  return (
    <div className={styles['grid']}>
      {tokens.map((token) => (
        <div key={token.cssVar} className={styles['swatch']}>
          <div className={styles['box']} style={{ background: `var(${token.cssVar})` }} />
          <span className={styles['name']}>{token.name}</span>
          <span className={styles['token']}>{token.cssVar}</span>
        </div>
      ))}
    </div>
  )
}

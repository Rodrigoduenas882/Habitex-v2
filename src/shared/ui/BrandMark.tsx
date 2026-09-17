import { cx } from '@/shared/lib/cx'
import styles from './BrandMark.module.css'

export interface BrandMarkProps {
  /** Rendered width/height in px - it's a 1:1 square asset. */
  size?: number
  className?: string
  /**
   * Only pass this when the mark appears completely on its own (e.g. the
   * boot screen). When a visible "Habitex" wordmark sits right next to it
   * (BrandLogo), leave this unset - the mark is then purely decorative and
   * the wordmark alone carries the accessible name, so the two don't get
   * announced twice.
   */
  'aria-label'?: string
}

/**
 * The single source of the Habitex symbol - a photographic PNG export of
 * the approved mark (public/images/brand/habitex-mark.png), used as-is.
 *
 * This is deliberately the raster export, not a hand-traced SVG: the
 * approved asset is a raster file with a gradient-shaded roof, and
 * redrawing its bezier paths by eye risks subtly reinterpreting the
 * geometry, which is explicitly what we're avoiding. The PNG already has a
 * transparent background (verified - no baked-in white square), so it
 * drops onto any surface/theme without a plate behind it. A clean vector
 * redraw (for favicon/PWA use) should come from the original design file,
 * not be reverse-engineered from this export.
 */
export function BrandMark({ size = 28, className, 'aria-label': ariaLabel }: BrandMarkProps) {
  return (
    <img
      src="/images/brand/habitex-mark.png"
      width={size}
      height={size}
      alt={ariaLabel ?? ''}
      draggable={false}
      className={cx(styles['mark'], className)}
    />
  )
}

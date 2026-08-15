// AULOS HARNESS brand wordmark: the square brand mark (public/branding/icon.png)
// + the complete AULOS letterform image (public/branding/aulos.png, trimmed
// only of the original canvas's outer transparent padding — all five letters
// intact) + "HARNESS" knocked out on an ink plate, so the badge keeps the
// previous wordmark's plate feel in both themes. Height rides the `size`
// prop; the mark, letterforms, and badge scale from it through the
// --dsh-brand-wordmark-height custom property.

import clsx from 'clsx'
import type { CSSProperties } from 'react'
import type { IconProps } from './icons/props.ts'
import css from './BrandWordmark.module.css'

/**
 * Render the full brand wordmark.
 * @param props.size - height in px (default 24).
 * @param props.className - extra class for layout placement.
 * @returns the wordmark element (aria-hidden decorative brand art).
 */
export function BrandWordmark({ size = 24, className }: IconProps) {
  return (
    <span
      className={clsx(css.root, className)}
      style={{ '--dsh-brand-wordmark-height': `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <img src="/branding/icon.png" alt="" className={css.mark} draggable={false} />
      <img src="/branding/aulos.png" alt="" className={css.aulos} draggable={false} />
      <span className={css.badge}>HARNESS</span>
    </span>
  )
}

// The AULOS brand mark: the single shared branding image (apps/web's
// public/branding/icon.png, served at the web root). Header and hero both
// render this same asset at different sizes; the png is never inlined or
// edited here.

import type { IconProps } from './icons/props.ts'

/**
 * Render the brand mark image.
 * @param props.size - square edge in px (default 24).
 * @param props.className - extra class for layout placement.
 * @returns the mark img (decorative; pair with the wordmark text or headline).
 */
export function BrandMark({ size = 24, className }: IconProps) {
  return (
    <img
      src="/branding/icon.png"
      alt=""
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  )
}

import type { CSSProperties } from 'react'
import type { HeroBrandCopyOwnerProps, HeroBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import css from './Brand.module.css'

type AulosBrandMarkProps = HeroBrandMarkOwnerProps & SidebarBrandMarkOwnerProps

/**
 * Render the shared AULOS mark with host-supplied geometry.
 * @param props - Host-supplied mark presentation.
 * @returns the AULOS image mark.
 */
export function AulosBrandMark({ size, className }: AulosBrandMarkProps) {
  return <img src="/branding/icon.png" alt="" width={size} height={size} className={className} draggable={false} />
}

/**
 * Render the AULOS Hero title in shell-owned typography.
 * @param props - Host-supplied copy presentation.
 * @returns the AULOS Hero title.
 */
export function AulosHeroTitle({ className }: HeroBrandCopyOwnerProps) {
  return <span className={className}>Orchestrate Intelligence.</span>
}

/**
 * Render the AULOS Hero subtitle in shell-owned typography.
 * @param props - Host-supplied copy presentation.
 * @returns the AULOS Hero subtitle.
 */
export function AulosHeroSubtitle({ className }: HeroBrandCopyOwnerProps) {
  return <span className={className}>The Power of AI, Harnessed.</span>
}

/**
 * Render the AULOS name artwork without duplicating the independently slotted mark.
 * @returns the AULOS wordmark.
 */
export function AulosBrandName() {
  return (
    <span className={css.root} style={{ '--aulos-brand-height': '24px' } as CSSProperties} aria-hidden="true">
      <img src="/branding/aulos.png" alt="" className={css.aulos} draggable={false} />
      <span className={css.badge}>HARNESS</span>
    </span>
  )
}

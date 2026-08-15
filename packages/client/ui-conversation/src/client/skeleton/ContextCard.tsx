/**
 * Compact Context Card: the current session's occupancy, token, cache, and
 * performance figures in one card above the chat transcript (the dense
 * successor to the removed right-inspector Context tab). Every figure rides
 * the same durable projections and the same display folds as the composer
 * stats strip — `contextPressure` (occupancy), `tokenUsage` (billing buckets
 * + cache), `sessionStats` (TTFT / decode throughput) — so this card never
 * recomputes telemetry and never parses session events.
 */

import type { UseProjection } from '@deepseek-ai/dsh-client-runtime/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { formatCompactTokens } from '@deepseek-ai/dsh-client-ui-primitives'
// Type-only: merges the sessionStats projection key into SessionProjectionMap.
import type {} from '@deepseek-ai/dsh-session-stats/client'
import {
  billedInputTokens, cacheHitPercent, contextOccupancy, formatDuration,
} from '../chat/StatsLine.tsx'
import { formatTokensPerSecond } from '../chat/message-chrome.ts'
import css from './ContextCard.module.css'

/** Mini context ring geometry: 34px viewBox, 4px stroke. */
const RING_RADIUS = 15
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/** One labeled column of the card. */
function Group({ label, value, sub, children }: {
  label: string
  value: string
  sub?: string | undefined
  children?: React.ReactNode
}) {
  return (
    <div className={css.group}>
      <div className={css.groupLabel}>{label}</div>
      <div className={css.groupValue}>
        {children}
        <span className={css.groupValueText}>{value}</span>
      </div>
      <div className={css.groupSub}>{sub ?? '\u00a0'}</div>
    </div>
  )
}

/** Small occupancy ring shown beside the context percent. */
function MiniRing({ percent }: { percent: number }) {
  return (
    <svg className={css.ring} viewBox="0 0 34 34" width="20" height="20" aria-hidden>
      <circle className={css.ringTrack} cx="17" cy="17" r={RING_RADIUS} />
      <circle
        className={css.ringFill}
        cx="17"
        cy="17"
        r={RING_RADIUS}
        strokeDasharray={`${RING_CIRCUMFERENCE * percent / 100} ${RING_CIRCUMFERENCE}`}
        transform="rotate(-90 17 17)"
      />
    </svg>
  )
}

/** Card props: the standard projection read seat plus the conversation locale seat. */
export interface ContextCardProps {
  useProjection: UseProjection
  t: TranslateNS<'conversation'>
}

/**
 * Render the compact context card; null while no projection value exists.
 * @param props - projection seat and locale seat.
 * @returns the card, or null when the session has no reportable data.
 */
export function ContextCard({ useProjection, t }: ContextCardProps) {
  const pressure = useProjection('contextPressure')
  const usage = useProjection('tokenUsage')
  const stats = useProjection('sessionStats')
  const context = contextOccupancy(pressure)
  const billed = usage === undefined ? 0 : billedInputTokens(usage)
  const cacheHit = usage === undefined ? null : cacheHitPercent(usage)
  const hasTokens = usage !== undefined && (billed > 0 || usage.outputTokens > 0)
  const hasPerformance = stats !== undefined && (stats.ttftSteps > 0 || stats.decodeMs > 0)
  if (context === null && !hasTokens && !hasPerformance) return null
  return (
    // A passive readout, not an announcement region: figures change on every
    // request frame, and aria-live would re-announce the whole card each time.
    <div className={css.root} role="group" aria-label={t('contextCard.aria')}>
      <Group
        label={t('contextCard.context')}
        value={context === null ? '—' : `${context.percent}%`}
        sub={context === null
          ? undefined
          : `${formatCompactTokens(context.usedTokens)} / ${formatCompactTokens(context.contextWindow)}`}
      >
        {context !== null && <MiniRing percent={context.percent} />}
      </Group>
      <Group
        label={t('contextCard.tokens')}
        value={usage !== undefined && hasTokens
          ? `${formatCompactTokens(billed)} / ${formatCompactTokens(usage.outputTokens)}`
          : '—'}
        sub={usage !== undefined && hasTokens ? t('contextCard.tokensSub') : undefined}
      />
      <Group
        label={t('contextCard.cache')}
        value={cacheHit === null ? '—' : `${cacheHit}%`}
        sub={cacheHit === null || usage === undefined
          ? undefined
          : `${formatCompactTokens(usage.cacheReadTokens)} / ${formatCompactTokens(usage.cacheWriteTokens)}`}
      />
      <Group
        label={t('contextCard.ttft')}
        value={stats !== undefined && stats.ttftSteps > 0
          ? formatDuration(stats.ttftMs / stats.ttftSteps)
          : '—'}
        sub={stats !== undefined && stats.decodeMs > 0
          ? t('stats.tokensPerSecond', {
            throughput: formatTokensPerSecond(stats.decodeTokens / (stats.decodeMs / 1_000)),
          })
          : undefined}
      />
    </div>
  )
}

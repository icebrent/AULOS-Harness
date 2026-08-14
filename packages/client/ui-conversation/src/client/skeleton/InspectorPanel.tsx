/**
 * InspectorPanel: the right column of the workspace layout — Context and
 * Activity tabs over the official session projections, with the selected
 * tool call's details as an embedded view.
 *
 * Every figure rides a durable projection the host already computes:
 * `contextPressure` / `contextBreakdown` (context occupancy), `tokenUsage`
 * (billing buckets + cache), and `sessionStats` (turn/step counts and wall
 * times). Nothing is re-derived from raw events; the presentation only
 * reshapes existing data. The model row is deliberately absent: the model
 * directory is a service, not a projection, so a reliable value is not
 * available to a pure reader here.
 */

import { useState } from 'react'
import clsx from 'clsx'
import type { ConversationSnapshot, UseProjection } from '@deepseek-ai/dsh-client-runtime/client'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: merges the sessionStats projection key into SessionProjectionMap.
import type {} from '@deepseek-ai/dsh-session-stats/client'
import type { DetailsSlotProps } from '../contract/slots.ts'
import { DetailsPanel } from './DetailsPanel.tsx'
import {
  billedInputTokens, cacheHitPercent, contextOccupancy, formatDuration, formatTokens,
} from '../chat/StatsLine.tsx'
import { formatTokensPerSecond } from '../chat/message-chrome.ts'
import css from './InspectorPanel.module.css'

/** Ring geometry: 44px viewBox, 4.5px stroke. */
const RING_RADIUS = 19
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/** One label/value row in a stats group. */
function StatRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={css.statRow}>
      <span className={css.statLabel}>{label}</span>
      <span className={clsx(css.statValue, accent && css.statValueAccent)}>{value}</span>
    </div>
  )
}

/** Section heading with an optional leading meta (e.g. the cache hit rate). */
function Section({ title, meta, children }: {
  title: string
  meta?: string | undefined
  children: React.ReactNode
}) {
  return (
    <section className={css.section}>
      <header className={css.sectionHeader}>
        <span className={css.sectionTitle}>{title}</span>
        {meta !== undefined && <span className={css.sectionMeta}>{meta}</span>}
      </header>
      <div className={css.sectionBody}>{children}</div>
    </section>
  )
}

/** A ring gauge: occupancy percent + used/window figures. */
function ContextRing({ percent, usedTokens, contextWindow, t }: {
  percent: number
  usedTokens: number
  contextWindow: number
  t: DetailsSlotProps['t']
}) {
  return (
    <div className={css.ringCard}>
      <svg viewBox="0 0 44 44" width="72" height="72" aria-hidden>
        <circle className={css.ringTrack} cx="22" cy="22" r={RING_RADIUS} />
        <circle
          className={css.ringFill}
          cx="22"
          cy="22"
          r={RING_RADIUS}
          strokeDasharray={`${RING_CIRCUMFERENCE * percent / 100} ${RING_CIRCUMFERENCE}`}
          transform="rotate(-90 22 22)"
        />
      </svg>
      <div className={css.ringText}>
        <span className={css.ringPercent}>{percent}%</span>
        <span className={css.ringLabel}>{t('inspector.contextUsed')}</span>
        <span className={css.ringFigures}>
          {formatTokens(usedTokens)} / {formatTokens(contextWindow)}
        </span>
      </div>
    </div>
  )
}

/** Recent settled tool calls, newest first, for the Activity tab. */
function recentToolActivity(nodes: ConversationSnapshot['nodes']): { name: string; ms: number; isError: boolean }[] {
  const rows: { name: string; ms: number; isError: boolean }[] = []
  for (const node of nodes) {
    if (node.kind !== 'tool-result') continue
    rows.push({
      name: node.call?.name ?? node.callId,
      ms: node.callTime === null ? 0 : Math.max(0, node.time - node.callTime),
      isError: node.isError,
    })
  }
  return rows.slice(-8).reverse()
}

/** The Activity tab: what the agent did, and the way into the full trajectory. */
function ActivityTab({
  useSession, useProjection, actions, t,
}: {
  useSession: SnapshotSelectorHook<ConversationSnapshot>
  useProjection: UseProjection
  actions: DetailsSlotProps['actions']
  t: DetailsSlotProps['t']
}) {
  const projected = useProjection('sessionStats')
  const nodes = useSession(s => s.chat.legacy.nodes)
  const recent = recentToolActivity(nodes)
  const stats = projected
  return (
    <div className={css.tabBody}>
      {stats !== undefined && stats.steps > 0 && (
        <Section title={t('inspector.run')}>
          <StatRow label={t('inspector.steps')} value={String(stats.steps)} accent />
          <StatRow label={t('inspector.turns')} value={String(stats.turns)} />
          {stats.llmMs > 0 && <StatRow label={t('inspector.llmTime')} value={formatDuration(stats.llmMs)} />}
          {stats.toolMs > 0 && <StatRow label={t('inspector.toolTime')} value={formatDuration(stats.toolMs)} />}
        </Section>
      )}
      <Section title={t('inspector.recentActivity')}>
        {recent.length === 0
          ? <div className={css.empty}>{t('inspector.recentEmpty')}</div>
          : (
            <ul className={css.activityList}>
              {recent.map((row, index) => (
                <li key={`${row.name}-${index}`} className={css.activityRow}>
                  <span
                    className={clsx(css.activityDot, row.isError ? css.activityDotError : css.activityDotOk)}
                    aria-hidden
                  />
                  <span className={css.activityName}>{row.name}</span>
                  {row.ms > 0 && <span className={css.activityTime}>{formatDuration(row.ms)}</span>}
                </li>
              ))}
            </ul>
          )}
      </Section>
      <button
        type="button"
        className={css.trajectoryButton}
        title={t('inspector.trajectoryHint')}
        onClick={() => { actions.setView('trajectory') }}
      >
        <span className={css.trajectoryButtonLabel}>{t('inspector.openTrajectory')}</span>
        <span className={css.trajectoryButtonHint}>{t('inspector.trajectoryHint')}</span>
      </button>
    </div>
  )
}

/** The Context tab: occupancy ring, tokens, cache, and performance. */
function ContextTab({
  useProjection, t,
}: {
  useProjection: UseProjection
  t: DetailsSlotProps['t']
}) {
  const pressure = useProjection('contextPressure')
  const usage = useProjection('tokenUsage')
  const stats = useProjection('sessionStats')
  const context = contextOccupancy(pressure)
  const billed = usage === undefined ? 0 : billedInputTokens(usage)
  const cacheHit = usage === undefined ? null : cacheHitPercent(usage)
  return (
    <div className={css.tabBody}>
      {context !== null
        ? (
          <section className={css.section}>
            <header className={css.sectionHeader}>
              <span className={css.sectionTitle}>{t('inspector.contextTitle')}</span>
            </header>
            <div className={css.sectionBody}>
              <ContextRing
                percent={context.percent}
                usedTokens={context.usedTokens}
                contextWindow={context.contextWindow}
                t={t}
              />
            </div>
          </section>
        )
        : <div className={css.empty}>{t('inspector.empty')}</div>}
      {usage !== undefined && (billed > 0 || usage.outputTokens > 0) && (
        <Section title={t('inspector.tokens')}>
          <StatRow label={t('inspector.input')} value={formatTokens(billed)} />
          <StatRow label={t('inspector.output')} value={formatTokens(usage.outputTokens)} />
        </Section>
      )}
      {usage !== undefined && (billed > 0 || usage.outputTokens > 0) && (
        <Section
          title={t('inspector.cache')}
          {...(cacheHit === null ? {} : { meta: `${cacheHit}% ${t('inspector.hitRate')}` })}
        >
          <StatRow label={t('inspector.read')} value={formatTokens(usage.cacheReadTokens)} />
          <StatRow label={t('inspector.write')} value={formatTokens(usage.cacheWriteTokens)} />
        </Section>
      )}
      {stats !== undefined && (stats.ttftSteps > 0 || stats.decodeMs > 0) && (
        <Section title={t('inspector.performance')}>
          {stats.ttftSteps > 0 && (
            <StatRow label={t('inspector.ttft')} value={formatDuration(stats.ttftMs / stats.ttftSteps)} />
          )}
          {stats.decodeMs > 0 && (
            <StatRow
              label={t('inspector.throughput')}
              value={formatTokensPerSecond(stats.decodeTokens / (stats.decodeMs / 1_000))}
            />
          )}
        </Section>
      )}
    </div>
  )
}

/** Full props composed by reference from the contract (automatic shares & injected share). */
export type InspectorPanelProps = DetailsSlotProps

/**
 * Render the right inspector column.
 * @param props - composed slot props.
 * @returns the inspector surface.
 */
export function InspectorPanel(props: InspectorPanelProps) {
  const { useSession, useStore, actions, closeDetails, t, useProjection } = props
  const [tab, setTab] = useState<'context' | 'activity'>('context')
  const selection = useStore(s => s.selection)
  const callId = selection?.callId
  const inToolView = selection !== null && callId !== undefined

  return (
    <div className={css.root}>
      <header className={css.header}>
        <div className={css.tabs} role="tablist" aria-label={t('details.title')}>
          <button
            type="button"
            role="tab"
            aria-selected={!inToolView && tab === 'context'}
            className={clsx(css.tab, !inToolView && tab === 'context' && css.tabActive)}
            onClick={() => { actions.select(null); setTab('context') }}
          >
            {t('inspector.tab.context')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!inToolView && tab === 'activity'}
            className={clsx(css.tab, !inToolView && tab === 'activity' && css.tabActive)}
            onClick={() => { actions.select(null); setTab('activity') }}
          >
            {t('inspector.tab.activity')}
          </button>
        </div>
        <button
          type="button"
          className={css.hide}
          aria-label={t('inspector.hide')}
          onClick={() => { closeDetails() }}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <div className={css.body}>
        {inToolView
          ? (
            // The selected tool call's details: existing panel embedded, the
            // same seat the old details column occupied.
            <DetailsPanel {...props} />
          )
          : tab === 'context'
            ? <ContextTab useProjection={useProjection} t={t} />
            : <ActivityTab useSession={useSession} useProjection={useProjection} actions={actions} t={t} />}
      </div>
    </div>
  )
}

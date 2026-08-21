/**
 * TurnActivityFold: the conversation's tool-activity presentation.
 *
 * A completed turn's tool calls and intermediate assistant steps collapse
 * into one quiet summary row — `✓ Completed · N tools` — so the final report
 * is the conversation's main content. While the turn runs, the fold is a
 * compact live block naming the most recent tools. Clicking the summary
 * expands the raw rows.
 *
 * Exceptions are never folded: error tool rows stay visible even while the
 * fold is collapsed, and the summary itself turns into an error state.
 */

import { useState } from 'react'
import clsx from 'clsx'
import type { ChatViewSlotProps } from '../contract/slots.ts'
import css from './TurnActivityFold.module.css'

/** One node inside the fold. */
export interface ActivityNode {
  /** Chat node key (the row renderer's identity). */
  readonly key: string
  /** Renderer kind ('tool' or 'assistant'). */
  readonly kind: string
  /** Settled tool failure (a must-not-hide exception). */
  readonly isError: boolean
}

/** Fold props: group facts plus the row renderer. */
export interface TurnActivityFoldProps {
  /** Nodes in this activity run, in flow order. */
  nodes: readonly ActivityNode[]
  /** Whether the owning turn is still open. */
  running: boolean
  /** Names of the most recent running tools (live block). */
  runningNames: readonly string[]
  /** Render one raw row by chat node key. */
  renderRow: (key: string) => React.ReactNode
  /** The owning view's locale seat. */
  t: ChatViewSlotProps['t']
}

/**
 * Render the folded activity block.
 * @param props - fold facts and the row renderer.
 * @returns the live block, the collapsed summary (plus any error rows), or the expanded rows.
 */
export function TurnActivityFold({ nodes, running, runningNames, renderRow, t }: TurnActivityFoldProps) {
  const [expanded, setExpanded] = useState(false)
  const toolCount = nodes.filter(node => node.kind === 'tool').length
  const errorKeys = nodes.filter(node => node.isError).map(node => node.key)
  const hasErrors = errorKeys.length > 0

  if (running) {
    const recent = runningNames.slice(-3)
    return (
      <div className={css.live} role="status" aria-live="polite">
        <span className={css.liveDot} aria-hidden />
        <span className={css.liveLabel}>{t('activity.working')}</span>
        {recent.length > 0 && (
          <span className={css.liveNames}>
            {recent.map((name, index) => (
              <span key={`${name}-${index}`} className={css.liveName}>{name}</span>
            ))}
          </span>
        )}
        {toolCount > 0 && <span className={css.liveCount}>{t('activity.toolCount', { count: toolCount })}</span>}
      </div>
    )
  }

  if (expanded) {
    return (
      <div className={css.fold}>
        <button
          type="button"
          className={clsx(css.summary, hasErrors ? css.summaryError : undefined)}
          aria-expanded="true"
          onClick={() => { setExpanded(false) }}
        >
          <span className={clsx(css.check, hasErrors ? css.checkError : undefined)} aria-hidden>
            {hasErrors ? '!' : '✓'}
          </span>
          <span className={css.summaryText}>
            {`${t('activity.completed')} · ${t('activity.toolCount', { count: toolCount })}`}
          </span>
          <svg viewBox="0 0 16 16" width="12" height="12" className={css.chevron} aria-hidden>
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className={css.rows}>
          {nodes.map(node => (
            <div key={node.key}>{renderRow(node.key)}</div>
          ))}
        </div>
      </div>
    )
  }

  // Collapsed: the summary row, with any error rows kept visible beneath it —
  // exceptions are never folded away.
  return (
    <div className={css.fold}>
      <button
        type="button"
        className={clsx(css.summary, hasErrors ? css.summaryError : undefined)}
        aria-expanded="false"
        title={t('activity.expand')}
        onClick={() => { setExpanded(true) }}
      >
        <span className={clsx(css.check, hasErrors ? css.checkError : undefined)} aria-hidden>
          {hasErrors ? '!' : '✓'}
        </span>
        <span className={css.summaryText}>
          {`${t('activity.completed')} · ${t('activity.toolCount', { count: toolCount })}`}
        </span>
        <svg viewBox="0 0 16 16" width="12" height="12" className={css.chevron} aria-hidden>
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {hasErrors && (
        <div className={css.errorRows}>
          {errorKeys.map(key => (
            <div key={key}>{renderRow(key)}</div>
          ))}
        </div>
      )}
    </div>
  )
}

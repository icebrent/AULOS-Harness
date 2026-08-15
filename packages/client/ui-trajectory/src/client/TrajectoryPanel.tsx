/**
 * TrajectoryPanel: the chat's bottom trajectory surface — a collapsed bar by
 * default, expanding to a resizable panel that hosts the SAME trajectory body
 * as the full view tab. Chat and trajectory stay simultaneously visible: the
 * panel sits below the conversation scrollport, so the composer keeps its
 * sticky seat and the panel's ledger scrolls only inside itself (the shared
 * table's virtualization stays in charge). An inspect request arriving from
 * chat expands the panel so the addressed call is immediately visible.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  IconChevronDownOutline14, IconChevronUpOutline14,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { TrajectoryBody } from './TrajectoryBody.tsx'
import type { TrajectoryViewInjected } from './TrajectoryBody.tsx'
import css from './TrajectoryPanel.module.css'

/** Contract height range of the expanded panel (px). */
const PANEL_MIN = 160
const PANEL_MAX = 560
/** Height before any user drag (px). */
const PANEL_DEFAULT = 280

function clampHeight(px: number): number {
  return Math.min(PANEL_MAX, Math.max(PANEL_MIN, Math.round(px)))
}

/** Full composed props of the bottom-panel entry. */
export type TrajectoryPanelProps =
  PropsRuntime<'conversation.session.bottom'> & InjectFace<TrajectoryViewInjected> & PropsLocale<'trajectory'>

/**
 * Render the bottom trajectory panel.
 * @param props - composed slot props.
 * @returns the collapsed bar or the expanded, resizable panel.
 */
export function TrajectoryPanel({
  sessionId, useSession, useSessions, useWorkspaces, useProjection, useInput, inputActions,
  useDuration, loadOlder, setActualDuration,
  inspect, onInspectDone, t,
}: TrajectoryPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [height, setHeight] = useState(PANEL_DEFAULT)
  // The drag base freezes for the whole gesture so deltas never compound.
  const originY = useRef(0)
  const baseHeight = useRef(PANEL_DEFAULT)
  const [dragging, setDragging] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  // Publish the panel's live height on the conversation scrollport (the
  // composer seat's pattern): the chat view clears its back-to-bottom button
  // and its paging anchor above BOTH the panel and the composer while the
  // panel occupies space between transcript and input card.
  useEffect(() => {
    const root = rootRef.current
    if (root === null) return
    const scroller = root.closest<HTMLElement>('[data-conversation-scroll]')
    if (scroller === null) return
    const publish = (): void => {
      scroller.style.setProperty('--dsh-trajectory-panel-height', `${root.offsetHeight}px`)
    }
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(root)
    return () => {
      observer.disconnect()
      scroller.style.removeProperty('--dsh-trajectory-panel-height')
    }
  }, [])

  // A chat-tool inspect request opens the panel so the addressed call is
  // visible without a manual expand; the store clears the request after the
  // table applies it.
  useEffect(() => {
    if (inspect?.callId !== undefined) setExpanded(true)
  }, [inspect])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    originY.current = e.clientY
    baseHeight.current = height
    setDragging(true)
  }, [height])
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    // One clamped style write per pointermove; React batches it, and the
    // drag flag pauses the height transition so moves never animate.
    setHeight(clampHeight(baseHeight.current + (originY.current - e.clientY)))
  }, [])
  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
  }, [])
  // A cancelled gesture or a lost capture (an element removed mid-drag, an
  // OS gesture steal) must restore the height transition like a release does.
  const onDragLost = useCallback(() => { setDragging(false) }, [])

  if (!expanded) {
    return (
      <div ref={rootRef} className={css.collapsed} data-trajectory-panel="">
        <button
          type="button"
          className={css.collapsedButton}
          aria-expanded={false}
          aria-label={t('panel.expand')}
          title={t('panel.expand')}
          onClick={() => { setExpanded(true) }}
        >
          <span className={css.collapsedLabel}>{t('view.trajectory')}</span>
          <IconChevronUpOutline14 aria-hidden />
        </button>
      </div>
    )
  }
  return (
    <section
      ref={rootRef}
      className={css.root}
      style={{ height }}
      data-dragging={dragging || undefined}
      data-trajectory-panel=""
      aria-label={t('panel.region')}
    >
      <div
        className={css.handle}
        role="separator"
        aria-orientation="horizontal"
        aria-label={t('panel.resize')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onDragLost}
        onLostPointerCapture={onDragLost}
      />
      <header className={css.header}>
        <span className={css.title}>{t('view.trajectory')}</span>
        <button
          type="button"
          className={css.collapse}
          aria-label={t('panel.collapse')}
          title={t('panel.collapse')}
          onClick={() => { setExpanded(false) }}
        >
          <IconChevronDownOutline14 />
        </button>
      </header>
      <div className={css.body}>
        {/* No floating composer inside the panel: the shared body's ledger
            clearance falls back to a plain 16px instead of the scrollport's
            composer height. */}
        <TrajectoryBody
          sessionId={sessionId}
          useSession={useSession}
          useSessions={useSessions}
          useWorkspaces={useWorkspaces}
          useProjection={useProjection}
          useInput={useInput}
          inputActions={inputActions}
          useDuration={useDuration}
          loadOlder={loadOlder}
          setActualDuration={setActualDuration}
          inspect={inspect ?? null}
          {...(onInspectDone === undefined ? {} : { onInspectDone })}
          t={t}
        />
      </div>
    </section>
  )
}

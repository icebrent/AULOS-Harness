/** Strict per-session header/body content inserted into the resident conversation layout. */

import { useEffect, useSyncExternalStore } from 'react'
import clsx from 'clsx'
import type { SessionId, SessionListState, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  ConversationSessionHeaderSlotProps, ConversationSessionSlotProps,
} from '../contract/slots.ts'
import type { ViewTab } from '../contract/views.ts'
import css from './ConversationRoot.module.css'

/** Full props composed from the strict session body contract. */
export type ConversationSessionProps = ConversationSessionSlotProps

/** Full props composed from the strict session header contract. */
export type ConversationSessionHeaderProps = ConversationSessionHeaderSlotProps

interface Breadcrumb {
  readonly id: SessionId
  readonly displayTitle: string
}

const DEFAULT_VIEW_ID = 'chat'

/** Resolve by id and keep stale persisted selections on the stable Chat fallback. */
function resolveActiveView(tabs: readonly ViewTab[], selectedId: string | null): ViewTab | undefined {
  const requestedId = selectedId ?? DEFAULT_VIEW_ID
  return tabs.find(view => view.id === requestedId)
    ?? tabs.find(view => view.id === DEFAULT_VIEW_ID)
}

function deriveAncestry(list: SessionListState, id: SessionId): readonly Breadcrumb[] {
  const chain: Breadcrumb[] = []
  const seen = new Set<SessionId>()
  let cursor: SessionId | undefined = id
  while (cursor !== undefined) {
    if (seen.has(cursor)) break
    seen.add(cursor)
    const summary: SessionSummary | undefined = list.byId[cursor]
    if (summary === undefined) break
    chain.unshift({ id: summary.id, displayTitle: summary.displayTitle })
    if (summary.origin !== 'subagent') break
    cursor = summary.parentId
  }
  return chain
}

function equalBreadcrumbs(left: readonly Breadcrumb[], right: readonly Breadcrumb[]): boolean {
  return left.length === right.length
    && left.every((item, index) => {
      const other = right.at(index)
      return other !== undefined && item.id === other.id && item.displayTitle === other.displayTitle
    })
}

/**
 * Renders Session header chrome above the resident conversation scrollport.
 * Quiet by design: title, the mode label, and secondary utilities only — the
 * runtime stats moved to the right inspector, and the view tabs dissolved
 * into the Activity panel's trajectory entry.
 * @param props - Strict Session store, view ledger, navigation, render, and locale shares.
 * @returns the hidden blank-session header or visible title and utilities.
 */
export function ConversationSessionHeader({
  sessionId, useSession, useSessions, useStore,
  renderSlot, views, open, toggleFiles, t,
}: ConversationSessionHeaderProps) {
  useSyncExternalStore(views.subscribe, views.version)
  const tabs = views.list()
  const selectedId = useStore(s => s.view)
  const active = resolveActiveView(tabs, selectedId)
  const ancestry = useSessions(s => deriveAncestry(s, sessionId), equalBreadcrumbs)
  const composerPhase = useSession(s => s.composerPhase)
  const blank = useSession(s => s.blank)
  const hideChrome = blank && composerPhase === 'blank'
  const inTrajectory = active?.id === 'trajectory'

  return (
    <header
      className={clsx(css.header, hideChrome && css.headerHidden)}
      aria-hidden={hideChrome || undefined}
    >
      {!hideChrome && (
        <div className={css.titleRow}>
          <div className={css.titleCluster}>
            <nav className={css.crumbs} aria-label={t('session.hierarchy')}>
              {ancestry.map((summary, index) => {
                const last = index === ancestry.length - 1
                return (
                  <span key={summary.id} className={css.crumbSeg}>
                    {index > 0 && <span className={css.crumbSep}>/</span>}
                    <button
                      type="button"
                      className={clsx(css.crumb, last && css.crumbCurrent)}
                      disabled={last}
                      onClick={() => { open(summary.id) }}
                    >
                      {summary.displayTitle}
                    </button>
                  </span>
                )
              })}
              {ancestry.length === 0 && <span className={css.crumbCurrent}>{sessionId}</span>}
              {inTrajectory && <span className={css.viewBadge}>{t('session.inTrajectory')}</span>}
            </nav>
            <div className={css.headerActions}>
              {renderSlot('conversation.session.header.actions', {})}
            </div>
          </div>
          <div className={css.headerUtilities}>
            <button
              type="button"
              className={css.inspectorToggle}
              aria-label={t('session.toggleFiles')}
              title={t('session.toggleFiles')}
              onClick={() => { toggleFiles() }}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                <path
                  d="M3.5 2.5h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Zm4.5 0v11"
                  stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"
                />
              </svg>
            </button>
            {renderSlot('conversation.session.header.utilities', {})}
          </div>
        </div>
      )}
    </header>
  )
}

/**
 * Renders the active Session view inside the resident scrollport and keeps
 * the input draft mirrored while blank Hero chrome is visible. While a
 * non-chat view (the full trajectory) is active, a slim back bar restores
 * the conversation — the only path the view ring is switched by now.
 * @param props - Strict Session input/store, view ledger, and render shares.
 * @returns the active view area, or null while the Session remains blank.
 */
export function ConversationSession({
  sessionId, useSession, useInput, inputActions, useStore, actions,
  renderSlot, views, bindDraftMirror, releaseSessionImages, t,
}: ConversationSessionProps) {
  useSyncExternalStore(views.subscribe, views.version)
  const tabs = views.list()
  const selectedId = useStore(s => s.view)
  const active = resolveActiveView(tabs, selectedId)
  const composerPhase = useSession(s => s.composerPhase)
  const blank = useSession(s => s.blank)
  const inputState = useInput(s => s)
  const storedDraft = useStore(s => s.draft)
  // `?? null`: persisted snapshots from before the inspect field rehydrate without it.
  const inspect = useStore(s => s.inspect ?? null)

  useEffect(() => {
    if (inputState.draft === '' && storedDraft !== '') inputActions.setDraft(storedDraft)
    const unmirror = bindDraftMirror(actions.setDraft)
    return () => { unmirror() }
    // Mount-only (deps pinned to inputActions): later store writes come from
    // the machine mirror, not this seed effect.
  }, [inputActions])

  useEffect(() => () => {
    releaseSessionImages(sessionId)
  }, [releaseSessionImages, sessionId])

  if (blank && composerPhase === 'blank') return null
  const inTrajectory = active?.id === 'trajectory'
  return (
    <div className={css.viewArea}>
      {inTrajectory && (
        <div className={css.viewBackBar}>
          <button
            type="button"
            className={css.viewBack}
            onClick={() => { actions.setView(DEFAULT_VIEW_ID) }}
          >
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden>
              <path d="M10 3.5 5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{t('session.backToChat')}</span>
          </button>
        </div>
      )}
      {active !== undefined && renderSlot('conversation.view', {
        inspect,
        onInspectDone: () => { actions.setInspect(null) },
      }, { only: active.id })}
      {/* The bottom trajectory region: rendered by THIS entry because it
          shares the chat store (active-view gating + inspect handoff) with
          the view ring. Sticky just above the composer seat, so chat and
          the trajectory panel stay visible together; unmounted on the full
          trajectory tab — the same ledger never renders twice. */}
      {!inTrajectory && (
        <div className={css.bottomSlot}>
          {renderSlot('conversation.session.bottom', {
            inspect,
            onInspectDone: () => { actions.setInspect(null) },
          })}
        </div>
      )}
    </div>
  )
}

/**
 * FullTrajectoryButton: the header utility opening the detailed trajectory
 * view tab. The bottom panel covers quick observation while chatting; this
 * button is the preserved Full Trajectory entry for debug/audit work, hidden
 * while the tab itself is active.
 */

import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { ChatStore } from '../contract/slots.ts'
import css from './ConversationRoot.module.css'

/** Full composed props: the utilities-slot runtime share, the shared chat store, and the locale seat. */
export type FullTrajectoryButtonProps =
  PropsRuntime<'conversation.session.header.utilities'> & PropsStore<ChatStore> & PropsLocale<'conversation'>

/**
 * Render the Full Trajectory entry.
 * @param props - composed slot props.
 * @returns the header button, or null while the trajectory tab is active.
 */
export function FullTrajectoryButton({ useStore, actions, t }: FullTrajectoryButtonProps) {
  const view = useStore(s => s.view)
  if (view === 'trajectory') return null
  return (
    <button
      type="button"
      className={css.utilityButton}
      onClick={() => { actions.setView('trajectory') }}
    >
      {t('session.openTrajectory')}
    </button>
  )
}

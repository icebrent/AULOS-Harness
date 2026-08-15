/** Trajectory view tab: the full-page wrapper over the shared body. The view
 *  registration stays as the "Full Trajectory" surface while the bottom panel
 *  (ui-trajectory's `conversation.session.bottom` entry) hosts the same body. */

import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { TrajectoryBody } from './TrajectoryBody.tsx'
import type { TrajectoryViewInjected } from './TrajectoryBody.tsx'
import css from './views.module.css'

export type { TrajectoryViewInjected } from './TrajectoryBody.tsx'

/** Full composed props of the view tab. */
export type TrajectoryViewProps =
  ConvViewProps & InjectFace<TrajectoryViewInjected> & PropsLocale<'trajectory'>

/**
 * Render the full-page trajectory view. The wrapper carries the
 * composer-overlay opt-in: only the full tab may float the composer over the
 * ledger; the bottom panel hosts the same body without it.
 * @param props - composed slot props.
 * @returns the shared trajectory body under the overlay wrapper.
 */
export function TrajectoryView(props: TrajectoryViewProps) {
  return (
    <div className={css.viewRoot} data-conversation-composer-overlay="">
      <TrajectoryBody {...props} />
    </div>
  )
}

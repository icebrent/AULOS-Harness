/**
 * Browser trajectory plugin contributing two entries: the full-page view tab
 * (`conversation.view`) and the chat's bottom panel
 * (`conversation.session.bottom`, declared by ui-conversation) — both host
 * the same shared TrajectoryBody over the same session data path.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the 'conversation.view' and 'conversation.session.bottom' SlotMap
// rows (declared by the slot's owning package) must be in the program for the
// register calls to type.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { createTrajectoryDurationStore } from './duration-store.ts'
import { en, NS, zh } from './locales.ts'
import { registerTrajectoryAssistantDefinition } from './trajectory-assistant-definition.ts'
import { registerTrajectoryCompactionDefinitions } from './trajectory-compaction-definition.ts'
import { registerTrajectoryMessageDefinitions } from './trajectory-message-definitions.ts'
import { registerTrajectoryRequestHeaderDefinition } from './trajectory-request-header-definition.ts'
import { registerTrajectoryConversationView } from './trajectory-snapshot-builder.ts'
import { registerTrajectoryToolDefinition } from './trajectory-tool-definition.ts'
import type { TrajectoryViewInjected } from './TrajectoryBody.tsx'
import { TrajectoryPanel } from './TrajectoryPanel.tsx'
import { TrajectoryView } from './TrajectoryView.tsx'

/** Required services: the conversation slot, registries, ordinary Session paging, and the locale service. */
export const inject = ['slots', 'conversationEvents', 'conversationViews', 'sessions', 'locale']

/**
 * Client plugin body: register the trajectory surfaces. The registrations
 * ride the slot service's effect wrapper, so plugin unload removes both.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-trajectory: dictionaries')
  // Registration-time text (the view tab label) reads through the bound
  // translate as a thunk, so it follows the active locale without
  // re-registration.
  const t = ctx.locale.bind(NS)
  const duration = createTrajectoryDurationStore()
  registerTrajectoryMessageDefinitions(ctx)
  registerTrajectoryRequestHeaderDefinition(ctx)
  registerTrajectoryAssistantDefinition(ctx)
  registerTrajectoryToolDefinition(ctx)
  registerTrajectoryCompactionDefinitions(ctx)
  registerTrajectoryConversationView(ctx)
  // One inject face for both surfaces: paging and the actual-duration
  // preference are the same facts regardless of where the body renders.
  const injectFace = (sessionId: SessionId): TrajectoryViewInjected => {
    const session = ctx.sessions.binding(sessionId)?.session
    if (session === undefined) {
      throw new Error(`ui-trajectory: session "${sessionId}" is unavailable`)
    }
    return {
      hooks: { duration },
      loadOlder: async () => {
        const before = session.getSnapshot().views.get('trajectory')
        await session.loadOlder()
        return session.getSnapshot().views.get('trajectory') !== before
      },
      setActualDuration: (value) => { duration.set(value) },
    }
  }
  // The full-page view tab (the detailed debug/audit surface).
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'trajectory',
    order: 10,
    locale: NS,
    label: () => t('view.trajectory'),
    inject: injectFace,
  }, TrajectoryView))
  // The chat's bottom panel: same body, resizable, chat stays visible.
  ctx.slots.inject('conversation.session.bottom', () => ctx.slots.register({
    name: 'conversation.session.bottom',
    locale: NS,
    inject: injectFace,
  }, TrajectoryPanel))
}

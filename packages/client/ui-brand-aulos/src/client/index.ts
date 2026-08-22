/** AULOS occupants for the generic browser-brand slots. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { AulosBrandMark, AulosBrandName, AulosHeroSubtitle, AulosHeroTitle } from './Brand.tsx'

/** Required service: the UI slot registry. */
export const inject = ['slots']

/**
 * Fill every shipped brand slot for AULOS client builds.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  if (process.env.DSH_CLIENT_BUILD_PROFILE !== 'aulos') return
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', () =>
      ctx.slots.inject('conversation.hero.brand.mark', () =>
        ctx.slots.inject('conversation.hero.title', () =>
          ctx.slots.inject('conversation.hero.subtitle', function* () {
            yield ctx.slots.register({ name: 'sidebar.brand.mark' }, AulosBrandMark)
            yield ctx.slots.register({ name: 'sidebar.brand.name' }, AulosBrandName)
            yield ctx.slots.register({ name: 'conversation.hero.brand.mark' }, AulosBrandMark)
            yield ctx.slots.register({ name: 'conversation.hero.title' }, AulosHeroTitle)
            yield ctx.slots.register({ name: 'conversation.hero.subtitle' }, AulosHeroSubtitle)
          })))))
}

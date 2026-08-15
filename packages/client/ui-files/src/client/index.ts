/**
 * Files panel plugin, browser half: contributes the project tree into the
 * frame's `details` slot (declared by ui-layout) and, in the same
 * registration, binds the host browse seam (`ctx.workspaces.listDirectory`)
 * and the layout close action as the panel's injected callbacks. The right
 * column is thereby the Files surface while a session is current; without a
 * session the frame hides the column itself.
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: the 'details' SlotMap row (declared by ui-layout) and the
// ctx.layout Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { FilesPanel, type FilesPanelInjected } from './FilesPanel.tsx'
import { en, NS, zh, type FilesKey } from './locales.ts'

export type { FilesPanelInjected } from './FilesPanel.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Files panel copy. */
    files: FilesKey
  }
}

/** Required services: the details slot, the browse seam, layout actions, and the locale service. */
export const inject = ['slots', 'workspaces', 'layout', 'locale']

/**
 * Client plugin body: register the Files panel into the details slot. The
 * injected callbacks are built once per fiber, so their identity is stable
 * across session switches (components may list them as effect deps).
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-files: dictionaries')
  const listDirectory = (path?: string, signal?: AbortSignal) => ctx.workspaces.listDirectory(path, signal)
  const openPath = (path: string) => ctx.workspaces.openPath(path)
  ctx.slots.inject('details', () => ctx.slots.register({
    name: 'details',
    locale: NS,
    inject: (): FilesPanelInjected => ({
      listDirectory,
      openPath,
      closeFiles: () => { ctx.layout.closeDetails() },
    }),
  }, FilesPanel))
}

/** Files panel slot registration and its plain seam/layout callbacks. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '@deepseek-ai/dsh-client-ui-files/client'
import type { FilesPanelInjected } from '@deepseek-ai/dsh-client-ui-files/client'

async function bench(declare = true) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const workspaces = { listDirectory: vi.fn(), openPath: vi.fn() }
  const layout = { closeDetails: vi.fn() }
  ctx.provide('workspaces', workspaces as never)
  ctx.provide('layout', layout as never)
  ctx.provide('locale', new LocaleRuntime(ctx))
  const slots = ctx.get('slots') as SlotRegistry
  if (declare) {
    slots.register(
      { name: 'root', children: { 'details': { kind: 'single', scope: 'session' } } } as never,
      () => null,
    )
  }
  return { ctx, slots, workspaces, layout }
}

describe('ui-files apply', () => {
  it('declares only the services it uses', () => {
    expect(inject).toEqual(['slots', 'workspaces', 'layout', 'locale'])
  })

  it('registers the Files panel into the details slot with seam-bound callbacks', async () => {
    const b = await bench()
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    expect(b.slots.entries('details')).toHaveLength(1)
    // Copy rides the standard locale seat, not the inject face.
    expect(b.slots.entries('details')[0]!.locale).toBe('files')
    const injected = (b.slots.entries('details')[0]!.inject as unknown as () => FilesPanelInjected)()
    expect(Object.keys(injected)).toEqual(['listDirectory', 'openPath', 'closeFiles'])
    // The listing seam passes path and signal through verbatim.
    const signal = new AbortController().signal
    void injected.listDirectory('/w', signal)
    expect(b.workspaces.listDirectory).toHaveBeenCalledWith('/w', signal)
    void injected.openPath('/w/a.ts')
    expect(b.workspaces.openPath).toHaveBeenCalledWith('/w/a.ts')
    // Closing is layout geometry, kept with ctx.layout.
    injected.closeFiles()
    expect(b.layout.closeDetails).toHaveBeenCalledOnce()
    // Callback identity is fiber-stable: a second inject call returns the same
    // closures, so components may use them as effect deps.
    const again = (b.slots.entries('details')[0]!.inject as unknown as () => FilesPanelInjected)()
    expect(again.listDirectory).toBe(injected.listDirectory)
    expect(again.openPath).toBe(injected.openPath)
  })

  it('waits quietly while no live owner declared the details slot', async () => {
    const b = await bench(false)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    // The contribution is injection-wired (it waits on the declaration), so
    // an absent owner leaves the ledger empty instead of throwing.
    expect(b.slots.entries('details')).toHaveLength(0)
  })

  it('removes the entry on teardown', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await fiber.dispose()
    expect(b.slots.entries('details')).toHaveLength(0)
  })
})

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import * as plugin from '@deepseek-ai/dsh-client-ui-files/invariant'

describe('ui-files invariant companion', () => {
  it('registers under the package manifest name with the no-runtime-invariant installer', async () => {
    const registered: { name: unknown; install: unknown }[] = []
    const ctx = {
      invariants: {
        register: (name: unknown, install: unknown) => {
          registered.push({ name, install })
          return () => {}
        },
      },
    } as unknown as Context
    const dispose = await plugin.apply(ctx)
    expect(plugin.name).toBe('client-ui-files-invariant')
    expect(plugin.inject).toEqual(['invariants'])
    expect(registered).toHaveLength(1)
    expect(registered[0]!.name).toBe('@deepseek-ai/dsh-client-ui-files')
    expect(typeof registered[0]!.install).toBe('function')
    expect(typeof dispose).toBe('function')
  })
})

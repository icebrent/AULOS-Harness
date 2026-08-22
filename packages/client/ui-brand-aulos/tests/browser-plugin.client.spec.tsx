// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from '../src/client/index.ts'
import {
  AulosBrandMark, AulosBrandName, AulosHeroSubtitle, AulosHeroTitle,
} from '../src/client/Brand.tsx'

afterEach(() => { cleanup(); vi.unstubAllEnvs() })

const HOLES = [
  'sidebar.brand.mark',
  'sidebar.brand.name',
  'conversation.hero.brand.mark',
  'conversation.hero.title',
  'conversation.hero.subtitle',
] as const

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  const disposeHoles = slots.register({
    name: 'root',
    children: Object.fromEntries(HOLES.map(name => [name, { kind: 'single', scope: 'root' }])),
  } as never, () => null)
  return { ctx, slots, disposeHoles }
}

describe('AULOS browser-brand plugin', () => {
  it('fills only AULOS-profile builds and disposes the occupant set', async () => {
    vi.stubEnv('DSH_CLIENT_BUILD_PROFILE', 'local')
    const local = await bench()
    await local.ctx.plugin({ inject: [...inject], apply }).await()
    for (const hole of HOLES) expect(local.slots.entries(hole)).toHaveLength(0)

    vi.stubEnv('DSH_CLIENT_BUILD_PROFILE', 'official')
    const official = await bench()
    await official.ctx.plugin({ inject: [...inject], apply }).await()
    for (const hole of HOLES) expect(official.slots.entries(hole)).toHaveLength(0)

    vi.stubEnv('DSH_CLIENT_BUILD_PROFILE', 'aulos')
    const aulos = await bench()
    const fiber = aulos.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    for (const hole of HOLES) expect(aulos.slots.entries(hole)).toHaveLength(1)
    await fiber.dispose()
    for (const hole of HOLES) expect(aulos.slots.entries(hole)).toHaveLength(0)
  })

  it('renders the established mark and name assets independently', () => {
    const name = render(<AulosBrandName />)
    expect(name.container.querySelector('img')?.getAttribute('src')).toBe('/branding/aulos.png')
    name.unmount()
    const mark = render(<AulosBrandMark size={34} className="hero-mark" />)
    expect(mark.container.querySelector('img')?.getAttribute('src')).toBe('/branding/icon.png')
    expect(mark.container.querySelector('img')?.getAttribute('width')).toBe('34')
    expect(mark.container.querySelector('img')?.getAttribute('class')).toBe('hero-mark')
  })

  it('renders the exact Hero copy with host-owned typography', () => {
    const view = render(
      <>
        <AulosHeroTitle className="title" />
        <AulosHeroSubtitle className="subtitle" />
      </>,
    )
    expect(view.getByText('Orchestrate Intelligence.').getAttribute('class')).toBe('title')
    expect(view.getByText('The Power of AI, Harnessed.').getAttribute('class')).toBe('subtitle')
  })
})

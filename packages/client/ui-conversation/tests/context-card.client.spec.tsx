// @vitest-environment jsdom
// ContextCard: the compact four-group context/token/cache/performance card.
// Every figure rides the same display folds as the stats strip; the card
// hides itself while no projection value exists and drops whole groups whose
// facts are absent.

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { ContextCard } from '../src/client/skeleton/ContextCard.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh) as never

/** Projection-seat stub over a fixed value table. */
function useProjectionOf(values: Record<string, unknown>) {
  return (key: string) => values[key]
}

describe('ContextCard', () => {
  it('renders all four groups from the shipped projections', () => {
    const view = render(
      <ContextCard
        t={t}
        useProjection={useProjectionOf({
          contextPressure: { projectedTokens: 601_000, contextWindow: 1_000_000 },
          tokenUsage: {
            uncachedInputTokens: 59_000_000, outputTokens: 304_000,
            cacheReadTokens: 41_000_000, cacheWriteTokens: 0,
          },
          sessionStats: {
            turns: 3, steps: 5, llmMs: 10_000, toolMs: 2_000,
            ttftMs: 5_800, ttftSteps: 2, decodeMs: 3_000, decodeTokens: 282,
          },
        }) as never}
      />,
    )
    expect(view.getByText('60%')).toBeTruthy()
    expect(view.getByText('601K / 1M')).toBeTruthy()
    expect(view.getByText('100M / 304K')).toBeTruthy()
    expect(view.getByText('输入 / 输出')).toBeTruthy()
    expect(view.getByText('41%')).toBeTruthy()
    expect(view.getByText('41M / 0')).toBeTruthy()
    expect(view.getByText('2.9s')).toBeTruthy()
    expect(view.getByText('94 tok/s')).toBeTruthy()
  })

  it('renders the em dash for groups whose facts are absent', () => {
    const view = render(
      <ContextCard
        t={t}
        useProjection={useProjectionOf({
          tokenUsage: { uncachedInputTokens: 1_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        }) as never}
      />,
    )
    expect(view.getByText('1K / 0')).toBeTruthy()
    expect(view.getAllByText('—').length).toBe(2)
  })

  it('hides itself while no projection value exists', () => {
    const view = render(<ContextCard t={t} useProjection={useProjectionOf({}) as never} />)
    expect(view.container.firstChild).toBeNull()
  })

  it('keeps the occupancy numerator on the bare provider sample when projected pressure is absent', () => {
    const view = render(
      <ContextCard
        t={t}
        useProjection={useProjectionOf({
          contextPressure: { pressureTokens: 250_000, contextWindow: 1_000_000 },
        }) as never}
      />,
    )
    expect(view.getByText('25%')).toBeTruthy()
    expect(view.getByText('250K / 1M')).toBeTruthy()
  })
})

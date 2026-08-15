import { describe, expect, it } from 'vitest'
import { formatCompactTokens } from '@deepseek-ai/dsh-client-ui-primitives'

describe('formatCompactTokens', () => {
  it('renders sub-thousand counts verbatim', () => {
    expect(formatCompactTokens(0)).toBe('0')
    expect(formatCompactTokens(517)).toBe('517')
    expect(formatCompactTokens(999)).toBe('999')
  })

  it('scales into K with one decimal under three digits', () => {
    expect(formatCompactTokens(1_000)).toBe('1K')
    expect(formatCompactTokens(12_200)).toBe('12.2K')
    expect(formatCompactTokens(99_900)).toBe('99.9K')
    expect(formatCompactTokens(517_000)).toBe('517K')
    expect(formatCompactTokens(999_999)).toBe('1000K')
  })

  it('scales into M with one decimal under three digits', () => {
    expect(formatCompactTokens(1_000_000)).toBe('1M')
    expect(formatCompactTokens(1_230_000)).toBe('1.2M')
    expect(formatCompactTokens(141_000_000)).toBe('141M')
  })

  it('rounds half up at the displayed precision', () => {
    expect(formatCompactTokens(12_250)).toBe('12.3K')
    expect(formatCompactTokens(1_250_000)).toBe('1.3M')
  })
})

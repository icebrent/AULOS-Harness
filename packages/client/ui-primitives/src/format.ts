/**
 * Shared presentation number formatting for token and count readouts —
 * pure string helpers with no domain imports, so every feature package
 * renders the same compact figures (517 / 12.2K / 517K / 1.2M) without
 * re-deriving the scale rules.
 */

/**
 * Compact token count: 517 / 12.2K / 517K / 1.2M (one decimal under three digits).
 * @param n - token count.
 * @returns display string.
 */
export function formatCompactTokens(n: number): string {
  const scaled = (v: number): string =>
    v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10)
  if (n < 1_000) return String(n)
  if (n < 1_000_000) return `${scaled(n / 1_000)}K`
  return `${scaled(n / 1_000_000)}M`
}

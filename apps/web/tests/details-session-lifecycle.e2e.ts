// Keyless browser regression for the details column's default visibility and Session ownership.
// The shipped composition starts closed after selection and reload, retains an explicitly opened width through
// unselected states, and closes it only when a different Session takes ownership.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import {
  acknowledgeReloadConnectionLoss, assertFixtureInventory, compareOrRefreshGolden,
  fixtureUserPrompts, launchWebScaffold, seedSession, watchConsole, webSnapshotMode,
  type WebScaffold,
} from './scaffold.ts'
import { connectFreshWorkspace, newEnglishPage, saveFailureShot } from './support.ts'

const SNAPSHOT_DIR = fileURLToPath(new URL('./snapshots/details-session-lifecycle', import.meta.url))
const HANDLES_EXPECTED = join(SNAPSHOT_DIR, 'handles.expected.md')
const FIXTURE = fileURLToPath(new URL('./snapshots/lifecycle-chrome/session.jsonl', import.meta.url))
const SEED_FIXTURE = fileURLToPath(new URL('./snapshots/seeded-history/seed.jsonl', import.meta.url))
const PROMPT = 'Reply with the single word LIGHTHOUSE and stop.'
const MODE = webSnapshotMode()

/** Last AppFrame grid track in CSS pixels. */
async function detailsTrack(page: Page): Promise<number> {
  return await appFrame(page).evaluate((element) => {
    const tracks = getComputedStyle(element).gridTemplateColumns.split(' ')
    return Number.parseFloat(tracks.at(-1) ?? 'NaN')
  })
}

/** First AppFrame grid track in CSS pixels. */
async function sidebarTrack(page: Page): Promise<number> {
  return await appFrame(page).evaluate((element) => {
    const tracks = getComputedStyle(element).gridTemplateColumns.split(' ')
    return Number.parseFloat(tracks[0] ?? 'NaN')
  })
}

/** AppFrame is the only product element with an inline grid track template. */
function appFrame(page: Page) {
  return page.locator('[style*="grid-template-columns"]').first()
}

/** Render the two column-resize handles without platform-dependent coordinates. */
async function handleSnapshot(page: Page): Promise<string> {
  const handles = await page.locator('[class*="handle"]').evaluateAll(elements =>
    elements.map(element => ({
      side: element.getAttribute('data-side'),
      cursor: getComputedStyle(element).cursor,
      pillGenerated: getComputedStyle(element, '::after').content !== 'none',
    })))
  return [
    '# AppFrame drag handles',
    '',
    ...handles.flatMap(handle => [
      `## ${handle.side}`,
      '',
      '- hit strip present: true',
      `- cursor: ${handle.cursor}`,
      `- pill generated: ${String(handle.pillGenerated)}`,
      '',
    ]),
  ].join('\n').trimEnd()
}

describe.skipIf(MODE === 'record')('web e2e: details panel follows the current Session lifecycle', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    const fixture = await readFile(FIXTURE, 'utf8')
    expect(fixtureUserPrompts(fixture)).toEqual([PROMPT])
    scaffold = await launchWebScaffold({ replayFixture: FIXTURE, paceMs: 5 })
    await seedSession(scaffold, await readFile(SEED_FIXTURE, 'utf8'), 'details-session-lifecycle-seed')
    browser = await chromium.launch()
    page = await newEnglishPage(browser)
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await appFrame(page).waitFor({ timeout: 30_000 })
    await connectFreshWorkspace(page, scaffold.workspaceCwd)
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('starts and reloads open, then stays open across Session ownership changes', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-details-session-lifecycle'))
    const settled = scaffold.whenTurnSettled()
    const input = page.locator('textarea').first()
    await input.fill(PROMPT)
    await input.press('Enter')
    await settled
    await page.getByText('LIGHTHOUSE', { exact: true }).waitFor({ timeout: 15_000 })

    // The Files column opens with the first active session (the layout
    // default), at the product's default width of 360px.
    await expect.poll(() => detailsTrack(page), { timeout: 5_000 }).toBe(360)
    await page.getByRole('tree', { name: 'Files' }).waitFor({ timeout: 10_000 })
    await compareOrRefreshGolden(HANDLES_EXPECTED, await handleSnapshot(page), MODE)

    // The header toggle closes and reopens the column; the state then
    // survives a reload (the Files panel persists across sessions too).
    // The details slot stays mounted at zero width — the track is the state.
    const toggle = page.getByRole('button', { name: 'Show or hide the Files panel' })
    await toggle.click()
    await expect.poll(() => detailsTrack(page), { timeout: 5_000 }).toBe(0)
    await toggle.click()
    await expect.poll(() => detailsTrack(page), { timeout: 5_000 }).toBe(360)

    const sidebarBefore = await sidebarTrack(page)
    const sidebarHandle = page.locator('[data-side="sidebar"]')
    const sidebarBox = await sidebarHandle.boundingBox()
    expect(sidebarBox).not.toBeNull()
    const dragStartX = sidebarBox!.x + sidebarBox!.width / 2
    await page.mouse.move(dragStartX, sidebarBox!.y + 200)
    await page.mouse.down()
    await page.mouse.move(dragStartX + 70, sidebarBox!.y + 200, { steps: 6 })
    await page.mouse.up()
    await expect.poll(() => sidebarTrack(page), { timeout: 5_000 }).toBe(sidebarBefore + 70)

    const warningStart = tripwire.warnings.length
    await page.reload({ waitUntil: 'load' })
    acknowledgeReloadConnectionLoss(tripwire, warningStart)
    await appFrame(page).waitFor({ timeout: 30_000 })
    await page.getByText('LIGHTHOUSE', { exact: true }).waitFor({ timeout: 15_000 })
    await expect.poll(() => detailsTrack(page), { timeout: 5_000 }).toBe(360)
    await page.getByRole('tree', { name: 'Files' }).waitFor({ timeout: 10_000 })

    await page.getByRole('button', { name: /^(?:New session|新.*会话)$/ }).last().click()
    await page.getByText('Into the Unknown', { exact: false }).waitFor({ timeout: 15_000 })
    // The Files column opens for an ACTIVE session only: the blank hero
    // closes the column again.
    await expect.poll(() => detailsTrack(page), { timeout: 5_000 }).toBe(0)

    const original = page.locator('[role=treeitem]').filter({ hasText: 'Reply with the single word' }).first()
    await original.click()
    await page.getByText('LIGHTHOUSE', { exact: true }).waitFor({ timeout: 15_000 })
    await expect.poll(() => detailsTrack(page), { timeout: 5_000 }).toBe(360)
    await page.getByRole('tree', { name: 'Files' }).waitFor({ timeout: 10_000 })

    const ungrouped = page.getByText('Ungrouped', { exact: true })
    const ungroupedRow = ungrouped.locator('..').locator('..')
    const ungroupedSection = ungroupedRow.locator('..')
    await expect.poll(async () => {
      if (await ungroupedRow.getAttribute('aria-expanded') !== 'true') {
        await ungrouped.click()
        await page.waitForTimeout(50)
      }
      return await ungroupedRow.getAttribute('aria-expanded')
    }, { timeout: 5_000 }).toBe('true')
    const seeded = ungroupedSection.locator('[role="treeitem"]').nth(1)
    await seeded.click()
    await page.getByText('DONE', { exact: true }).waitFor({ timeout: 15_000 })
    await expect.poll(() => detailsTrack(page), { timeout: 5_000 }).toBe(360)
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
    await assertFixtureInventory(SNAPSHOT_DIR, ['handles.expected.md'])
  }, 90_000)
})

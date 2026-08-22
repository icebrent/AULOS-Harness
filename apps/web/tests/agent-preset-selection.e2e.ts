// Web e2e scenario: agent-preset selection. The roster's `roots` is an
// assembly fact the CLI entry resolves and patches in, so every other lane
// boots with an empty roster and no preset surface at all; this is the one
// lane that mounts the SHIPPED presets (plus a fixture workspace-chat) and
// puts them in front of a browser.
//
// Two surfaces, one host rule: a session's composition is fixed when the
// session starts. Before that, the new-session screen offers two primary
// modes — Chat (workspace-chat) and Code (standard) — plus a More menu with
// every other preset; a pick stages beside the workspace picker, the only
// screen where it still works. After it, the session header names what the
// session runs and offers no control at all, because the host answers
// `agent-preset-locked` to anything else.
//
// Zero model calls: no replay fixture mounts, so a stray stream fails loud.
import { fileURLToPath } from 'node:url'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import {
  SESSION_FORMAT_VERSION, SessionId as sessionId, type SessionEvent, type SessionId,
} from '@deepseek-ai/dsh-session'
import { snapshotSubagentDescriptor } from '@deepseek-ai/dsh-subagent'
import {
  captureStableAria, compareOrRefreshGolden, launchWebScaffold, seedSession, watchConsole,
  webSnapshotMode, type WebScaffold,
} from './scaffold.ts'
import { connectFreshWorkspace, newEnglishPage, saveFailureShot } from './support.ts'

const SNAPSHOT_DIR = fileURLToPath(new URL('./snapshots/agent-preset-selection', import.meta.url))
const HERO_EXPECTED = join(SNAPSHOT_DIR, 'hero.expected.md')
const MENU_EXPECTED = join(SNAPSHOT_DIR, 'menu.expected.md')
const HEADER_EXPECTED = join(SNAPSHOT_DIR, 'header.expected.md')
/** The shipped roster, beside the composition that names it. */
const SHIPPED_PRESETS = fileURLToPath(new URL('../../cli/config/agent-presets', import.meta.url))
/** The fixture workspace-chat preset the lane stages Chat against. */
const FIXTURE_PRESETS = fileURLToPath(new URL('./fixtures/agent-presets', import.meta.url))
const MODE = webSnapshotMode()
const SEED_ID = 'agent-preset-selection-web-e2e'
/** A project skill only a preset that mounts `skill-filesystem` can discover. */
const SKILL_NAME = 'preset-catalog-demo'

/**
 * Seed one project skill under the connected workspace.
 *
 * Local skill discovery is a PRESET row, so this file is visible through
 * `standard` and invisible through `minimal` — which makes the '/' menu's
 * skill group a statement about the session's composition.
 * @param workspaceCwd - the scaffold's temp project parent.
 */
async function seedWorkspaceSkill(workspaceCwd: string): Promise<void> {
  const directory = join(workspaceCwd, 'workspace', '.agents', 'skills', SKILL_NAME)
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, 'SKILL.md'), [
    '---',
    `name: ${SKILL_NAME}`,
    'description: Prove the slash catalog follows the session composition',
    '---',
    '',
    'Body.',
    '',
  ].join('\n'))
}

/**
 * A settled one-turn session with no model content: this lane asserts chrome
 * around a conversation, not a conversation, and a recorded turn would tie
 * the golden to a provider's wording for no gain.
 * @returns a tokenized session log ending on a closed turn.
 */
function seedLog(): string {
  const time = 1784974100000
  const at = (index: number, event: Record<string, unknown>): string =>
    JSON.stringify({ ...event, seq: index, time: time + index })
  return [
    JSON.stringify({ type: 'session', version: 0, id: '{{sessionId}}', createdAt: time, cwd: '{{cwd}}/workspace' }),
    at(0, { type: 'turn/start', data: { turn: 1, trigger: { kind: 'message', source: { kind: 'user', rpcId: 'seed' } } } }),
    at(1, {
      type: 'user/message',
      data: { content: [{ type: 'text', text: 'Seeded turn.' }], source: { kind: 'user', rpcId: 'seed' } },
      surfaceOp: 'append',
    }),
    at(2, { type: 'session/title', data: { title: 'Seeded turn', messageSeqs: [1], source: { kind: 'fallback' } } }),
    at(3, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } }),
  ].join('\n')
}

/**
 * Persist one child so the assembled header snapshot exercises both action
 * contributors whose relative order is the product contract under test.
 * @param scaffold - the booted Web scaffold.
 * @param parentId - the seeded session whose header the browser opens.
 */
async function seedSubagent(scaffold: WebScaffold, parentId: SessionId): Promise<void> {
  const childId = sessionId('agent-preset-selection-child')
  const createdAt = 1784974100100
  await scaffold.ctx.sessionPersistence.create({
    version: SESSION_FORMAT_VERSION,
    id: childId,
    createdAt,
    cwd: scaffold.workspaceCwd,
    parentSession: parentId,
    origin: 'subagent',
    delegationDepth: 1,
    agentPreset: 'minimal',
  })
  await scaffold.ctx.sessionPersistence.append(childId, [
    {
      type: 'turn/start',
      seq: 0,
      time: createdAt,
      data: { turn: 1, trigger: { kind: 'message', source: { kind: 'user' } } },
    },
    {
      type: 'user/message',
      seq: 1,
      time: createdAt + 1,
      data: {
        content: [{ type: 'text', text: 'Check the session-header action order.' }],
        source: { kind: 'user' },
      },
      surfaceOp: 'append',
    },
    {
      type: 'subagent/descriptor',
      seq: 2,
      time: createdAt + 2,
      data: snapshotSubagentDescriptor({
        mode: 'one-shot', provider: 'spawn', label: 'header order probe',
      }),
    },
    {
      type: 'turn/end',
      seq: 3,
      time: createdAt + 3,
      data: { turn: 1, reason: { kind: 'completed' } },
    },
  ] as SessionEvent[])
  await scaffold.ctx.sessionProjectionCache.coldSnapshot(childId)
}

/**
 * The preset the host reports for the blank session the workspace connect
 * produced. Addressed by id rather than by scanning the serialized list: the
 * seeded session records `minimal` too, so a substring match over the whole
 * list answers before the switch has landed.
 * @param baseUrl - the scaffold's origin.
 * @returns the live session's preset, or undefined before it is listed.
 */
async function livePreset(baseUrl: string): Promise<string | undefined> {
  const response = await fetch(`${baseUrl}/api/session.list`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'client-request', rpcId: 'agent-preset-live', method: 'session.list', payload: {},
    }),
  })
  const body = await response.json() as {
    result: { value?: { items: { sessionId: string; agentPreset?: string }[] } }
  }
  return body.result.value?.items.find(item => item.sessionId !== SEED_ID)?.agentPreset
}

/** Every option label the trigger menu currently lists. */
async function menuOptions(page: Page): Promise<string[]> {
  const menu = page.getByRole('listbox', { name: 'Trigger suggestions' })
  await menu.waitFor({ timeout: 10_000 })
  return await menu.getByRole('option').allTextContents()
}

describe('web e2e: agent-preset selection', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({
      agentPresets: {
        roots: [{ path: SHIPPED_PRESETS, trust: 'system' }, { path: FIXTURE_PRESETS, trust: 'user' }],
        default: 'standard',
      },
    })
    // A resumed session runs what it was created with; seeding one that
    // records `minimal` is what makes the header label a claim about the
    // session rather than an echo of the current default.
    const seededId = await seedSession(scaffold, seedLog(), SEED_ID, 'minimal')
    await seedSubagent(scaffold, seededId)
    await seedWorkspaceSkill(scaffold.workspaceCwd)
    browser = await chromium.launch()
    page = await newEnglishPage(browser)
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('offers the two primary modes on the new-session screen, beside the workspace picker', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-agent-preset-hero'))
    await connectFreshWorkspace(page, scaffold.workspaceCwd)

    const snapshot = await captureStableAria(page, '[class*="heroPickerRows"]', scaffold.workspaceCwd)

    await compareOrRefreshGolden(HERO_EXPECTED, snapshot, MODE)
    // The picker row and the mode row render as one choice group: the
    // workspace chip, both primary mode cards, and the More trigger.
    expect(snapshot).toContain('Chat')
    expect(snapshot).toContain('Code')
    expect(snapshot).toContain('button "More"')
  })

  it('keeps every other preset behind More, each with what it is for', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-agent-preset-menu'))
    await page.getByRole('button', { name: 'More' }).click()
    const menu = page.getByRole('menu')
    await menu.waitFor({ timeout: 10_000 })

    const snapshot = await captureStableAria(page, '[role="menu"]', scaffold.workspaceCwd)

    await compareOrRefreshGolden(MENU_EXPECTED, snapshot, MODE)
    // The advanced roster, each with the sentence saying what it composes —
    // the id alone never said what a preset does.
    expect(snapshot).toContain('PTC mode')
    expect(snapshot).toContain('Minimal mode')
    expect(snapshot).toContain('Creator mode')
    // The two primary presets are the cards, not menu rows: no row names one
    // (descriptions may still mention the capability set).
    expect(snapshot.split('\n').some(line => /^  - menuitem "Standard mode/.test(line))).toBe(false)
    await page.keyboard.press('Escape')
  })

  it('stages Chat from the Chat card, and the host honors the workspace-chat preset', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-agent-preset-chat-stage'))
    await page.getByRole('button', { name: /^Chat/ }).click()

    // The card stages; the blank session the workspace connect produced is
    // what the stage lands on. The host's own answer is what comes back.
    await expect.poll(() => livePreset(scaffold.baseUrl), { timeout: 15_000 }).toBe('workspace-chat')
  })

  it('stages an advanced preset from More, and the host honors it', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-agent-preset-stage'))
    await page.getByRole('button', { name: 'More' }).click()
    await page.getByRole('menuitem', { name: /Minimal mode/ }).click()

    await expect.poll(() => livePreset(scaffold.baseUrl), { timeout: 15_000 }).toBe('minimal')
  })

  it('restores Code mode from the Code card, and the host honors standard', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-agent-preset-code-restore'))
    await page.getByRole('button', { name: /^Code/ }).click()

    await expect.poll(() => livePreset(scaffold.baseUrl), { timeout: 15_000 }).toBe('standard')
  })

  it('re-reads the slash catalog through the composition the switch installed', async () => {
    // Continues the previous case: the mode cards have already applied
    // `standard` to the blank session, and this one reads the menu that
    // switch left behind.
    onTestFailed(() => saveFailureShot(page, 'web-e2e-agent-preset-slash-catalog'))
    const composer = page.locator('textarea:enabled').last()

    await page.getByRole('button', { name: 'More' }).click()
    await page.getByRole('menuitem', { name: /Minimal mode/ }).click()
    await expect.poll(() => livePreset(scaffold.baseUrl), { timeout: 15_000 }).toBe('minimal')

    // `minimal` mounts neither the compaction group nor plan mode nor local
    // skill discovery, so the catalog the composer warmed under the
    // deployment default must not survive the switch.
    await composer.fill('/')
    await expect.poll(() => menuOptions(page), { timeout: 15_000 })
      .not.toEqual(expect.arrayContaining([expect.stringContaining(SKILL_NAME)]))
    const onMinimal = await menuOptions(page)
    expect(onMinimal.some(option => option.startsWith('compact'))).toBe(false)
    expect(onMinimal.some(option => option.startsWith('plan'))).toBe(false)
    // The host-plane commands and the client's own contribution are the
    // floor: they belong to no preset and never move.
    expect(onMinimal.some(option => option.startsWith('goal'))).toBe(true)
    expect(onMinimal.some(option => option.startsWith('model'))).toBe(true)
    await composer.fill('')

    // Switching back up reaches the host at all — the seat compares the pick
    // against its roster row, so a row that never reprojected the first switch
    // answers "already standard" and sends nothing — and restores the catalog
    // instead of leaving the session reading the narrower composition.
    await page.getByRole('button', { name: /^Code/ }).click()
    await expect.poll(() => livePreset(scaffold.baseUrl), { timeout: 15_000 }).toBe('standard')

    await composer.fill('/')
    await expect.poll(() => menuOptions(page), { timeout: 15_000 })
      .toEqual(expect.arrayContaining([expect.stringContaining(SKILL_NAME)]))
    const onStandard = await menuOptions(page)
    expect(onStandard.some(option => option.startsWith('compact'))).toBe(true)
    expect(onStandard.some(option => option.startsWith('plan'))).toBe(true)
    await composer.fill('')
  }, 90_000)

  it('labels a resumed session with the mode it was created under', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-agent-preset-header'))
    // Address the cold seeded session by persisted content so blank-session
    // pinning and group expansion state cannot change which row is resumed.
    const searchButton = page.getByRole('button', { name: 'Search sessions' })
    if (await searchButton.getAttribute('aria-expanded') !== 'true') await searchButton.click()
    const search = page.getByPlaceholder('Search sessions', { exact: false })
    await search.fill('Seeded turn')
    const seeded = page.getByRole('tree', { name: 'Search results' }).getByRole('treeitem')
    await expect.poll(() => seeded.count(), { timeout: 15_000 }).toBe(1)
    await seeded.click()
    await page.getByText('Seeded turn.', { exact: true }).last().waitFor({ timeout: 15_000 })

    const snapshot = await captureStableAria(page, '[class*="titleRow"]', scaffold.workspaceCwd)

    await compareOrRefreshGolden(HEADER_EXPECTED, snapshot, MODE)
    expect(snapshot).toContain('Minimal mode')
    expect(snapshot).toContain('button "1 subagent"')
    expect(snapshot.indexOf('button "1 subagent"')).toBeLessThan(snapshot.indexOf('Minimal mode'))
    expect(snapshot.indexOf('Minimal mode')).toBeLessThan(snapshot.indexOf('button "Session log"'))
    // Static chrome, not a control: the header can only report a composition
    // the host would refuse to change.
    expect(snapshot).not.toContain('button "Minimal mode"')
  })

  it('drove every surface without a page error or a stream warning', () => {
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
  })
})

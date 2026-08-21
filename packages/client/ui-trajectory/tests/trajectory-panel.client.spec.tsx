// @vitest-environment jsdom
// TrajectoryPanel chrome: collapsed bar, expand/collapse, inspect-driven
// auto-expand, and the clamped height drag. The shared body renders the real
// (empty) trajectory surface inside the panel, so the test also pins that
// the panel hosts the body rather than a stub.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import {
  createSnapshotStore, EMPTY_CHAT_SNAPSHOT,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { ConversationSnapshot, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { createTrajectoryDurationStore } from '../src/client/duration-store.ts'
import { TrajectoryPanel } from '../src/client/TrajectoryPanel.tsx'
import type { TrajectoryPanelProps } from '../src/client/TrajectoryPanel.tsx'
import { zh, type TrajectoryKey } from '../src/client/locales.ts'
import { EMPTY_TRAJECTORY_SNAPSHOT } from '../src/client/trajectory-snapshot-builder.ts'
import type { TrajectorySnapshot } from '../src/client/trajectory-contract.ts'

const SID = 's1' as SessionId
const t = (key: TrajectoryKey) => zh[key]

afterEach(cleanup)
beforeEach(() => {
  localStorage.clear()
  // jsdom lacks pointer capture: emulate per-element so the drag gates pass.
  const captured = new Set<Element>()
  Element.prototype.setPointerCapture = function () { captured.add(this) }
  Element.prototype.releasePointerCapture = function () { captured.delete(this) }
  Element.prototype.hasPointerCapture = function () { return captured.has(this) }
})

function snapshot(over: Partial<TrajectorySnapshot> = {}): ConversationSnapshot {
  const trajectory: TrajectorySnapshot = { ...EMPTY_TRAJECTORY_SNAPSHOT, ...over }
  return {
    sessionId: SID,
    views: { get: target => (target === 'trajectory' ? trajectory : undefined) },
    chat: EMPTY_CHAT_SNAPSHOT,
    nodes: [],
    turnTimings: new Map(),
    turnEnds: new Map(),
    partial: null,
    runningCalls: [],
    pending: [],
    queue: [],
    running: false,
    subagent: null,
    composerPhase: 'active',
    removed: false,
    openState: 'open',
    openError: null,
    hasMore: false,
    loadingOlder: false,
    promptError: null,
    blank: false,
    lastAgentError: null,
  }
}

interface Mount {
  view: ReturnType<typeof render>
  duration: ReturnType<typeof createTrajectoryDurationStore>
  rerender: (props: Partial<Pick<TrajectoryPanelProps, 'inspect' | 'onInspectDone'>>) => void
}

function mount(over: Partial<Pick<TrajectoryPanelProps, 'inspect' | 'onInspectDone'>> = {}): Mount {
  const store = createSnapshotStore(snapshot())
  const duration = createTrajectoryDurationStore()
  const props: TrajectoryPanelProps = {
    sessionId: SID,
    useSession: bindSnapshotSelector(store),
    useSessions: (() => ({})) as never,
    useWorkspaces: (() => ({})) as never,
    useProjection: (() => undefined),
    useInput: (() => { throw new Error('unused') }),
    inputActions: {} as never,
    useDuration: bindSnapshotSelector(duration),
    loadOlder: vi.fn(() => Promise.resolve(false)),
    setActualDuration: (value) => { duration.set(value) },
    inspect: null,
    onInspectDone: vi.fn(),
    t: t as never,
    ...over,
  }
  const view = render(<TrajectoryPanel {...props} />)
  return {
    view,
    duration,
    rerender: (next) => { view.rerender(<TrajectoryPanel {...props} {...next} />) },
  }
}

describe('TrajectoryPanel', () => {
  it('renders the collapsed bar and expands to host the shared trajectory body', () => {
    mount()
    expect(screen.getByRole('button', { name: '展开轨迹面板' }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('region', { name: '底部轨迹面板' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '展开轨迹面板' }))
    // The shared body's toolbar renders inside the panel (not a stub).
    expect(screen.getByRole('region', { name: '底部轨迹面板' })).toBeTruthy()
    expect(screen.getByRole('toolbar', { name: '轨迹工具栏' })).toBeTruthy()
    expect(screen.getByText('No timing data')).toBeTruthy()
    // The conversation namespace copy is untouched by the panel wrapper.
    expect(screen.getByRole('button', { name: '收起轨迹面板' })).toBeTruthy()
  })

  it('collapses back to the bar and drops the body', () => {
    const b = mount()
    fireEvent.click(screen.getByRole('button', { name: '展开轨迹面板' }))
    fireEvent.click(screen.getByRole('button', { name: '收起轨迹面板' }))
    expect(screen.queryByRole('region', { name: '底部轨迹面板' })).toBeNull()
    expect(screen.getByRole('button', { name: '展开轨迹面板' })).toBeTruthy()
    expect(b.view.container.querySelector('[role="toolbar"]')).toBeNull()
  })

  it('auto-expands when an inspect request arrives from chat', () => {
    const b = mount()
    b.rerender({ inspect: { callId: 'c1' } })
    expect(screen.getByRole('region', { name: '底部轨迹面板' })).toBeTruthy()
  })

  it('resizes through the top handle, clamped to the contract range', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: '展开轨迹面板' }))
    const region = screen.getByRole('region', { name: '底部轨迹面板' })
    const handle = screen.getByRole('separator', { name: '调整轨迹面板高度' })
    // Default height before any drag.
    expect(region.style.height).toBe('280px')

    // Drag up (negative delta = taller), far past the ceiling. A release
    // between frames applies the final position synchronously.
    fireEvent.pointerDown(handle, { pointerId: 1, clientY: 300 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 0 })
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 0 })
    expect(region.style.height).toBe('560px')

    // Drag down past the floor.
    fireEvent.pointerDown(handle, { pointerId: 2, clientY: 100 })
    fireEvent.pointerMove(handle, { pointerId: 2, clientY: 2_000 })
    fireEvent.pointerUp(handle, { pointerId: 2, clientY: 2_000 })
    expect(region.style.height).toBe('160px')
  })

  it('pauses the height transition while dragging and restores it after', () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: '展开轨迹面板' }))
    const handle = screen.getByRole('separator', { name: '调整轨迹面板高度' })
    fireEvent.pointerDown(handle, { pointerId: 1, clientY: 100 })
    expect(screen.getByRole('region', { name: '底部轨迹面板' }).hasAttribute('data-dragging')).toBe(true)
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 100 })
    expect(screen.getByRole('region', { name: '底部轨迹面板' }).hasAttribute('data-dragging')).toBe(false)
  })

  it('shares the duration preference with the full view through the injected store', () => {
    const b = mount()
    fireEvent.click(screen.getByRole('button', { name: '展开轨迹面板' }))
    const toggle = screen.getByRole('button', { name: 'Use actual duration' })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(toggle)
    expect(localStorage.getItem('dsh.trajectory.duration')).toBe('true')
    expect(b.duration.getSnapshot()).toBe(true)
  })
})

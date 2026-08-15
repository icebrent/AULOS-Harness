// @vitest-environment jsdom
// FullTrajectoryButton: the header entry into the detailed trajectory tab —
// writes the shared chat store's active view, hides while the tab is active.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { createChatStore } from '../src/client/stores.ts'
import { zh } from '../src/client/locales.ts'
import { FullTrajectoryButton } from '../src/client/skeleton/FullTrajectoryButton.tsx'
import type { FullTrajectoryButtonProps } from '../src/client/skeleton/FullTrajectoryButton.tsx'

afterEach(cleanup)
beforeEach(() => { localStorage.clear() })

const t = makeTranslate(zh, commonZh) as never

/** The button reads only the store pair and the locale seat; the rest of the
 *  session standard kit is never touched. */
function props(chat: ReturnType<ReturnType<typeof createChatStore>['create']>): FullTrajectoryButtonProps {
  return {
    useStore: bindSnapshotSelector(chat),
    actions: chat.actions,
    t,
  } as unknown as FullTrajectoryButtonProps
}

describe('FullTrajectoryButton', () => {
  it('switches the shared store to the trajectory view on click', () => {
    const chat = createChatStore().create()
    render(<FullTrajectoryButton {...props(chat)} />)
    fireEvent.click(screen.getByRole('button', { name: '完整轨迹' }))
    expect(chat.getSnapshot().view).toBe('trajectory')
  })

  it('hides while the trajectory tab is already active', () => {
    const chat = createChatStore().create()
    chat.actions.setView('trajectory')
    render(<FullTrajectoryButton {...props(chat)} />)
    expect(screen.queryByRole('button', { name: '完整轨迹' })).toBeNull()
  })
})

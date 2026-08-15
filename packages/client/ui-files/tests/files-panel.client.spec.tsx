// @vitest-environment jsdom
// FilesPanel behavior over mocked host listings: root load, lazy directory
// expansion, empty/error/truncated states, workspace-switch reload, selection,
// and the host-open double click. All data arrives through the component's
// plain props — no render machinery.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { DirectoryListing, SessionId, SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { FilesPanel } from '../src/client/FilesPanel.tsx'
import { zh } from '../src/client/locales.ts'
import type { FilesPanelProps } from '../src/client/FilesPanel.tsx'

afterEach(cleanup)

const SID = 's1' as SessionId
const t = makeTranslate(zh, commonZh)

function listing(path: string, dirs: string[], files: string[] = [], over: Partial<DirectoryListing> = {}): DirectoryListing {
  return {
    path,
    home: '/home/fixture',
    crumbs: [],
    entries: dirs.map(name => ({ name, path: `${path}/${name}`, hidden: name.startsWith('.') })),
    truncated: false,
    files: files.map(name => ({ name, path: `${path}/${name}`, hidden: name.startsWith('.') })),
    ...over,
  }
}

/** Session list with one current session whose cwd can move between renders. */
function sessions(cwd: string | undefined) {
  return createSnapshotStore<SessionListState>(cwd === undefined
    ? { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined }
    : {
      ids: [SID],
      byId: { [SID]: { id: SID, displayTitle: 's', running: false, blank: false, updatedAt: 0, cwd } },
      current: SID,
      phase: 'ready',
      subagentsByParent: {}, jobsBySession: {},
      currentAddress: undefined,
    })
}

interface Mount {
  view: ReturnType<typeof render>
  listDirectory: ReturnType<typeof vi.fn<(path?: string, signal?: AbortSignal) => Promise<DirectoryListing>>>
  openPath: ReturnType<typeof vi.fn<(path: string) => Promise<void>>>
  closeFiles: ReturnType<typeof vi.fn<() => void>>
  rerender: (cwd: string | undefined) => void
}

function mount(cwd: string | undefined, listDirectory?: Mount['listDirectory']): Mount {
  const lister = listDirectory ?? vi.fn(async (path?: string) => listing(path ?? '/', [], []))
  const openPath = vi.fn<(path: string) => Promise<void>>(() => Promise.resolve())
  const closeFiles = vi.fn<() => void>()
  const store = sessions(cwd)
  const props: FilesPanelProps = {
    sessionId: SID,
    useSession: (() => ({}) as never),
    useSessions: bindSnapshotSelector(store),
    useWorkspaces: (() => ({}) as never),
    useProjection: (() => undefined),
    useInput: (() => { throw new Error('unused') }),
    inputActions: {} as never,
    listDirectory: lister,
    openPath,
    closeFiles,
    t,
  }
  const view = render(<FilesPanel {...props} />)
  const rerender = (nextCwd: string | undefined) => {
    const next = sessions(nextCwd)
    view.rerender(<FilesPanel {...{ ...props, useSessions: bindSnapshotSelector(next) }} />)
  }
  return { view, listDirectory: lister, openPath, closeFiles, rerender }
}

describe('FilesPanel', () => {
  it('loads the root level and renders directories then files with their icons', async () => {
    const lister = vi.fn(async (path?: string) =>
      path === '/w' ? listing('/w', ['src', 'packages'], ['README.md', 'package.json']) : listing(path ?? '/', [], []))
    const b = mount('/w', lister)
    expect(b.view.getByText('载入中…')).toBeTruthy()
    await waitFor(() => { expect(b.view.getByText('src')).toBeTruthy() })
    expect(b.view.getByText('packages')).toBeTruthy()
    expect(b.view.getByText('README.md')).toBeTruthy()
    expect(b.view.getByText('package.json')).toBeTruthy()
    // The root path row labels the workspace by its basename.
    expect(b.view.getByText('w')).toBeTruthy()
    expect(lister).toHaveBeenCalledWith('/w', expect.any(AbortSignal))
  })

  it('lists a directory only on first expand, and keeps loaded children while collapsed', async () => {
    const lister = vi.fn(async (path?: string) => {
      if (path === '/w') return listing('/w', ['src'], ['a.ts'])
      if (path === '/w/src') return listing('/w/src', ['deep'], ['b.ts'])
      return listing(path ?? '/', [], [])
    })
    const b = mount('/w', lister)
    await waitFor(() => { expect(b.view.getByText('src')).toBeTruthy() })
    expect(lister).toHaveBeenCalledTimes(1)
    fireEvent.click(b.view.getByText('src'))
    await waitFor(() => { expect(b.view.getByText('b.ts')).toBeTruthy() })
    expect(b.view.getByText('deep')).toBeTruthy()
    expect(lister).toHaveBeenCalledTimes(2)
    // Collapse: the loaded children unmount, the level itself is not reloaded.
    fireEvent.click(b.view.getByText('src'))
    expect(b.view.queryByText('b.ts')).toBeNull()
    fireEvent.click(b.view.getByText('src'))
    await waitFor(() => { expect(b.view.getByText('b.ts')).toBeTruthy() })
    expect(lister).toHaveBeenCalledTimes(2)
  })

  it('renders the localized empty marker for a directory with no children', async () => {
    const b = mount('/w', vi.fn(async (path?: string) =>
      path === '/w' ? listing('/w', ['src']) : listing(path ?? '/', [], [])))
    await waitFor(() => { expect(b.view.getByText('src')).toBeTruthy() })
    fireEvent.click(b.view.getByText('src'))
    await waitFor(() => { expect(b.view.getByText('空目录')).toBeTruthy() })
  })

  it('shows the error state on a failed listing and retries through refresh', async () => {
    const lister = vi.fn<(path?: string, signal?: AbortSignal) => Promise<DirectoryListing>>()
      .mockRejectedValueOnce(new Error('denied'))
      .mockResolvedValueOnce(listing('/w', [], ['ok.ts']))
    const b = mount('/w', lister)
    await waitFor(() => { expect(b.view.getByText('无法读取目录')).toBeTruthy() })
    fireEvent.click(b.view.getByText('重试'))
    await waitFor(() => { expect(b.view.getByText('ok.ts')).toBeTruthy() })
    expect(lister).toHaveBeenCalledTimes(2)
  })

  it('reloads the root when the workspace (session cwd) switches', async () => {
    const lister = vi.fn(async (path?: string) =>
      path === '/w1' ? listing('/w1', ['one']) : listing('/w2', ['two']))
    const b = mount('/w1', lister)
    await waitFor(() => { expect(b.view.getByText('one')).toBeTruthy() })
    b.rerender('/w2')
    await waitFor(() => { expect(b.view.getByText('two')).toBeTruthy() })
    expect(b.view.queryByText('one')).toBeNull()
  })

  it('selects a file on click and opens it through the host on double click', async () => {
    const b = mount('/w', vi.fn(async (path?: string) => listing(path ?? '/', [], ['a.ts'])))
    await waitFor(() => { expect(b.view.getByText('a.ts')).toBeTruthy() })
    fireEvent.click(b.view.getByText('a.ts'))
    expect(b.view.getByRole('treeitem', { selected: true }).textContent).toContain('a.ts')
    fireEvent.doubleClick(b.view.getByText('a.ts'))
    expect(b.openPath).toHaveBeenCalledWith('/w/a.ts')
  })

  it('flags a truncated level with the more-entries row', async () => {
    const b = mount('/w', vi.fn(async (path?: string) =>
      listing(path ?? '/', ['src'], [], { truncated: true, filesTruncated: false })))
    await waitFor(() => { expect(b.view.getByText('… 更多条目未显示')).toBeTruthy() })
  })

  it('closes the panel through the injected layout callback', async () => {
    const b = mount('/w', vi.fn(async (path?: string) => listing(path ?? '/', [], [])))
    await waitFor(() => { expect(b.view.getByText('空目录')).toBeTruthy() })
    fireEvent.click(b.view.getByRole('button', { name: '隐藏文件栏' }))
    expect(b.closeFiles).toHaveBeenCalledTimes(1)
  })

  it('renders the error state without a session cwd and never lists', () => {
    const b = mount(undefined)
    expect(b.view.getByText('无法读取目录')).toBeTruthy()
    expect(b.listDirectory).not.toHaveBeenCalled()
  })
})

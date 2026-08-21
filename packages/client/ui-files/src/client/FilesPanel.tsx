/**
 * FilesPanel: the right column's project tree over the host browse seam
 * (`ctx.workspaces.listDirectory`, one level per call). Pure presentation —
 * every figure arrives through the framework hooks or the injected callbacks;
 * the tree loads lazily (a directory lists only on first expand), a workspace
 * switch (the session row's cwd change) reloads the root, and each in-flight
 * listing is abortable. No recursive scans: the host bounds every level.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import type { DirectoryEntry, DirectoryListing } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import {
  IconChevronDownOutline14, IconChevronRightOutline14, IconCloseOutline16,
  IconFileOutline16, IconFolderClose16, IconFolderOpen16, IconRefreshOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import css from './FilesPanel.module.css'

/** One loaded level: the host's name-sorted rows plus its cut flags. */
interface Level {
  dirs: readonly DirectoryEntry[]
  files: readonly DirectoryEntry[]
  dirsTruncated: boolean
  filesTruncated: boolean
}

/** Loading state of one tree level. */
type LevelStatus = { state: 'loading' } | { state: 'ready'; level: Level } | { state: 'error' }

const EMPTY_EXPANDED: ReadonlySet<string> = new Set()

function levelOf(listing: DirectoryListing): Level {
  return {
    dirs: listing.entries,
    files: listing.files ?? [],
    dirsTruncated: listing.truncated,
    filesTruncated: listing.filesTruncated === true,
  }
}

/** Workspace root display label: the cwd's basename. */
function rootLabel(path: string): string {
  const base = path.replace(/[/\\]+$/, '').split(/[/\\]/).pop()
  return base !== undefined && base !== '' ? base : path
}

/** Callbacks injected from the plugin apply world (identity-stable per fiber). */
export interface FilesPanelInjected {
  /** One-level listing through the host browse seam. */
  listDirectory: (path?: string, signal?: AbortSignal) => Promise<DirectoryListing>
  /** Open a path with the host's default application. */
  openPath: (path: string) => Promise<void>
  /** Close the files column (layout geometry stays with ctx.layout). */
  closeFiles: () => void
}

/** Full composed props: the details-slot runtime share, the injected callbacks, and the locale seat. */
export type FilesPanelProps = PropsRuntime<'details'> & FilesPanelInjected & PropsLocale<'files'>

/** File-row handler pair threaded through every tree level. */
interface FileHandlers {
  onSelect: (path: string) => void
  onOpen: (file: DirectoryEntry) => void
}

/** One directory row: chevron + folder glyph + name, lazy-loading on first expand. */
function DirRow({
  dir, depth, expanded, status, selectedPath, onToggle, handlers, renderRow, t,
}: {
  dir: DirectoryEntry
  depth: number
  expanded: boolean
  status: LevelStatus | undefined
  selectedPath: string | null
  onToggle: (dir: DirectoryEntry) => void
  handlers: FileHandlers
  renderRow: (child: DirectoryEntry, depth: number) => React.ReactNode
  t: TranslateNS<'files'>
}) {
  const childDirs = status?.state === 'ready' ? status.level.dirs : []
  const childFiles = status?.state === 'ready' ? status.level.files : []
  return (
    <div role="treeitem" aria-expanded={expanded}>
      <button
        type="button"
        className={css.row}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => { onToggle(dir) }}
      >
        <span className={css.chevron} aria-hidden>
          {expanded ? <IconChevronDownOutline14 /> : <IconChevronRightOutline14 />}
        </span>
        <span className={css.folderIcon} aria-hidden>
          {expanded ? <IconFolderOpen16 size={15} /> : <IconFolderClose16 size={15} />}
        </span>
        <span className={css.name}>{dir.name}</span>
      </button>
      {expanded && status?.state === 'loading' && (
        <div className={css.levelStatus} style={{ paddingLeft: 8 + (depth + 1) * 14 }}>{t('loading')}</div>
      )}
      {expanded && status?.state === 'error' && (
        <div className={css.levelStatus} style={{ paddingLeft: 8 + (depth + 1) * 14 }}>{t('error')}</div>
      )}
      {expanded && status?.state === 'ready' && childDirs.map(child => renderRow(child, depth + 1))}
      {expanded && status?.state === 'ready' && childFiles.map(file => (
        <FileRow
          key={file.path}
          file={file}
          depth={depth + 1}
          selectedPath={selectedPath}
          handlers={handlers}
          t={t}
        />
      ))}
      {expanded && status?.state === 'ready' && childDirs.length === 0 && childFiles.length === 0 && (
        <div className={css.levelStatus} style={{ paddingLeft: 8 + (depth + 1) * 14 }}>{t('empty')}</div>
      )}
    </div>
  )
}

/** One file row: file glyph + name; select on click, host-open on double click. */
function FileRow({
  file, depth, selectedPath, handlers, t,
}: {
  file: DirectoryEntry
  depth: number
  selectedPath: string | null
  handlers: FileHandlers
  t: TranslateNS<'files'>
}) {
  const selected = selectedPath === file.path
  return (
    <div role="treeitem" aria-selected={selected}>
      <button
        type="button"
        className={clsx(css.row, selected && css.rowSelected)}
        style={{ paddingLeft: 8 + depth * 14 + 16 }}
        title={t('openFile', { name: file.name })}
        onClick={() => { handlers.onSelect(file.path) }}
        onDoubleClick={() => { handlers.onOpen(file) }}
      >
        <span className={css.fileIcon} aria-hidden>
          <IconFileOutline16 size={15} />
        </span>
        <span className={css.name}>{file.name}</span>
      </button>
    </div>
  )
}

/**
 * Render the Files column.
 * @param props - composed slot props.
 * @returns the files tree surface.
 */
export function FilesPanel({
  sessionId, useSessions, listDirectory, openPath, closeFiles, t,
}: FilesPanelProps) {
  const rootPath = useSessions(s => s.byId[sessionId]?.cwd)
  const [root, setRoot] = useState<LevelStatus>({ state: 'loading' })
  const [children, setChildren] = useState<Readonly<Record<string, LevelStatus>>>({})
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(EMPTY_EXPANDED)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  // Live in-flight listings, aborted when their level reloads or the root moves.
  const controllers = useRef(new Map<string, AbortController>())

  const loadLevel = useCallback((path: string, controller: AbortController, onSettled: (status: LevelStatus) => void) => {
    controllers.current.get(path)?.abort()
    controllers.current.set(path, controller)
    listDirectory(path, controller.signal).then(
      (listing) => {
        if (controller.signal.aborted) return
        controllers.current.delete(path)
        onSettled({ state: 'ready', level: levelOf(listing) })
      },
      () => {
        if (controller.signal.aborted) return
        controllers.current.delete(path)
        onSettled({ state: 'error' })
      },
    )
  }, [listDirectory])

  // Root lifecycle: load on cwd change; a workspace switch aborts every
  // in-flight level and resets the tree to the new root.
  useEffect(() => {
    for (const controller of controllers.current.values()) controller.abort()
    controllers.current.clear()
    setChildren({})
    setExpanded(EMPTY_EXPANDED)
    setSelectedPath(null)
    if (rootPath === undefined) {
      setRoot({ state: 'error' })
      return
    }
    setRoot({ state: 'loading' })
    const controller = new AbortController()
    loadLevel(rootPath, controller, setRoot)
    return () => { controller.abort() }
  }, [rootPath, loadLevel])

  // Unmount (the files column closed): abort every in-flight level so a
  // departed panel leaves no listing running.
  useEffect(() => () => {
    for (const controller of controllers.current.values()) controller.abort()
    controllers.current.clear()
  }, [])

  const toggleDir = (dir: DirectoryEntry): void => {
    const next = new Set(expanded)
    if (next.has(dir.path)) {
      next.delete(dir.path)
      setExpanded(next)
      return
    }
    next.add(dir.path)
    setExpanded(next)
    if (children[dir.path] !== undefined) return
    setChildren(current => ({ ...current, [dir.path]: { state: 'loading' } }))
    const controller = new AbortController()
    loadLevel(dir.path, controller, (status) => { setChildren(current => ({ ...current, [dir.path]: status })) })
  }

  const refresh = (): void => {
    if (rootPath === undefined) return
    for (const controller of controllers.current.values()) controller.abort()
    controllers.current.clear()
    setChildren({})
    setExpanded(EMPTY_EXPANDED)
    setRoot({ state: 'loading' })
    const controller = new AbortController()
    loadLevel(rootPath, controller, setRoot)
  }

  const openFile = (file: DirectoryEntry): void => {
    openPath(file.path).catch(() => {
      // Host/OS open failures stay silent in the tree; the native app
      // surfaces its own error dialog when the path is unusable.
    })
  }

  const handlers: FileHandlers = { onSelect: setSelectedPath, onOpen: openFile }

  const renderRow = (entry: DirectoryEntry, depth: number): React.ReactNode => (
    <DirRow
      key={entry.path}
      dir={entry}
      depth={depth}
      expanded={expanded.has(entry.path)}
      status={children[entry.path]}
      selectedPath={selectedPath}
      onToggle={toggleDir}
      handlers={handlers}
      renderRow={renderRow}
      t={t}
    />
  )

  const rows: React.ReactNode[] = []
  if (root.state === 'ready') {
    for (const dir of root.level.dirs) rows.push(renderRow(dir, 0))
    for (const file of root.level.files) {
      rows.push(
        <FileRow
          key={file.path}
          file={file}
          depth={0}
          selectedPath={selectedPath}
          handlers={handlers}
          t={t}
        />,
      )
    }
  }

  return (
    <div className={css.root}>
      <header className={css.header}>
        <span className={css.title}>{t('title')}</span>
        <div className={css.actions}>
          <button
            type="button"
            className={css.iconButton}
            aria-label={t('refresh')}
            title={t('refresh')}
            onClick={refresh}
          >
            <IconRefreshOutline16 />
          </button>
          <button
            type="button"
            className={css.iconButton}
            aria-label={t('close')}
            title={t('close')}
            onClick={() => { closeFiles() }}
          >
            <IconCloseOutline16 />
          </button>
        </div>
      </header>
      {rootPath !== undefined && (
        <div className={css.rootPath} title={rootPath}>{rootLabel(rootPath)}</div>
      )}
      <div className={css.tree} role="tree" aria-label={t('title')}>
        {root.state === 'loading' && <div className={css.status}>{t('loading')}</div>}
        {root.state === 'error' && (
          <div className={css.status}>
            <span>{t('error')}</span>
            <button type="button" className={css.retry} onClick={refresh}>{t('retry')}</button>
          </div>
        )}
        {root.state === 'ready' && rows.length === 0 && (
          <div className={css.status}>{t('empty')}</div>
        )}
        {root.state === 'ready' && rows.length > 0 && (
          <>
            {rows}
            {(root.level.dirsTruncated || root.level.filesTruncated) && (
              <div className={css.truncated}>{t('truncated')}</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

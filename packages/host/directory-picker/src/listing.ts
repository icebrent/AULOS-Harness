/**
 * Shared one-level listing engine of the directory-picker seam: the bounded,
 * name-sorted, abortable level scan every web-capable backend serves through
 * its capability (browse and native alike). One engine, one policy — hidden
 * entries are flagged and returned, symlinks are probed (directories into
 * `entries`, files into `files`, broken links skipped), and each kind's head
 * is cut at `maxEntries` with an honest truncation flag. Pure stdlib; the
 * policy rationale lives in the directory-picker seam Agent Note.
 * @module @deepseek-ai/dsh-host-directory-picker/listing
 */

import { opendir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, posix, resolve, win32 } from 'node:path'

/** One directory row: a listing child or a breadcrumb ancestor. */
export interface DirectoryEntry {
  /** Base name shown in a browser row (a root crumb carries its full path). */
  name: string
  /** Absolute host path — clients never join path segments themselves. */
  path: string
  /** Hidden by the host platform's convention (dot-prefixed on POSIX); the client owns whether to show it. */
  hidden: boolean
}

/** Closed failure vocabulary of the browse primitives (mirrored onto the wire by consumers). */
export type DirectoryPickerErrorCode = 'directory-unreadable' | 'directory-exists' | 'directory-create-failed'

/** Typed failure thrown by browse primitives so consumers can map business codes without string matching. */
export class DirectoryPickerError extends Error {
  /**
   * @param code - closed business code of the failure.
   * @param path - the absolute path the failure is about.
   * @param message - operator-facing description.
   */
  constructor(readonly code: DirectoryPickerErrorCode, readonly path: string, message: string) {
    super(message)
    this.name = 'DirectoryPickerError'
  }
}

/**
 * True when the path names one fixed filesystem location regardless of
 * process state: POSIX-absolute on POSIX; on Windows only drive-qualified
 * (`C:\…`) or complete UNC (`\\server\share…`) forms. Rooted drive-less
 * forms (`\foo`, `/foo`) and incomplete UNC prefixes (`\\`, `\\server`)
 * pass `isAbsolute` yet still resolve against the process's current drive.
 * @param path - candidate path.
 * @param platform - replaces `process.platform` for deterministic tests.
 * @returns whether the path is fully qualified on the platform.
 */
export function fullyQualified(path: string, platform: NodeJS.Platform = process.platform): boolean {
  return platform === 'win32'
    ? win32.isAbsolute(path) && /^(?:[A-Za-z]:[\\/]|[\\/]{2}[^\\/]+[\\/]+[^\\/]+)/.test(path)
    : posix.isAbsolute(path)
}

/** One streamed listing candidate: the dirent facts a row needs, nothing else retained. */
export interface ListingCandidate {
  /** Base name within the streamed level. */
  name: string
  /** Dirent says directory (no probe needed). */
  isDirectory: boolean
  /** Dirent says symlink (enterability needs a stat probe). */
  isSymbolicLink: boolean
}

/**
 * Insert a streamed candidate into the name-sorted bounded window, evicting
 * the name-largest candidate when the window exceeds `keep`. Memory over an
 * arbitrarily large level therefore stays O(keep) regardless of how many
 * children the directory holds.
 * @param window - the name-ascending window, mutated in place.
 * @param candidate - the streamed candidate to place.
 * @param keep - the window bound.
 * @returns true when an eviction happened (the level has candidates beyond the window).
 */
export function boundedInsert(window: ListingCandidate[], candidate: ListingCandidate, keep: number): boolean {
  // Full window, name at or beyond the tail: one comparison rejects, so an
  // oversized level costs O(1) per candidate past the head instead of a
  // window scan (100k children against a 1,001 window must not approach
  // 10^8 comparisons).
  // oxlint-disable-next-line typescript/no-non-null-assertion -- a full window (length === keep >= 1) has a tail
  if (window.length === keep && candidate.name.localeCompare(window[window.length - 1]!.name) >= 0) return true
  // Binary insertion keeps a retained candidate at O(log keep) comparisons.
  let lo = 0
  let hi = window.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    // oxlint-disable-next-line typescript/no-non-null-assertion -- bounded by the loop condition
    if (candidate.name.localeCompare(window[mid]!.name) < 0) hi = mid
    else lo = mid + 1
  }
  window.splice(lo, 0, candidate)
  if (window.length <= keep) return false
  window.pop()
  return true
}

/**
 * Await `operation`, but reject with the signal's reason the moment it
 * aborts. Node's filesystem reads are not retractable, so the operation
 * itself keeps running against a handle the caller then closes — its late
 * settlement is swallowed here so an abandoned read cannot surface as an
 * unhandled rejection.
 * @param operation - the in-flight filesystem step.
 * @param signal - caller lifetime; absent means plain awaiting.
 * @returns the operation's value.
 */
export function raceAbort<T>(operation: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (signal === undefined) return operation
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      operation.catch(() => {
        // Abandoned read: its handle is being closed by the aborting caller,
        // and the abort reason already carried the outcome.
      })
      reject(asError(signal.reason))
    }
    if (signal.aborted) {
      onAbort()
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })
    operation.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (reason: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(asError(reason))
      },
    )
  })
}

/** The thrown value as an Error (wire/abort reasons may be anything). */
function asError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason))
}

/* v8 ignore start -- a close failure of an abandoned handle has no consumer, and forcing one needs a filesystem torn down mid-request. */
/** Swallow the close failure of a handle its caller already departed. */
function swallowCloseFailure(): void {}
/* v8 ignore stop */

/** Message text of an unknown thrown value. */
function messageOf(error: unknown): string {
  /* v8 ignore next -- node:fs rejects with Error instances; the String arm only satisfies the unknown narrowing. */
  return error instanceof Error ? error.message : String(error)
}

/**
 * One listing row for a dirent, following symlinks to directories; null for
 * broken/cyclic links (skipped silently — the browser shows what resolves,
 * and a broken link cannot). A symlink resolving to a file yields a file row
 * instead, so the Files tree sees linked files without inventing rows.
 */
async function probedRow(
  parent: string, name: string, isDirectory: boolean, isSymbolicLink: boolean, signal: AbortSignal | undefined,
): Promise<{ kind: 'directory' | 'file'; row: DirectoryEntry } | null> {
  const path = join(parent, name)
  let enterable = isDirectory
  if (!enterable && isSymbolicLink) {
    try {
      // The probe races the caller too: a symlink target on a stalled
      // network filesystem must not keep a departed caller's request alive.
      enterable = (await raceAbort(stat(path), signal)).isDirectory()
    } catch {
      /* v8 ignore next 2 -- an abort landing mid-probe needs a stalled stat; the per-candidate check in list covers the settled path. */
      if (signal?.aborted) throw asError(signal.reason)
      // Broken or cyclic symlink: stat is the probe, failure means "unresolvable".
      return null
    }
  }
  // POSIX hidden convention; Windows' hidden attribute is not exposed by
  // dirents (Known Limitations). The client owns whether hidden rows show.
  return { kind: enterable ? 'directory' : 'file', row: { name, path, hidden: name.startsWith('.') } }
}

/**
 * Insert a file row into the name-sorted files head, evicting the
 * name-largest row when the head exceeds its bound.
 * @param files - the name-ascending head, mutated in place.
 * @param row - the row to place.
 * @param max - the wire bound of the head.
 * @returns true when an eviction happened (the level has files beyond the head).
 */
function insertFileRow(files: DirectoryEntry[], row: DirectoryEntry, max: number): boolean {
  let lo = 0
  let hi = files.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    // oxlint-disable-next-line typescript/no-non-null-assertion -- bounded by the loop condition
    if (row.name.localeCompare(files[mid]!.name) < 0) hi = mid
    else lo = mid + 1
  }
  files.splice(lo, 0, row)
  if (files.length <= max) return false
  files.pop()
  return true
}

/** The name-sorted heads of one listed level, each cut at its own bound. */
export interface ListLevel {
  /** Direct child directories, name-sorted; symlinks to directories included. */
  entries: DirectoryEntry[]
  /** Direct child files, name-sorted; symlinks resolving to files included. */
  files: DirectoryEntry[]
  /** True when the backend cut `entries` at its complete-result bound. */
  truncated: boolean
  /** True when the backend cut `files` at its complete-result bound. */
  filesTruncated: boolean
}

/** One complete listing level plus its ancestry, as either backend reports it. */
export interface DirectoryListing {
  /** Absolute path of the listed directory. */
  path: string
  /** The host account's home directory (breadcrumb "Home" rooting). */
  home: string
  /**
   * Ancestor chain from the filesystem root to the listed directory
   * inclusive; every crumb is a jump target (crumb `hidden` is always false).
   */
  crumbs: DirectoryEntry[]
  /** Direct child directories, name-sorted; symlinks to directories included. */
  entries: DirectoryEntry[]
  /**
   * True when the backend cut `entries` at its complete-result bound: the
   * level has more child directories than reported, and the missing rows are
   * the name-sorted tail (hidden rows count toward the bound).
   */
  truncated: boolean
  /**
   * Direct child files, name-sorted, absent only from backends that predate
   * the Files-tree extension. Symlinks resolving to files are included;
   * broken links are skipped. Bounded by the same `maxEntries` as `entries`.
   */
  files?: DirectoryEntry[]
  /**
   * True when the backend cut `files` at its complete-result bound: the level
   * has more child files than reported, and the missing rows are the
   * name-sorted tail.
   */
  filesTruncated?: boolean
}

/**
 * Ancestor chain from the filesystem root to `target` inclusive — the
 * breadcrumb rows of a listing, every one a jump target.
 * @param target - absolute directory whose ancestry the listing reports.
 * @returns the root-to-target crumb rows, root first.
 */
export function ancestryCrumbs(target: string): DirectoryEntry[] {
  const crumbs: DirectoryEntry[] = []
  let current = target
  for (;;) {
    const parent = dirname(current)
    // basename of a root is '' — label the root crumb by its full path ('/', 'C:\').
    crumbs.unshift({ name: parent === current ? current : basename(current), path: current, hidden: false })
    if (parent === current) return crumbs
    current = parent
  }
}

/**
 * Stream one directory level into name-sorted, bounded heads per kind. The
 * level streams via `opendir` one dirent at a time, so memory stays
 * O(maxEntries) no matter how many children the directory holds; each head's
 * +1 proof slot becomes its truncation flag, and only windowed symlink
 * candidates are probed. Every filesystem await races the caller's signal.
 * @param target - resolved absolute directory to list.
 * @param maxEntries - per-kind wire bound of the level.
 * @param signal - caller lifetime; abort stops the scan and rejects with the abort reason.
 * @returns the level's two heads and their cut flags.
 * @throws {DirectoryPickerError} `directory-unreadable` when the level cannot be opened.
 */
export async function listDirectoryLevel(
  target: string, maxEntries: number, signal?: AbortSignal,
): Promise<ListLevel> {
  const keep = maxEntries + 1
  const window: ListingCandidate[] = []
  const fileWindow: ListingCandidate[] = []
  let evicted = false
  let fileEvicted = false
  try {
    const opening = opendir(target)
    const level = await raceAbort(opening, signal).catch((error: unknown) => {
      // The abandoned open can still mint a handle after the abort won;
      // close it so a departed caller cannot leak a descriptor.
      void opening.then(dir => dir.close().catch(swallowCloseFailure), () => {
        // Already rejected: raceAbort surfaced or swallowed it.
      })
      throw error
    })
    try {
      for (;;) {
        const dirent = await raceAbort(level.read(), signal)
        if (dirent === null) break
        const candidate = { name: dirent.name, isDirectory: dirent.isDirectory(), isSymbolicLink: dirent.isSymbolicLink() }
        // Directories and symlinks (kind unknown until the stat probe)
        // contend for the directory window; regular files for the file
        // window. Only rows a browser could show contend at all.
        if (dirent.isDirectory() || dirent.isSymbolicLink()) {
          if (boundedInsert(window, candidate, keep)) evicted = true
        } else if (boundedInsert(fileWindow, candidate, keep)) {
          fileEvicted = true
        }
      }
    } finally {
      // Manual read() never auto-closes; close on every exit. The aborted
      // exit must not await it — Node queues close behind any in-flight
      // read, so awaiting would chain the departed caller back onto the
      // very stall the abort escaped.
      const closing = level.close()
      /* v8 ignore next 3 -- an abort between open and close needs a stalled read; the abandoned-close arm has no observable outcome. */
      if (signal?.aborted) {
        closing.catch(swallowCloseFailure)
      } else {
        await closing
      }
    }
  } catch (error: unknown) {
    // An abort is the caller's own reason, not an unreadable directory.
    signal?.throwIfAborted()
    throw new DirectoryPickerError('directory-unreadable', target, `cannot list ${target}: ${messageOf(error)}`)
  }
  const entries: DirectoryEntry[] = []
  let truncated = evicted
  let filesTruncated = fileEvicted
  // Regular files need no probe: the streamed window is already the
  // name-sorted head, and its +1 proof slot becomes the truncation flag.
  const files: DirectoryEntry[] = []
  for (const candidate of fileWindow) {
    if (files.length === maxEntries) {
      filesTruncated = true
      break
    }
    files.push({ name: candidate.name, path: join(target, candidate.name), hidden: candidate.name.startsWith('.') })
  }
  for (const candidate of window) {
    // A caller that departed between reads and probes stops before the
    // next probe (each probe's own await is raced inside probedRow).
    signal?.throwIfAborted()
    const probed = await probedRow(target, candidate.name, candidate.isDirectory, candidate.isSymbolicLink, signal)
    if (probed === null) continue
    if (probed.kind === 'directory') {
      if (entries.length === maxEntries) {
        truncated = true
        continue
      }
      entries.push(probed.row)
    } else if (insertFileRow(files, probed.row, maxEntries)) {
      filesTruncated = true
    }
  }
  return { entries, files, truncated, filesTruncated }
}

/**
 * One complete listing level a capability `list` serves: the
 * fully-qualified fence, the home anchor, the bounded level scan, and the
 * ancestry wrap in one call. Both backends delegate here, so every web
 * composition receives the same listing regardless of which backend the
 * adaptive chooser resolved.
 * @param path - absolute directory to list; absent lists the home directory.
 * @param maxEntries - per-kind wire bound of the level.
 * @param signal - caller lifetime; abort stops the scan and rejects with the abort reason.
 * @returns the level's listing with ancestry.
 * @throws {DirectoryPickerError} `directory-unreadable` when the path is not fully qualified or the level cannot be listed.
 */
export async function listDirectory(
  path: string | undefined, maxEntries: number, signal?: AbortSignal,
): Promise<DirectoryListing> {
  const home = homedir()
  // The seam contract takes fully qualified paths only; resolve() would
  // silently rebase a relative or empty wire value under the host process
  // cwd (or, for rooted drive-less Windows forms, its current drive).
  if (path !== undefined && !fullyQualified(path)) {
    throw new DirectoryPickerError('directory-unreadable', path, `cannot list "${path}": not a fully qualified path`)
  }
  const target = resolve(path ?? home)
  const level = await listDirectoryLevel(target, maxEntries, signal)
  return {
    path: target,
    home,
    crumbs: ancestryCrumbs(target),
    entries: level.entries,
    truncated: level.truncated,
    files: level.files,
    filesTruncated: level.filesTruncated,
  }
}

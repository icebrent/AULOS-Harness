/** The seam's shared listing engine: the fully-qualified fence, bounded scan,
 *  ancestry wrap, and abort threading every backend's `list` serves. */

import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { basename, join, parse, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  ancestryCrumbs, boundedInsert, DirectoryPickerError, fullyQualified,
  listDirectory, listDirectoryLevel, raceAbort,
} from '../src/listing.ts'
import type { ListingCandidate } from '../src/listing.ts'

let root: string
/** Whether this platform allows the file symlink fixture (Windows denies unprivileged file symlinks). */
let fileLinkWorks = false

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'dsh-listing-'))
  await mkdir(join(root, 'projects'))
  await mkdir(join(root, '.hidden-dir'))
  await writeFile(join(root, 'notes.txt'), 'not a directory')
  await writeFile(join(root, '.env'), 'hidden file')
  await writeFile(join(root, 'file-2.txt'), 'second')
  await writeFile(join(root, 'file-3.txt'), 'third')
  await symlink(join(root, 'projects'), join(root, 'linked'), 'junction')
  // Broken link: a junction whose target does not exist. `stat` is the
  // enterability probe, and its failure means "unresolvable".
  await symlink(join(root, 'missing-target'), join(root, 'broken'), 'junction')
  try {
    await symlink(join(root, 'notes.txt'), join(root, 'file-link'))
    fileLinkWorks = true
  } catch {
    // Windows denies unprivileged file symlinks; the file-link rows only
    // feed the POSIX lanes.
  }
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('fullyQualified', () => {
  it('accepts POSIX-absolute paths and rejects relative and empty ones on POSIX', () => {
    expect(fullyQualified('/a/b', 'linux')).toBe(true)
    expect(fullyQualified('/', 'linux')).toBe(true)
    expect(fullyQualified('a/b', 'linux')).toBe(false)
    expect(fullyQualified('', 'linux')).toBe(false)
  })

  it('accepts drive-qualified and complete UNC forms on Windows, rejecting rooted drive-less forms', () => {
    expect(fullyQualified('C:\\a\\b', 'win32')).toBe(true)
    expect(fullyQualified('c:/a', 'win32')).toBe(true)
    expect(fullyQualified('\\\\server\\share\\a', 'win32')).toBe(true)
    expect(fullyQualified('\\\\server\\share', 'win32')).toBe(true)
    expect(fullyQualified('\\a', 'win32')).toBe(false)
    expect(fullyQualified('/a', 'win32')).toBe(false)
    expect(fullyQualified('C:rel', 'win32')).toBe(false)
    expect(fullyQualified('\\\\', 'win32')).toBe(false)
    expect(fullyQualified('\\\\server', 'win32')).toBe(false)
    expect(fullyQualified('a\\b', 'win32')).toBe(false)
  })
})

describe('boundedInsert', () => {
  const cand = (name: string): ListingCandidate => ({ name, isDirectory: true, isSymbolicLink: false })

  it('keeps a name-sorted window and evicts the name-largest candidate on overflow', () => {
    const window: ListingCandidate[] = []
    expect(boundedInsert(window, cand('b'), 2)).toBe(false)
    expect(boundedInsert(window, cand('a'), 2)).toBe(false)
    expect(window.map(row => row.name)).toEqual(['a', 'b'])
    // Overflow below the tail: 'ab' lands between the two and evicts 'b'.
    expect(boundedInsert(window, cand('ab'), 2)).toBe(true)
    expect(window.map(row => row.name)).toEqual(['a', 'ab'])
  })

  it('rejects a full-window candidate at or beyond the tail in one comparison', () => {
    const window: ListingCandidate[] = [cand('a'), cand('b')]
    expect(boundedInsert(window, cand('c'), 2)).toBe(true)
    expect(window.map(row => row.name)).toEqual(['a', 'b'])
  })
})

describe('raceAbort', () => {
  it('awaits plain operations without a signal', async () => {
    await expect(raceAbort(Promise.resolve(7), undefined)).resolves.toBe(7)
  })

  it('resolves with the operation value and unhooks the listener on success', async () => {
    const signal = new AbortController().signal
    await expect(raceAbort(Promise.resolve('done'), signal)).resolves.toBe('done')
  })

  it('rejects with the abort reason once the signal fires', async () => {
    const controller = new AbortController()
    const pending = raceAbort(new Promise(() => {}), controller.signal)
    controller.abort(new Error('gone'))
    await expect(pending).rejects.toThrow('gone')
  })

  it('rejects immediately for an already-aborted signal, non-Error reason and all', async () => {
    const controller = new AbortController()
    controller.abort('plain reason')
    await expect(raceAbort(new Promise(() => {}), controller.signal)).rejects.toThrow('plain reason')
  })

  it('propagates an operation failure as an Error', async () => {
    await expect(raceAbort(Promise.reject(new Error('read failed')), new AbortController().signal))
      .rejects.toThrow('read failed')
  })
})

describe('ancestryCrumbs', () => {
  it('walks from the filesystem root to the target, every crumb a jump target', () => {
    const target = join(root, 'projects')
    const crumbs = ancestryCrumbs(target)
    expect(crumbs.at(-1)).toEqual({ name: basename(target), path: target, hidden: false })
    expect(crumbs[0]!.path).toBe(parse(target).root)
    expect(crumbs[0]!.name).toBe(parse(target).root)
    // Every step appends one basename to the previous crumb's path.
    for (let index = 1; index < crumbs.length; index++) {
      expect(join(crumbs[index - 1]!.path, crumbs[index]!.name)).toBe(crumbs[index]!.path)
      expect(crumbs[index]!.hidden).toBe(false)
    }
  })
})

describe('listDirectoryLevel', () => {
  it('streams one level into name-sorted directory and file heads, flagging hidden rows and following symlinks', async () => {
    const level = await listDirectoryLevel(root, 1000)
    expect(level.entries.map(entry => entry.name)).toEqual(['.hidden-dir', 'linked', 'projects'])
    expect(level.entries.map(entry => entry.hidden)).toEqual([true, false, false])
    expect(level.files.map(entry => entry.name)).toEqual(
      fileLinkWorks ? ['.env', 'file-2.txt', 'file-3.txt', 'file-link', 'notes.txt'] : ['.env', 'file-2.txt', 'file-3.txt', 'notes.txt'],
    )
    expect(level.truncated).toBe(false)
    expect(level.filesTruncated).toBe(false)
  })

  it('cuts each head at maxEntries and reports the cuts', async () => {
    const level = await listDirectoryLevel(root, 1)
    expect(level.entries.map(entry => entry.name)).toEqual(['.hidden-dir'])
    expect(level.truncated).toBe(true)
    expect(level.files.map(entry => entry.name)).toEqual(['.env'])
    expect(level.filesTruncated).toBe(true)
  })

  it('skips broken symlinks instead of inventing rows for them', async () => {
    const level = await listDirectoryLevel(root, 1000)
    expect(level.entries.some(entry => entry.name === 'broken')).toBe(false)
  })

  it('rejects an unreadable level with the business code and subject path', async () => {
    const target = join(root, 'notes.txt')
    const failure = await listDirectoryLevel(target, 1000).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(DirectoryPickerError)
    expect((failure as DirectoryPickerError).code).toBe('directory-unreadable')
    expect((failure as DirectoryPickerError).path).toBe(target)
    expect((failure as DirectoryPickerError).message).toContain('cannot list')
  })

  it('stops the scan when the signal aborts and surfaces the abort reason', async () => {
    const controller = new AbortController()
    controller.abort(new Error('caller left'))
    await expect(listDirectoryLevel(root, 1000, controller.signal)).rejects.toThrow('caller left')
    // The abandoned open settles and closes its handle on a later tick; give
    // it that tick so the afterAll cleanup never meets an open descriptor.
    await new Promise(resolve => setTimeout(resolve, 20))
  })

  it('folds a rejected open under an aborted caller into the abort reason too', async () => {
    const controller = new AbortController()
    controller.abort('gone')
    await expect(listDirectoryLevel(join(root, 'missing'), 1000, controller.signal)).rejects.toBe('gone')
  })

  it.runIf(fileLinkWorks)('folds symlinked files into the bounded file head', async () => {
    await symlink(join(root, 'notes.txt'), join(root, 'file-link-2'))
    const level = await listDirectoryLevel(root, 3)
    expect(level.entries.map(entry => entry.name)).toEqual(['.hidden-dir'])
    expect(level.files.map(entry => entry.name)).toEqual(['.env', 'file-2.txt', 'file-3.txt'])
    expect(level.filesTruncated).toBe(true)
  })
})

describe('listDirectory', () => {
  it('lists a fully-qualified target with its home anchor and ancestry', async () => {
    const listing = await listDirectory(root, 1000)
    expect(listing.path).toBe(root)
    expect(listing.home).toBe(homedir())
    expect(listing.crumbs.at(-1)?.path).toBe(root)
    expect(listing.entries.map(entry => entry.name)).toEqual(['.hidden-dir', 'linked', 'projects'])
  })

  it('defaults an absent path to the host home directory', async () => {
    const listing = await listDirectory(undefined, 1000)
    expect(listing.path).toBe(resolve(homedir()))
    expect(listing.crumbs[0]?.path).toBe(parse(resolve(homedir())).root)
  })

  it('rejects a non-fully-qualified path with the business code instead of rebasing it', async () => {
    for (const relative of ['', 'projects', './projects', '..']) {
      const failure = await listDirectory(relative, 1000).catch((error: unknown) => error)
      expect(failure).toBeInstanceOf(DirectoryPickerError)
      expect((failure as DirectoryPickerError).code).toBe('directory-unreadable')
      expect((failure as DirectoryPickerError).path).toBe(relative)
    }
  })

  it('threads the caller signal through the scan', async () => {
    const controller = new AbortController()
    controller.abort('caller left')
    await expect(listDirectory(root, 1000, controller.signal)).rejects.toBe('caller left')
    await new Promise(resolve => setTimeout(resolve, 20))
  })
})

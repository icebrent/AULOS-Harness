/** Registration/capability behavior of the native backend (the seam's cordis half),
 *  including the shared level listing every native composition serves. */

import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { DirectoryPickerError } from '@deepseek-ai/dsh-host-directory-picker'
import type { DirectoryPickerNativeCapability } from '@deepseek-ai/dsh-host-directory-picker'
import NativeDirectoryPicker from '../src/index.ts'

let root: string
let capability: DirectoryPickerNativeCapability
let dispose: () => Promise<void>
/** Whether this platform allows the file symlink fixture (Windows denies unprivileged file symlinks). */
let fileLinkWorks = false

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'dsh-native-'))
  await mkdir(join(root, 'projects'))
  await mkdir(join(root, '.hidden-dir'))
  await writeFile(join(root, 'notes.txt'), 'not a directory')
  await writeFile(join(root, '.env'), 'hidden file')
  await symlink(join(root, 'projects'), join(root, 'linked'), 'junction')
  try {
    await symlink(join(root, 'notes.txt'), join(root, 'file-link'))
    fileLinkWorks = true
  } catch {
    // Windows denies unprivileged file symlinks; the file-link row only
    // feeds the POSIX lanes' coverage of the symlink-to-file arm.
  }
  const ctx = new Context()
  const fiber = ctx.plugin(NativeDirectoryPicker)
  await fiber.await()
  const picked = ctx.get('directoryPicker')!.capability()
  if (picked.kind !== 'native') throw new Error('native backend must advertise the native capability')
  capability = picked
  dispose = () => fiber.dispose()
})

afterAll(async () => {
  await dispose()
  await rm(root, { recursive: true, force: true })
})

describe('NativeDirectoryPicker', () => {
  it('registers ctx.directoryPicker with a stable native capability and leaves with its fiber', async () => {
    const ctx = new Context()
    const fiber = ctx.plugin(NativeDirectoryPicker)
    await fiber.await()
    const picker = ctx.get('directoryPicker')
    expect(picker).toBeInstanceOf(NativeDirectoryPicker)
    const native = picker!.capability()
    expect(native.kind).toBe('native')
    // Stability: consumers may capture the capability object across calls.
    expect(picker!.capability()).toBe(native)
    await fiber.dispose()
    expect(ctx.get('directoryPicker')).toBeUndefined()
  })

  it('lists directories and files separately through the shared engine, flagging hidden rows and following symlinks', async () => {
    const listing = await capability.list(root)
    expect(listing.path).toBe(root)
    expect(listing.entries.map(entry => entry.name)).toEqual(['.hidden-dir', 'linked', 'projects'])
    expect(listing.entries.map(entry => entry.hidden)).toEqual([true, false, false])
    expect(listing.files?.map(entry => entry.name)).toEqual(
      fileLinkWorks ? ['.env', 'file-link', 'notes.txt'] : ['.env', 'notes.txt'],
    )
    expect(listing.truncated).toBe(false)
    expect(listing.filesTruncated).toBe(false)
  })

  it('applies the same maxEntries bound per kind and reports each cut head', async () => {
    const ctx = new Context()
    const fiber = ctx.plugin(NativeDirectoryPicker, { maxEntries: 1 })
    await fiber.await()
    const bounded = ctx.get('directoryPicker')!.capability()
    if (bounded.kind !== 'native') throw new Error('native backend must advertise the native capability')
    try {
      const cut = await bounded.list(root)
      expect(cut.entries.map(entry => entry.name)).toEqual(['.hidden-dir'])
      expect(cut.truncated).toBe(true)
      expect(cut.files?.map(entry => entry.name)).toEqual(['.env'])
      expect(cut.filesTruncated).toBe(true)
    } finally {
      await fiber.dispose()
    }
  })

  it('rejects non-fully-qualified paths instead of rebasing them under the process cwd', async () => {
    for (const relative of ['', 'projects', './projects', '..']) {
      const failure = await capability.list(relative).catch((error: unknown) => error)
      expect(failure).toBeInstanceOf(DirectoryPickerError)
      expect((failure as DirectoryPickerError).code).toBe('directory-unreadable')
      expect((failure as DirectoryPickerError).path).toBe(relative)
    }
  })
})

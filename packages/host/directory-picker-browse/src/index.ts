/**
 * Browse backend of the directory-picker seam: registers `ctx.directoryPicker`
 * with the `browse` capability — one-level listing (child directories AND
 * child files, so the Files tree reuses the same seam) and child-directory
 * creation over the host filesystem. The listing scan and its fence are the
 * seam's shared engine (directory-picker/listing.ts): this backend adds the
 * create primitive. Nothing renders on the host
 * display, so this backend serves remote clients the dialog backend cannot.
 * Policy decisions (hidden entries flagged but returned, symlinks followed,
 * whole-filesystem scope) are recorded in the directory-picker seam Agent
 * Note.
 * @module @deepseek-ai/dsh-host-directory-picker-browse
 */

import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import {
  DirectoryPicker, DirectoryPickerError, fullyQualified, listDirectory,
} from '@deepseek-ai/dsh-host-directory-picker'
import type {
  DirectoryListing, DirectoryPickerCapability,
} from '@deepseek-ai/dsh-host-directory-picker'

// Compatibility re-exports: this package's tests (and any consumer that came
// to the engine through it) keep importing the listing primitives here; the
// authoritative home is the seam package.
export { boundedInsert, fullyQualified, raceAbort } from '@deepseek-ai/dsh-host-directory-picker'
export type { ListingCandidate } from '@deepseek-ai/dsh-host-directory-picker'

/** Validated plugin configuration. */
export interface Config {
  /** Complete-result bound of one listing level; see {@link BrowseDirectoryPicker.Config}. */
  maxEntries: number
}

/** The `ctx.directoryPicker` browse implementation (stable capability object per service life). */
export default class BrowseDirectoryPicker extends DirectoryPicker {
  /**
   * `maxEntries` bounds the complete listing level a single `list` call may
   * materialize and put on the wire: at most this many child-directory rows
   * AND at most this many child-file rows (hidden rows included), with
   * `truncated` / `filesTruncated` flagging each cut head. The default
   * follows GitHub's web UI, which truncates directory listings at 1,000
   * entries.
   */
  static Config: z<Config> = z.object({
    maxEntries: z.natural().min(1).default(1000),
  })

  private readonly browseCapability: DirectoryPickerCapability = {
    kind: 'browse',
    list: (path, signal) => this.list(path, signal),
    createDirectory: (path, name) => this.createDirectory(path, name),
  }

  constructor(ctx: Context, private readonly config: Config) {
    super(ctx)
  }

  /**
   * The browse interaction capability.
   * @returns the stable `browse` capability object.
   */
  capability(): DirectoryPickerCapability {
    return this.browseCapability
  }

  private list(path?: string, signal?: AbortSignal): Promise<DirectoryListing> {
    return listDirectory(path, this.config.maxEntries, signal)
  }

  private async createDirectory(path: string, name: string): Promise<string> {
    // Same fully-qualified fence as list: never rebase a parent under the
    // cwd or the current drive.
    if (!fullyQualified(path)) {
      throw new DirectoryPickerError('directory-create-failed', path, `cannot create under "${path}": not a fully qualified parent path`)
    }
    const parent = resolve(path)
    // The backend owns segment validation (the wire schema also refuses these,
    // but direct service consumers must hit the same fence).
    if (name.trim() === '' || name === '.' || name === '..' || /[/\\]/.test(name)) {
      throw new DirectoryPickerError('directory-create-failed', join(parent, name), `"${name}" is not a single path segment`)
    }
    const target = join(parent, name)
    try {
      // Non-recursive: the parent is the directory the browser is showing, so
      // a missing parent is a real failure, not a level to invent.
      await mkdir(target)
      return target
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST') {
        throw new DirectoryPickerError('directory-exists', target, `${target} already exists`)
      }
      const message = error instanceof Error ? error.message : String(error)
      throw new DirectoryPickerError('directory-create-failed', target, `cannot create ${target}: ${message}`)
    }
  }
}

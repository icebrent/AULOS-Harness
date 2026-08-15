/**
 * Native backend of the directory-picker seam: registers `ctx.directoryPicker`
 * with the `native` capability — one native OS chooser on the host display
 * per pick (macOS `osascript`, Linux Zenity with a KDialog fallback; Windows
 * opens the modern `IFileOpenDialog` in a spawned child process — a
 * koffi-driven COM conversation on the child's main thread) — plus the
 * seam's shared one-level listing engine, so web consumers like the Files
 * tree can list directories even where the picker interaction stays native.
 * Only viable when the operator sits at the host's screen; remote
 * deployments compose the browse backend instead.
 * @module @deepseek-ai/dsh-host-directory-picker-native
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { DirectoryPicker, listDirectory } from '@deepseek-ai/dsh-host-directory-picker'
import type {
  DirectoryListing, DirectoryPickerCapability,
} from '@deepseek-ai/dsh-host-directory-picker'
import { pickNativeDirectory } from './native-picker.ts'

export type { DirectoryPickerInternals, DirectoryPickerRunner } from './native-picker.ts'
export { pickNativeDirectory } from './native-picker.ts'

/** Validated plugin configuration. */
export interface Config {
  /** Complete-result bound of one listing level; the same bound the browse backend applies. */
  maxEntries: number
}

/** The `ctx.directoryPicker` native implementation (stable capability object per service life). */
export default class NativeDirectoryPicker extends DirectoryPicker {
  static Config: z<Config> = z.object({
    maxEntries: z.natural().min(1).default(1000),
  })

  private readonly nativeCapability: DirectoryPickerCapability = {
    kind: 'native',
    /* v8 ignore next -- pure forward to pickNativeDirectory (its spec owns behavior); invoking here opens a real chooser. */
    pick: signal => pickNativeDirectory(signal),
    list: (path, signal) => this.list(path, signal),
  }

  constructor(ctx: Context, private readonly config: Config) {
    super(ctx)
  }

  /**
   * The native interaction capability.
   * @returns the stable `native` capability object.
   */
  capability(): DirectoryPickerCapability {
    return this.nativeCapability
  }

  private list(path?: string, signal?: AbortSignal): Promise<DirectoryListing> {
    return listDirectory(path, this.config.maxEntries, signal)
  }
}

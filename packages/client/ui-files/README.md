# @deepseek-ai/dsh-client-ui-files

English | [中文](README.zh.md)

Files panel plugin: the right column's project tree over the host listing seam. It registers one entry into the frame's `details` slot (declared by [ui-layout](../ui-layout/README.md)) and binds `ctx.workspaces.listDirectory` plus the layout close action as the panel's injected callbacks. The tree is pure presentation: every row arrives from the seam's one-level `DirectoryListing` (`entries` directories + `files`), and nothing here re-derives paths or rescans levels.

Expansion is lazy — a directory lists only on its first expand, with an abortable request that supersedes any in-flight listing of the same level. A workspace switch changes the current session's `cwd`; the panel reloads the root, aborts every in-flight level, and resets expansion and selection. Root levels render the localized loading / empty / error states; a failed listing offers a retry, a truncated level renders the more-entries marker, and hidden rows render like any other. Files select on click and open through `ctx.workspaces.openPath` on double click; the panel's close button drives `ctx.layout.closeDetails`.

The `/client` exports are the plugin body (`apply`/`inject`) plus the contract types only; FilesPanel and the tree derivation remain package-internal behind the slot registration.

## Model Experience

None, as the tree renders host directory listings; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Git modification status is not shown** — the listing seam reports no VCS state; adding it would need a host-side git status call, deferred until the tree earns it.
- **No in-panel preview/editor** — double click hands the path to the host's default application; a preview surface belongs to a future editor seam.
- **Refresh resets the tree** — loaded child levels are dropped and re-expansion reloads them; a per-level refresh is deferred.

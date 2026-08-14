# Agent Note: AI workspace presentation layer (v2)

Status: implemented

Supersedes the v1 presentation ([2026-08-14-chat-code-dual-mode-new-session-ui.md](2026-08-14-chat-code-dual-mode-new-session-ui.md)) while keeping its Chat / Code preset mapping intact.

## Problem

The v1 prototype still read as "original Harness plus two Chat/Code cards": the developer-oriented three-pane default, the peer Chat | Trajectory tabs, the raw tool rows filling the transcript, and the one-line stats strip under the composer. The product target is a calm macOS-workspace surface where the conversation is the main content, runtime data lives in a right inspector, and trajectory becomes an observability layer behind an Activity entry.

## Decision

- **Light macOS visual system.** The light alias palette moves to a warm off-white page behind white content surfaces with hairline separators and restrained shadows; new product tokens (`--dsw-alias-page-bg/surface/surface-raised/surface-tint/border-soft/border-faint/shadow-soft/shadow-float/radius-md/radius-lg`) are added to both schemes. The default theme preference is now `light` (the OS preference no longer overrides it).
- **Three-column product layout.** The existing AppFrame columns are restyled; the right column becomes an inspector that is open by default for active sessions (layout store default) and persists across session switches.
- **Right inspector (Context | Activity).** The details slot occupant becomes an inspector. The Context tab reads the official projections only: `contextPressure`/`contextBreakdown` (occupancy ring), `tokenUsage` (input/output/cache + hit rate), `sessionStats` (TTFT/throughput/turn/steps/durations). The Activity tab's Recent Activity list is a lightweight presentation over the conversation node read model (`chat.legacy.nodes`, the assembler's compatibility projection) — settled tool names and their wall times from already-assembled nodes, not a stats projection and never raw session events. The selected tool call's details remain an embedded view. The composer's one-line stats strip is removed. The model row is intentionally absent — the model directory is a service, not a projection.
- **Tool activity folding.** The chat flow partitions into plain rows and per-turn activity folds: tool calls and intermediate assistant steps collapse into a quiet `✓ Completed · N tools` row (expandable), a compact live block while the turn runs, and error rows are never folded. User messages, the closing assistant report, commands, approvals, questions, and turn tails stay plain rows.
- **Trajectory hierarchy.** The Chat | Trajectory tab ring is removed. The full trajectory is opened only from the Activity panel (`Open full trajectory` → view-ring switch), with a slim back bar; the Input/Model/Tools timeline and the full ledger are untouched.
- **Quiet session header + segmented mode selector.** The header drops the tabs and runtime stats; the new-session mode selector becomes a macOS segmented control (Chat | Code | More) with the same preset mapping.

## Verification

The affected client suites (ui-conversation, ui-agent-preset, ui-layout, ui-trajectory, ui-theme) and the full `test:gui` pass (272 files / 3764 tests). `pnpm run build` (host + client tsc/tsdown + web dist) passes. A real-Chrome probe of the served v2 bundles shows the segmented hero and no page errors.

## Alternatives considered

**New ui-inspector package.** Rejected for this pass: the inspector needs the chat store (`setView`, selection) and the details slot, which live in ui-conversation; a new package would need a cross-package view-switch channel. The details column stayed in ui-conversation as the thin path.

**A second stats pipeline.** Rejected: every Context figure reads the existing projections and the Activity list rides the node read model; nothing is recomputed from raw events.

## Consequences

The web e2e goldens were regenerated for v2 through the browser lane (`DSH_SNAPSHOT=refresh pnpm run test:web`), and the e2e flows that drove the removed Chat | Trajectory tab ring now open the trajectory through the Activity panel. The activity fold's first implementation matched the wrong Conversation Node kinds (`tool`/`assistant` instead of the registered `tool-call`/`assistant-step`) and never rendered until corrected in the same change. At narrow viewports `computeColumns` force-closes the details column, so the full trajectory is currently unreachable while the viewport cannot fit the inspector; reaching it there needs a product decision (let an explicit toggle override the derived close, or move the trajectory entry back into the conversation chrome). v2 behavior is covered by the client suites.

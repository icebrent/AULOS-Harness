# Agent Note: Chat / Code dual-mode new-session UI

Status: implemented

English | [中文](2026-08-14-chat-code-dual-mode-new-session-ui.zh.md)

## Problem

The new-session screen led with a flat list of agent presets (Standard, Code Mode, Minimal, Creator, plus user-authored ones), which put the full roster in front of a user whose actual choice is between two working modes: a conversational workspace-aware agent (`workspace-chat`) and the full coding agent (`standard`). The session header likewise named the preset, exposing internal preset ids to users who think in modes.

## Decision

The Web client now projects the roster into two primary modes plus a fallback:

- **Chat** stages the `workspace-chat` preset. Its card copy emphasizes discussion, analysis, and understanding of the current workspace.
- **Code** stages the `standard` preset. Its card copy emphasizes modifying, running, and debugging.
- **More** is a menu holding every other preset (Code Mode, Minimal, Creator, user-authored), so no shipped capability disappears.

The mapping lives in `packages/client/ui-agent-preset/src/client/modes.ts` as two preset-id constants and is a pure roster projection: a mode whose preset id is absent from the deployment renders nothing, and every non-primary preset stays reachable behind More. The existing seat-store staging/apply mechanics are reused unchanged — a pick stages and lands on the blank session the workspace flow produces, exactly like the old chip.

The hero layout gains a mode row under the workspace picker (`heroPickerRows` wraps picker row + mode row so the two read as one choice group). The session-header label now names the mode (Chat / Code) for the two primary presets and falls back to the preset's own display name for everything else — never the raw preset id.

No backend, agent-loop, session, workspace, permission, persistence, trajectory, tool, or LLM code changed. The permission system and workspace picker are untouched; Creator/Minimal/etc. remain selectable through More and unchanged in their files. The mapping constants intentionally mirror the deployment's preset ids (`workspace-chat`, `standard`) rather than redefining preset semantics.

## Verification

Package component specs drive the selector with hand-built stores (mode cards map to their preset ids, More lists only non-primary presets, staged advanced names appear on the More trigger, header labels resolve Chat/Code/advanced names). The web e2e lane boots the shipped roster plus a fixture `workspace-chat` preset and asserts Chat → `workspace-chat`, More → `minimal`, Code → `standard` through the live host RPC, plus the slash catalog following the installed composition. Header/hero goldens refreshed accordingly.

## Alternatives considered

**Keep the flat chip and only rename entries.** Rejected: the acceptance criteria require two clear primary entries; renaming rows inside one menu still fronts the whole roster.

**Make the mapping a settings/Config field.** Rejected for v1: the browser plugin half has no Config channel, and two UI-level constants with graceful roster-projection fallback cover the prototype's deployments.

**Hide trajectory/tool chrome in Chat mode.** Deferred: the `workspace-chat` composition has no terminal/git/diff tools, so coding-oriented renderers never mount for it; per-mode chrome filtering is a later iteration.

## Consequences

Sessions created through Chat/Code stage their preset exactly as before; header labels for `standard`/`workspace-chat` sessions now read Code/Chat. A deployment without the mapped presets shows only the cards that exist and keeps the rest in More — nothing is lost. Goldens for every lane that mounts the shipped roster changed (`Standard mode` → `Code` in session headers).

## Related

The [AI workspace presentation layer (v2)](2026-08-14-ai-workspace-presentation-layer-v2.md) supersedes this note's hero/selector presentation while keeping its Chat / Code preset mapping intact.

# Agent Note: Agent runtime inspection

Status: implemented

English | [中文](2026-08-19-agent-runtime-inspection.zh.md)

## Problem

The generated Tool catalog answers which plugins can provide Tools, not which Tools one live Agent can resolve or which schemas its next model request receives. Agent presets, scoped restrictions and shadowing, and per-agent Tool presentation make those sets different. Reading preset YAML cannot prove runtime visibility, while loading the existing Cordis authoring Tool set would grant mutation capabilities to a read-only diagnostic Agent.

## Decision

The independent `@deepseek-ai/dsh-tool-cordis/runtime-inspect` entry registers one read-only `inspect_runtime` Tool on the global Tool layer. The opt-in `examples/runtime-inspect` overlay loads only that subpath, so one definition can inspect new Agents composed from different presets without editing those presets or loading the package's dynamic Cordis authoring tools. Omitting the overlay removes the diagnostic completely.

The report reads `ctx.tools.schemas(agent)` as the scoped capability catalog and the post-waterfall result of `ctx.systemPrompt.assemble({ scope: agent, agent })` as the model-presented catalog. This preserves the distinction owned by [per-agent Tool presentation](../feature/2026-08-05-per-agent-tool-presentation.md): Code Mode may retain many scoped capabilities while presenting only `run_code` natively. The report compares the two name sets, describes the final prompt sections, records live and Session-derived preset identity, and checks a fixed list of mutation, execution, delegation, terminal, workflow, Ralph, and Git-related Tool names.

The diagnostic reports provenance only as `global` or `scoped-chain`. It proves `global` when global and scoped lookup resolve the same Tool definition. `ToolRuntime` retains no registering Plugin identity and does not expose individual ancestor layers, so the diagnostic reports no invented Plugin or preset source. `PromptAssembly` likewise retains final section order but not each registration's numeric order; the report's `order` is the zero-based effective position after assembly.

## Alternatives considered

**Load the self-referential Cordis Tool set.** Rejected: its inspection is coupled to dynamic-package definition, execution, stop, and removal Tools. That capability expansion is incompatible with a read-only Chat Agent and still does not expose the post-waterfall model Tool list.

**Parse preset YAML.** Rejected: configuration rows do not prove activation, scope inheritance, restrictions, shadowing, presentation collapse, or the preset actually bound to a live Agent.

**Add Tool provenance and prompt registration order to Harness Core.** Rejected: the present diagnosis needs accurate names and final request contents, which existing public runtime APIs provide. Core provenance would be a larger API and storage decision with no current production consumer.

## Consequences

Developers can compare preset runtimes through the same read-only Tool and can reproduce the evidence with fresh Sessions. The inspector itself appears in both scoped and presented catalogs while the overlay is loaded.

The Tool is development-only and opt-in rather than a shipped preset capability. Its unit coverage exercises the real Tool execution pipeline and a scoped assembly waterfall that hides one registered capability, proving that the two catalogs come from different runtime observations.

# Agent Note: AULOS customization layer on the rc.8 foundation

Status: implemented
Archived: 2026-08-22

English | [中文](2026-08-21-aulos-rc8-customization-layer.zh.md)

## Problem

AULOS was based on the `dsh@0.1.0-rc.5` source tree and carried product presentation, workspace navigation, and branding changes directly beside upstream code. The `dsh@0.1.0-rc.8` release adds generic branding slots, file and session references, persistent PowerShell composition on Windows, native image input, provider retry policy, SQLite persistence improvements, and experimental Agent Teams. Replaying every AULOS commit would retain broad naming edits and duplicate upstream mechanisms.

## Decision

The AULOS branch uses the official rc.8 release merge `141eb6fef83422698aef7a981029e843e8161534` as its base. AULOS product behavior remains an additive layer: the Chat and Code preset surfaces, Project Center file tree, conversation-first layout, compact session metrics, and embedded trajectory stay in their existing client packages. Runtime Inspector remains an opt-in development example and export.

AULOS branding occupies the upstream `sidebar.brand.mark`, `sidebar.brand.name`, and `conversation.hero.brand.mark` slots from `@deepseek-ai/dsh-client-ui-brand-aulos`. The `aulos` client build profile selects those occupants and the browser title. Favicon and PWA artwork remain deployment-owned public assets because those surfaces have no runtime slot. Generic upstream UI components and the official brand package contain no AULOS branch.

The rc.8 file and session reference packages, persistent Windows PowerShell stack, DeepSeek multimodal pipeline, provider retry policy, SQLite persistence implementation, and experimental Agent Teams packages are accepted without AULOS replacements. Agent Teams receives no AULOS home entry or product role. Provider request retry remains distinct from any model-output parsing or validation recovery supplied by a preset or model adapter.

The broad repository-wide rename and direct upstream brand edits are not replayed. Upstream package names, runtime prompt identities, architecture documentation, and source ownership stay upstream-readable; AULOS-specific names live in its build profile, brand occupant package, deployment assets, and product documentation. GitHub CI and release workflows remain absent from the AULOS repository, matching its existing publication boundary.

This decision extends [Build-time public environment variables for client business code](2026-08-18-client-build-environment.md); it does not replace that environment-exposure policy.

## Alternatives considered

**Replay the complete rc.5 AULOS commit series.** This would preserve broad repository naming changes and direct edits to upstream brand surfaces, recreating the largest conflict area despite rc.8 providing dedicated build-time slots.

**Merge the rc.8 release into the existing AULOS history.** This would make mechanical conflict resolution obscure which upstream implementations replaced local patches and would leave the customization boundary difficult to audit.

**Drop AULOS presentation and preset behavior in favor of the official client.** The upstream client does not provide the current AULOS workspace, Chat/Code, Project Center, or trajectory experience, so this would be a product regression rather than a maintenance simplification.

## Consequences

Future upstream updates can replace generic UI and runtime packages without reapplying AULOS logo or name edits across them. AULOS must keep the slot declarations and its occupant package compatible, and it must build through the `aulos` profile to obtain the expected title and artwork. A local or official profile intentionally receives its own branding behavior.

AULOS still owns substantive conversation, workspace, and trajectory presentation changes, so those packages remain the main merge surface. Upstream references, multimodal request handling, Windows shell composition, persistence, and provider retry behavior can advance independently unless AULOS later proves a product requirement that their extension points cannot express.

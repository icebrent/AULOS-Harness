# Agent Note: AULOS customization layer on the rc.2 foundation

Status: implemented

English | [中文](2026-08-22-aulos-rc2-customization-layer.zh.md)

Supersedes the historical [rc.8 customization record](../../archived/architecture/2026-08-21-aulos-rc8-customization-layer.md).

## Problem

AULOS used the official `dsh@0.1.0-rc.8` release as its foundation and kept its product presentation in focused client packages. The `dsh@0.1.1-rc.2` release changes the same conversation, workspace, host boot, credential, attachment, persistence, and sandbox areas. A mechanical merge could either discard AULOS product behavior or retain local replacements for mechanisms that upstream now owns.

## Decision

AULOS uses official release merge `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e` (`dsh@0.1.1-rc.2`) as its foundation. Runtime, host, LLM, authorization and OAuth, credential records, unified image and Files request handling, DeepSeek vision models, session projection and persistence, sandbox hardening, security fixes, build fixes, and the structured `webserver/index-inject` mechanism come directly from upstream.

The AULOS layer remains additive. `ui-agent-preset` projects Chat to `workspace-chat`, Code to `standard`, and every other preset through More. `ui-conversation`, `ui-workspace`, `ui-layout`, `ui-theme`, `ui-tool`, `ui-trajectory`, and `ui-primitives` retain the conversation-first three-column product, compact Context Card, session metrics, folded activity, embedded and full trajectory, and light visual system. `ui-files` remains the Workspace Files tree because the upstream Files API manages model/provider image files rather than browsing the active workspace. `ui-brand-aulos` continues to occupy `sidebar.brand.mark`, `sidebar.brand.name`, and `conversation.hero.brand.mark`; AULOS, local, and official builds continue to select their occupants through build profiles.

Conversation integration keeps the upstream terminal turn error after same-turn retry exhaustion, composer range/reference behavior, multiline question composer, session projection changes, and subagent lineage slot. The AULOS header adds Files and trajectory utilities around those contracts without restoring generic view tabs or a Tool details panel. Workspace integration keeps the upstream one-time blank-session pinning rule while retaining AULOS rows, metrics, tree, and manual ordering behavior. Theme boot contributes through the upstream structured index-injection table instead of retaining the former HTML-transform hook.

The directory-picker listing extension remains AULOS-owned because `ui-files` needs bounded directory and file heads from both native and browse backends. It extends the existing upstream directory-picker seam and does not replace the Files API, attachment storage, or filesystem capability. Runtime Inspector remains an opt-in example and `tool-cordis` export. GitHub Actions, GitLab CI, release publishing, and Pages workflows remain outside the AULOS repository.

No new AULOS runtime replacement or agent-loop customization is introduced. The rc.2-specific customization is limited to integration in the existing client product packages, the directory-listing extension used by `ui-files`, build-profile occupants/assets, and publication-boundary metadata.

## Alternatives considered

**Merge rc.2 into the rc.8 AULOS history.** Rejected because the release would not be the auditable foundation and conflict resolution would obscure which implementation owns each behavior.

**Keep the rc.8 conversation, boot, image, credential, or persistence implementations wholesale.** Rejected because it would discard rc.2 fixes or duplicate upstream capabilities.

**Adopt the official client selector and layout wholesale.** Rejected because Chat/Code/More, Workspace Files, Context Card, folded activity, trajectory placement, session metrics, and AULOS branding are product behavior rather than runtime replacements.

## Consequences

Future upgrades compare the upstream release tree with this concentrated additive layer. The main semantic conflict areas remain the listed client product packages and Web tests; core runtime, host boot, authorization, image handling, persistence, and sandbox code should stay upstream-native unless a documented extension gap appears. The AULOS-specific packages follow the foundation version so workspace constraints and built artifacts describe one release family.

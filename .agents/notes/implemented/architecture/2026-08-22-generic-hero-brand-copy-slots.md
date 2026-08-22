# Agent Note: Generic Hero brand-copy slots

Status: implemented

English | [中文](2026-08-22-generic-hero-brand-copy-slots.zh.md)

## Problem

The blank-session Hero can receive a deployment-specific mark, but its primary copy is bound directly to the conversation locale and it has no optional secondary-copy position. A branded build must not replace the whole Hero or patch generic locale values merely to supply product presentation.

## Decision

`ui-conversation` declares the root-scoped single slots `conversation.hero.title` and `conversation.hero.subtitle` beside `conversation.hero.brand.mark`. The shell owns their DOM positions and typography, passes its presentation class to each occupant, and keeps the localized `hero.headline` value as the title fallback. An unoccupied subtitle produces no visual line.

Deployment branding packages register only copy occupants. The shell retains the independent localized Preview badge and its product-lifecycle behavior.

## Alternatives considered

**Override the conversation locale.** Rejected because one deployment's brand copy would become a generic product default and remain a recurring foundation conflict.

**Replace the complete Hero from the branding package.** Rejected because the branding package would then own layout, responsive behavior, workspace composition, and Preview placement rather than only its copy.

**Use one combined copy slot.** Rejected because title fallback and optional-subtitle absence are independent behaviors, and a combined occupant would need to rebuild their structure.

## Consequences

Brand packages can change Hero copy without forking generic presentation, while unbranded builds preserve the localized title and empty subtitle. Occupants must forward the shell-supplied class so typography remains consistent; changes to Hero structure, fallback, and Preview continue to belong to `ui-conversation`.

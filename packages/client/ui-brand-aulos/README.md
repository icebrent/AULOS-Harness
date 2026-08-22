# @deepseek-ai/dsh-client-ui-brand-aulos

English | [中文](README.zh.md)

This package fills `sidebar.brand.mark`, `sidebar.brand.name`, `conversation.hero.brand.mark`, `conversation.hero.title`, and `conversation.hero.subtitle` when `DSH_CLIENT_BUILD_PROFILE` is `aulos`. The Hero copy occupants render `Orchestrate Intelligence.` and `The Power of AI, Harnessed.` while the generic conversation shell retains their structure and typography. AULOS artwork and copy stay outside the generic Sidebar, Hero, and primitives packages, so upstream presentation components remain replaceable without carrying brand-specific branches.

The five occupants install as one declaration-aware registration set through nested `slots.inject()` calls. The browser title is selected by the same AULOS build profile; the favicon and PWA identity remain deployment-owned public assets under `apps/web/public`.

## Model Experience

None, as the package contributes browser presentation occupants; it registers nothing model-facing.

#### KV Cache effect

None; the package neither assembles nor sends provider requests.

## Known Limitations and Deferred Work

- The profile supplies one fixed AULOS occupant set; runtime rebranding requires a separate validated configuration design.

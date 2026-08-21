# Runtime Inspector

English | [中文](README.zh.md)

This development-only Web overlay registers one read-only `inspect_runtime` Tool globally so the same implementation can compare Agents composed from different presets. It reads `ctx.tools.schemas(agent)` for the Agent-scoped capability catalog and the post-waterfall result of `ctx.systemPrompt.assemble({ scope: agent, agent })` for the exact Tool schemas and prompt sections passed to the agent loop.

Run it from the repository root:

```sh
pnpm dsh --profile web --patch examples/runtime-inspect/cordis.yml
```

Create a new Session for each preset under test and ask the Agent to call `inspect_runtime`. `include_prompt_text` defaults to false; enable it only when the complete interpolated section text is needed.

The report classifies an effective Tool definition as `global` only when scoped and global lookup return the same definition. Every other effective definition is `scoped-chain` because the current Tool registry does not retain enough provenance to distinguish an agent-local registration from a preset ancestor or name the registering Plugin. System-prompt `order` is the zero-based final assembly position; `PromptAssembly` does not retain each registration's numeric order after sorting and the assembly waterfall.

Omitting the overlay removes the Tool. It does not modify presets, registry configuration, Sessions, workspace files, or plugin state.

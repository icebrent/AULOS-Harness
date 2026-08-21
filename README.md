# AULOS Harness

English | [中文](README.zh.md)

**Orchestrate Intelligence.**

*The Power of AI, Harnessed.*

AULOS Harness is a custom AI Workspace built on DeepSeek Harness.

It keeps Harness's agent/runtime capabilities while redesigning the product presentation, organizing conversation, code, tools, and project context around the current task into a quieter, conversation-first personal AI workspace.

## What's different

- **Chat / Code working modes**: The primary ways of working converge on Chat and Code, with advanced presets kept under More.
- **Conversation-first workspace**: A restrained, macOS-style interface makes the conversation and the current task the main content, reducing the developer-tool visual noise of the original.
- **Session list at a glance**: Every session shows its Tokens, Cache hit, and Context usage right in the list, so ongoing work stays readable without opening each session.
- **Compact Context Card**: Context, Tokens, Cache, and TTFT for the current session stay visible in a compact card at the top of the conversation.
- **Workspace Files tree**: The right column is a file tree of the current workspace, for browsing project files without leaving the conversation.
- **Embedded Trajectory**: An expandable execution timeline under the chat shows what the AI did step by step while you read the conversation; the full Trajectory view remains available for a more complete look.
- **Collapsed tool activity**: Intermediate tool calls and agent work are collapsed by default, so final answers and user messages stay visually dominant.
- **AULOS brand and product direction**: An independent visual identity and Workspace product direction built on the Harness runtime.

## Status

AULOS Harness is a personally maintained custom build, still under active development.

It follows the DeepSeek Harness upstream when appropriate, while keeping its own product, interaction, and visual direction.

## Run

AULOS is currently distributed from this repository rather than as a separate npm package.

### Run from source

```sh
pnpm install
pnpm run build
pnpm dsh web
```

The Web UI listens on `http://127.0.0.1:3080` by default. The default build selects the AULOS client profile; `pnpm run build:official` remains available for an official-brand comparison build.

## Upstream

AULOS Harness is built on [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

The current customization layer is based on the official `dsh@0.1.0-rc.8` release. AULOS product features live in focused packages and build-time branding slots rather than a repository-wide upstream rename.

For the original Harness's installation, usage, architecture, and development documentation, refer directly to the official repository.

## License

This project continues to follow the upstream [MIT License](LICENSE).

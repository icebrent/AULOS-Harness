# AULOS Harness

[English](README.md) | 中文

**Orchestrate Intelligence.**

*The Power of AI, Harnessed.*

AULOS Harness 是一个基于 DeepSeek Harness 构建的自定义 AI Workspace。

它保留 Harness 的 agent/runtime 能力，同时重新设计了产品呈现方式，让对话、代码、工具和项目上下文围绕当前任务组织起来，形成一个更安静、更偏 conversation-first 的个人 AI 工作空间。

## 有什么不同

- **Chat / Code 工作模式**：将主要使用方式收敛为 Chat 与 Code，高级 preset 保留在 More 中。
- **Conversation-first 工作区**：采用更克制、偏 macOS 风格的界面，让对话和当前任务成为主内容，减少原版偏开发者工具的视觉噪音。
- **会话列表直接展示用量**：每个 Session 的 Tokens / Cache / Context 直接显示在列表中，无需逐个打开就能掌握进行中的工作。
- **紧凑的 Context Card**：当前会话的 Context / Tokens / Cache / TTFT 等信息固定在对话顶部的紧凑卡片中。
- **右侧 Files 文件树**：右栏是当前 Workspace 的文件树，无需离开对话即可浏览项目文件。
- **可展开的 Embedded Trajectory**：聊天下方是可展开的执行时间线，可以边看对话边查看 AI 的执行过程；Full Trajectory 完整视图仍然保留，供更深入的查看。
- **工具活动折叠**：中间工具调用和 agent 工作过程默认折叠，最终回答和用户消息保持视觉主导。
- **AULOS 品牌与产品方向**：在 Harness runtime 基础上建立独立的视觉身份和 Workspace 产品方向。

## 项目状态

AULOS Harness 是一个个人维护的 custom build，目前仍在持续开发。

项目会在合适的时候跟进 DeepSeek Harness upstream，但会保留自己的产品、交互和视觉方向。

## 运行

AULOS 目前从本仓库源码分发，不提供单独的 npm 包。

### 从源码运行

```sh
pnpm install
pnpm run build
pnpm dsh web
```

Web UI 默认监听 `http://127.0.0.1:3080`。默认构建选择 AULOS client profile；如需与官方品牌构建比较，仍可使用 `pnpm run build:official`。

## 上游项目

AULOS Harness 基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)。

当前自定义层基于官方 `dsh@0.1.0-rc.8` release。AULOS 产品能力位于聚焦的 packages 与构建期 branding slots 中，而非全仓 upstream rename。

原版 Harness 的安装、使用、架构、开发说明等详细资料，请直接参考官方仓库。

## License

本项目继续遵循 upstream 的 [MIT License](LICENSE)。

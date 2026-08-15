# Agent Note: Chat / Code dual-mode new-session UI

Status: implemented

[English](2026-08-14-chat-code-dual-mode-new-session-ui.md) | 中文

## Problem

新会话界面以一份扁平的 agent preset 列表打头（Standard、Code Mode、Minimal、Creator，外加用户自建项），把整套名册摆在一个真实选择只有两种工作模式的用户面前：对话式、感知工作区的 agent（`workspace-chat`）与完整编码 agent（`standard`）。会话标题栏同样直呼 preset 名，把内部 preset id 暴露给按模式思考的用户。

## Decision

Web 客户端现在把名册投影为两个主模式加一个兜底：

- **Chat** 暂存 `workspace-chat` preset。其卡片文案强调讨论、分析与理解当前工作区。
- **Code** 暂存 `standard` preset。其卡片文案强调修改、运行与调试。
- **More** 是一个菜单，承载其余全部 preset（Code Mode、Minimal、Creator、用户自建项），因此没有任何已发布能力消失。

映射位于 `packages/client/ui-agent-preset/src/client/modes.ts`，是两个 preset-id 常量，是纯名册投影：某模式对应的 preset id 在部署中缺席时该模式不渲染，所有非主 preset 仍可经 More 触达。既有 seat-store 的暂存／应用机制原样复用——一次选择会暂存并落在工作区流程产出的空白会话上，与旧 chip 完全一致。

Hero 布局在工作区选择器下方增加模式行（`heroPickerRows` 包住选择器行 + 模式行，两者读作一个选择组）。会话标题栏标签现在为两个主 preset 显示模式名（Chat / Code），其余回退为 preset 自身的显示名——绝不显示原始 preset id。

没有改动任何后端、agent-loop、session、workspace、permission、persistence、trajectory、tool 或 LLM 代码。权限系统与工作区选择器未动；Creator/Minimal 等仍可经 More 选择，其文件保持不变。映射常量刻意镜像部署的 preset id（`workspace-chat`、`standard`），而不是重新定义 preset 语义。

## Verification

包级组件 spec 用手工构建的 store 驱动选择器（模式卡片映射到各自的 preset id、More 只列出非主 preset、暂存的高级名出现在 More 触发器上、标题栏标签解析 Chat/Code/高级名）。web e2e 通道启动随发布的 roster 加一个 fixture `workspace-chat` preset，经真实 host RPC 断言 Chat → `workspace-chat`、More → `minimal`、Code → `standard`，并核对跟随已装组合的 slash 目录。Header/hero golden 相应刷新。

## Alternatives considered

**保留扁平 chip，只改条目名。** 否决：验收标准要求两个清晰的主入口；在一个菜单里重命名行仍然把整套名册摆在前面。

**把映射做成 settings/Config 字段。** v1 否决：浏览器插件半边没有 Config 通道，两个带优雅名册投影回退的 UI 级常量已覆盖原型的部署。

**在 Chat 模式隐藏轨迹／工具 chrome。** 暂缓：`workspace-chat` 组合没有 terminal/git/diff 工具，面向编码的 renderer 对它们从不挂载；按模式过滤 chrome 留待后续迭代。

## Consequences

经 Chat/Code 创建的会话与之前完全一样地暂存其 preset；`standard`/`workspace-chat` 会话的标题栏标签现在读作 Code/Chat。没有映射 preset 的部署只显示存在的卡片，其余保留在 More 中——什么都不丢。每个挂载发布 roster 的通道的 golden 都变了（会话标题栏中 `Standard mode` → `Code`）。

## Related

[AI workspace presentation layer (v2)](2026-08-14-ai-workspace-presentation-layer-v2.md) 取代本 Note 的 hero/选择器展示，同时保留其 Chat / Code preset 映射。

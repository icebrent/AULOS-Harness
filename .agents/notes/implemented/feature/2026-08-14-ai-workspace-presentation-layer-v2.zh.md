# Agent Note: AI workspace presentation layer (v2)

Status: implemented

[English](2026-08-14-ai-workspace-presentation-layer-v2.md) | 中文

取代 v1 展示（[2026-08-14-chat-code-dual-mode-new-session-ui.md](2026-08-14-chat-code-dual-mode-new-session-ui.md)），同时完整保留其 Chat / Code preset 映射。被 [v3 信息架构](2026-08-15-web-workspace-information-architecture-v3.md) 部分取代：Inspector 变成了 Files 列，上下文数字移入紧凑 Context Card，轨迹入口变为底部面板加标题栏工具按钮。浅色视觉系统、三栏框架、工具活动折叠与安静的标题栏仍以本 Note 为权威。

## Problem

v1 原型读起来仍是「原版 Harness 加两张 Chat/Code 卡片」：面向开发者的三栏默认布局、并排的 Chat | Trajectory 标签、占满 transcript 的原始工具行，以及 composer 下方的单行统计条。产品目标是平静的 macOS 工作区界面：对话是主要内容，运行时数据在右侧 Inspector 里，轨迹成为 Activity 入口之后的观测层。

## Decision

- **浅色 macOS 视觉系统。** 浅色别名色板改为暖白页面打底、白色内容面配发丝分隔线与克制的阴影；新增产品 token（`--dsw-alias-page-bg/surface/surface-raised/surface-tint/border-soft/border-faint/shadow-soft/shadow-float/radius-md/radius-lg`）加入两套 scheme。默认主题偏好改为 `light`（OS 偏好不再覆盖）。
- **三栏产品布局。** 既有 AppFrame 三栏重新造型；右栏对活跃会话默认打开（layout store 默认值）、跨会话切换保持，并承载 Files 树（[v3 Note](2026-08-15-web-workspace-information-architecture-v3.md)）。
- **右侧 Inspector（Context | Activity）。** 已被 v3 Note 取代。details 槽承载 Files 树；Context 标签的数字成为 transcript 上方的紧凑 Context Card（同一批投影与展示折算），Activity 标签被移除（其数字与恢复的统计条及轨迹面重叠），内嵌的工具调用详情随席位一并删除。composer 的统计条在 v3 中恢复，用于轮次／步骤计数与墙钟时间。模型行仍然刻意缺席——模型目录是 service，不是投影。
- **工具活动折叠。** 聊天流划分为普通行与逐轮次活动折叠：工具调用与中间 assistant 步骤折进一行安静的 `✓ Completed · N tools`（可展开），轮次运行中显示紧凑的实时块，错误行从不折叠。用户消息、收尾 assistant 报告、命令、审批、提问与 turn tail 保持普通行。
- **轨迹层级。** Chat | Trajectory 标签环移除。完整轨迹从会话标题栏工具按钮打开（[v3 Note](2026-08-15-web-workspace-information-architecture-v3.md)——Activity 面板已删除，底部轨迹面板渲染在聊天下方），配有细窄返回条；Input/Model/Tools 时间线与完整记录表原样保留。
- **安静的会话标题栏 + 分段模式选择器。** 标题栏去掉标签与运行时统计；新会话模式选择器成为 macOS 分段控件（Chat | Code | More），沿用同一 preset 映射。

## Verification

受影响的客户端套件（ui-conversation、ui-agent-preset、ui-layout、ui-trajectory、ui-theme）与完整 `test:gui` 通过（272 files / 3764 tests）。`pnpm run build`（host + client tsc/tsdown + web dist）通过。对已服务 v2 bundle 的真实 Chrome 探测显示分段式 hero 且无页面错误。

## Alternatives considered

**新建 ui-inspector 包。** 本轮否决：Inspector 需要聊天 store（`setView`、selection）与 details 槽，它们都在 ui-conversation；新包需要一个跨包的视图切换通道。details 列作为薄路径留在 ui-conversation。

**第二套统计管线。** 否决：每个 Context 数字都读既有投影，Activity 列表读节点 read model；没有任何东西从原始事件重新计算。

## Consequences

v2 的 web e2e golden 经浏览器通道重新生成（`DSH_SNAPSHOT=refresh pnpm run test:web`），驱动已删除 Chat | Trajectory 标签环的 e2e 流程现在经底部面板与标题栏工具按钮打开轨迹（[v3 Note](2026-08-15-web-workspace-information-architecture-v3.md)）。活动折叠的首版实现匹配了错误的 Conversation Node kind（`tool`/`assistant` 而非注册的 `tool-call`/`assistant-step`），直到同一次改动修正前始终不渲染。此处记录的窄视口轨迹缺口已由 v3 的标题栏工具按钮关闭，任何宽度都能进入完整轨迹。v2 行为由客户端套件覆盖。

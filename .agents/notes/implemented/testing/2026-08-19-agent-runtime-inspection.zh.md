# Agent Note: Agent runtime inspection

Status: implemented

[English](2026-08-19-agent-runtime-inspection.md) | 中文

## Problem

生成的工具目录回答哪些插件能够提供哪些工具，而不回答某个 live agent 能解析哪些工具，也不回答其下一次模型请求会收到哪些 schema。Agent preset、scoped restriction 与 shadowing，以及 per-agent 工具 presentation 会让这些集合彼此不同。读取 preset YAML 不能证明运行时可见性，而加载现有的 Cordis authoring 工具集会给只读诊断 agent 增加修改能力。

## Decision

独立的 `@deepseek-ai/dsh-tool-cordis/runtime-inspect` 入口会在 global 工具层注册一个只读 `inspect_runtime` 工具。可选的 `examples/runtime-inspect` overlay 只加载该子路径，因此无需编辑 preset 或加载本包的动态 Cordis authoring 工具，同一个定义就能检查由不同 preset 组装的新 agent。不加载该 overlay 就会完全移除这项诊断。

报告把 `ctx.tools.schemas(agent)` 读取为 scoped capability catalog，把 `ctx.systemPrompt.assemble({ scope: agent, agent })` 在 waterfall（瀑布式事件）之后的结果读取为模型实际获得的目录。这保留了 [per-agent 工具 presentation](../feature/2026-08-05-per-agent-tool-presentation.zh.md) 所约定的区别：Code Mode 可以保留许多 scoped capability，同时仅以原生方式呈现 `run_code`。报告会对比两个名称集合，描述最终提示词 section，记录 live 与从 Session 推导的 preset identity，并检查一组固定的 mutation、execution、delegation、terminal、workflow、Ralph 与 Git 相关工具名称。

诊断只把 provenance 报告为 `global` 或 `scoped-chain`。当 global 与 scoped lookup 解析到同一个工具定义时，它可以证明 `global`。`ToolRuntime` 不保留注册插件 identity，也不暴露单独的 ancestor layer，因此诊断不会虚构插件或 preset source。`PromptAssembly` 同样只保留最终 section 顺序，而不保留各项注册时的数值 order；报告中的 `order` 是 assembly 后从零开始的有效位置。

## Alternatives considered

**加载自指 Cordis 工具集。** 否决：其 inspection 与动态 package 的 define、execute、stop 和 remove 工具绑定。这种能力扩张不符合只读 Chat Agent，并且仍不暴露 waterfall 后的模型工具列表。

**解析 preset YAML。** 否决：配置项不能证明 activation、scope inheritance、restriction、shadowing、presentation collapse 或 live agent 实际绑定的 preset。

**给 Harness Core 增加工具 provenance 与提示词 registration order。** 否决：当前诊断需要准确名称与最终请求内容，而现有公共运行时 API 已能提供。Core provenance 会成为更大的 API 与存储决策，且当前没有生产消费方。

## Consequences

开发者可以通过同一个只读工具对比 preset runtime，并用全新 Session 复现证据。加载 overlay 时，inspector 本身会出现在 scoped 与 presented 两种目录中。

该工具仅供开发使用且需要显式启用，不是 shipped preset capability。其单元覆盖会经过真实工具执行流水线，并通过 scoped assembly waterfall 隐藏一个已注册 capability，从而证明两个目录来自不同的运行时观察。

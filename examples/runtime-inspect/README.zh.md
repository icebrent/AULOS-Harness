# 运行时检查器

[English](README.md) | 中文

这个仅供开发使用的 Web overlay 会全局注册一个只读 `inspect_runtime` 工具，使同一实现可以对比由不同 preset 组装的 agent。它通过 `ctx.tools.schemas(agent)` 读取 agent scoped capability catalog，并通过 `ctx.systemPrompt.assemble({ scope: agent, agent })` 在 waterfall（瀑布式事件）之后的结果读取 agent loop（智能体循环）实际收到的工具 schema 与系统提示词 section。

在仓库根目录运行：

```sh
pnpm dsh --profile web --patch examples/runtime-inspect/cordis.yml
```

为每个待测 preset 创建一个全新 Session，并让 agent 调用 `inspect_runtime`。`include_prompt_text` 默认为 false；只有确实需要完整的插值后 section 文本时才启用。

仅当 scoped 与 global lookup 返回同一个定义时，报告才会把有效工具定义归类为 `global`。其他有效定义统一归类为 `scoped-chain`，因为当前工具注册表没有保留足以区分 agent-local registration、preset ancestor 或注册插件名称的 provenance。系统提示词的 `order` 是最终 assembly 中从零开始的位置；`PromptAssembly` 在排序和 assembly waterfall 之后不保留每项注册时的数值 order。

不加载该 overlay 就不会出现此工具。它不会修改 preset、注册表配置、Session、workspace 文件或插件状态。

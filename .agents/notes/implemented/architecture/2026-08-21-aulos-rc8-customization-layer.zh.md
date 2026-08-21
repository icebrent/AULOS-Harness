# Agent Note：rc.8 基础上的 AULOS 自定义层

Status: implemented

[English](2026-08-21-aulos-rc8-customization-layer.md) | 中文

## Problem

AULOS 原先基于 `dsh@0.1.0-rc.5` 源码树，产品呈现、工作区导航和品牌改动与 upstream 代码直接混在一起。`dsh@0.1.0-rc.8` 新增了通用 branding slots、文件与会话引用、Windows persistent PowerShell composition、原生图片输入、provider retry policy、SQLite persistence 优化以及实验性 Agent Teams。逐个重放所有 AULOS commit 会继续保留大范围命名改动，并重复实现 upstream 已提供的机制。

## Decision

AULOS branch 以官方 rc.8 release merge `141eb6fef83422698aef7a981029e843e8161534` 为底座。AULOS 产品行为继续作为增量层存在：Chat/Code preset 界面、Project Center 文件树、conversation-first 布局、紧凑的 session metrics 和 embedded trajectory 保留在现有 client packages 中。Runtime Inspector 继续作为可选开发 example 与 export。

AULOS branding 由 `@deepseek-ai/dsh-client-ui-brand-aulos` 占用 upstream 的 `sidebar.brand.mark`、`sidebar.brand.name` 和 `conversation.hero.brand.mark` slots。`aulos` client build profile 选择这些 occupants 和浏览器标题。favicon 与 PWA artwork 仍是 deployment-owned public assets，因为这些表面没有 runtime slot。通用 upstream UI components 与官方 brand package 不包含 AULOS 分支。

rc.8 的文件与会话引用 packages、Windows persistent PowerShell stack、DeepSeek multimodal pipeline、provider retry policy、SQLite persistence implementation 和实验性 Agent Teams packages 均直接采用，不添加 AULOS 替代实现。Agent Teams 不获得 AULOS 首页入口或产品角色。Provider request retry 与 preset 或 model adapter 可能提供的模型输出 parsing/validation recovery 保持为不同层。

不重放全仓大范围 rename 与直接修改 upstream brand 的改动。Upstream package names、runtime prompt identities、architecture documentation 和源码归属保持可识别；AULOS 专属名称只存在于 build profile、brand occupant package、deployment assets 和产品文档中。AULOS repository 继续不包含 GitHub CI 与 release workflows，以保持既有发布边界。

本决策扩展 [Client 业务代码使用构建期公开环境变量](2026-08-18-client-build-environment.md)，不替代其中的环境变量暴露策略。

## Alternatives considered

**完整重放 rc.5 AULOS commit 序列。** 这会保留仓库级命名修改和对 upstream 品牌界面的直接编辑；即使 rc.8 已提供专用构建时 slot，最大的冲突面仍会被重新建立。

**把 rc.8 release merge 到现有 AULOS 历史。** 大量机械冲突处理会掩盖哪些 upstream 实现已取代本地 patch，也会继续让自定义边界难以审计。

**放弃 AULOS 展示与 preset 行为并使用官方客户端。** upstream 客户端不提供当前 AULOS workspace、Chat/Code、Project Center 或 trajectory 体验，因此这会造成产品回退，而不是维护简化。

## Consequences

后续 upstream 升级可以替换通用 UI 与 runtime packages，而无需再次在其中应用 AULOS logo 或名称改动。AULOS 必须保持 slot declarations 与 occupant package 兼容，并通过 `aulos` profile 构建才能得到预期标题和 artwork。local 或 official profile 会有意采用各自的 branding 行为。

AULOS 仍然拥有实质性的 conversation、workspace 和 trajectory 呈现改动，因此这些 packages 继续是主要 merge surface。Upstream references、multimodal request handling、Windows shell composition、persistence 和 provider retry behavior 可以独立演进，除非 AULOS 后续证明其 extension points 无法表达某项产品需求。

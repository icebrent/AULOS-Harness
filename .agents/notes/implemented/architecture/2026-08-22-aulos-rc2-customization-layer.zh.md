# Agent Note：rc.2 基础上的 AULOS 自定义层

Status: implemented

[English](2026-08-22-aulos-rc2-customization-layer.md) | 中文

本 Note 取代历史性的 [rc.8 自定义记录](../../archived/architecture/2026-08-21-aulos-rc8-customization-layer.md)。

## 问题

AULOS 以官方 `dsh@0.1.0-rc.8` release 为基础，并将产品呈现保留在聚焦的 client packages 中。`dsh@0.1.1-rc.2` 又修改了 conversation、workspace、host boot、credentials、attachments、persistence 与 sandbox 等相同区域。机械 merge 可能删除 AULOS 产品行为，也可能保留 upstream 已接管机制的本地替代实现。

## 决策

AULOS 以官方 release merge `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`（`dsh@0.1.1-rc.2`）为 foundation。Runtime、host、LLM、authorization 与 OAuth、credential records、统一 image/Files request 处理、DeepSeek vision models、session projection 与 persistence、sandbox hardening、安全修复、build 修复以及结构化 `webserver/index-inject` 机制均直接采用 upstream。

AULOS layer 继续保持增量性质。`ui-agent-preset` 将 Chat 映射到 `workspace-chat`、Code 映射到 `standard`，并将其他所有 preset 放入 More。`ui-conversation`、`ui-workspace`、`ui-layout`、`ui-theme`、`ui-tool`、`ui-trajectory` 与 `ui-primitives` 保留 conversation-first 三栏产品、紧凑 Context Card、session metrics、折叠 activity、embedded/full trajectory 和浅色视觉系统。`ui-files` 继续作为 Workspace Files tree，因为 upstream Files API 管理 model/provider image files，而不是浏览活跃 workspace。`ui-brand-aulos` 继续占用 `sidebar.brand.mark`、`sidebar.brand.name` 与 `conversation.hero.brand.mark`；AULOS、local 与 official builds 继续通过 build profiles 选择 occupants。

Conversation 集成保留 upstream 在同一 turn 重试耗尽后的 terminal error、composer range/reference 行为、multiline question composer、session projection 变化与 subagent lineage slot。AULOS header 在这些约定周围增加 Files 与 trajectory utilities，不恢复通用 view tabs 或 Tool details panel。Workspace 集成保留 upstream 对 blank session 的一次性置顶规则，同时保留 AULOS rows、metrics、tree 与 manual ordering 行为。Theme boot 改为通过 upstream 的结构化 index-injection table 贡献内容，不保留旧 HTML-transform hook。

Directory-picker listing extension 继续由 AULOS 拥有，因为 `ui-files` 需要 native 与 browse backends 都返回有界的 directory/file heads。它扩展既有 upstream directory-picker seam，不替代 Files API、attachment storage 或 filesystem capability。Runtime Inspector 继续作为可选 example 与 `tool-cordis` export。GitHub Actions、GitLab CI、release publishing 与 Pages workflows 继续不进入 AULOS repository。

本次没有新增 AULOS runtime replacement 或 agent-loop customization。rc.2 专属自定义仅限既有 client product packages 中的集成、`ui-files` 使用的 directory-listing extension、build-profile occupants/assets 与 publication-boundary metadata。

## 考虑过的替代方案

**把 rc.2 merge 进 rc.8 AULOS 历史。** 拒绝：release 不再是可审计的 foundation，冲突处理也会掩盖每项行为的归属。

**整体保留 rc.8 的 conversation、boot、image、credential 或 persistence 实现。** 拒绝：这会丢失 rc.2 修复或重复 upstream capability。

**整体采用官方 client selector 与 layout。** 拒绝：Chat/Code/More、Workspace Files、Context Card、折叠 activity、trajectory placement、session metrics 与 AULOS branding 是产品行为，而非 runtime replacement。

## 后果

后续升级应比较 upstream release tree 与这层集中的 additive layer。主要语义冲突区仍是上述 client product packages 与 Web tests；core runtime、host boot、authorization、image handling、persistence 与 sandbox code 应保持 upstream 原生，除非出现有文档记录的 extension gap。AULOS 专属 packages 跟随 foundation version，使 workspace constraints 与 built artifacts 描述同一 release family。

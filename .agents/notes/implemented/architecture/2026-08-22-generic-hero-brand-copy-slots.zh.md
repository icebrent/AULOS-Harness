# Agent Note: 通用 Hero 品牌文案 slots

Status: implemented

[English](2026-08-22-generic-hero-brand-copy-slots.md) | 中文

## 问题

空白会话 Hero 可以接收 deployment 专属标记，但主文案直接绑定 conversation locale，也没有可选的次级文案位置。品牌 build 不应为了提供产品呈现而替换整个 Hero 或 patch 通用 locale 值。

## 决策

`ui-conversation` 在 `conversation.hero.brand.mark` 旁声明根作用域 single slots `conversation.hero.title` 与 `conversation.hero.subtitle`。Shell 持有它们的 DOM 位置和 typography，把展示 class 传给每个 occupant，并保留本地化 `hero.headline` 作为 title fallback。subtitle 未被占用时不会产生可见行。

Deployment branding packages 只注册文案 occupants。Shell 继续持有独立的本地化 Preview badge 及其产品生命周期行为。

## 考虑过的替代方案

**覆盖 conversation locale。** 拒绝：某个 deployment 的品牌文案会变成通用产品默认值，并在 foundation 升级时持续产生冲突。

**由 branding package 替换完整 Hero。** 拒绝：branding package 将不再只持有文案，而会接管布局、responsive behavior、Workspace composition 与 Preview placement。

**使用一个组合文案 slot。** 拒绝：title fallback 与可选 subtitle 的缺席是独立行为，组合 occupant 必须重建二者结构。

## 后果

Brand packages 可以在不 fork 通用 presentation 的情况下更换 Hero 文案；无品牌 build 则保留本地化标题与空 subtitle。Occupants 必须转交 shell 提供的 class，以保持 typography 一致；Hero 结构、fallback 与 Preview 的修改继续归 `ui-conversation` 所有。

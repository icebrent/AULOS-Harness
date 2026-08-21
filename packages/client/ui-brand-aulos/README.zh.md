# @deepseek-ai/dsh-client-ui-brand-aulos

[English](README.md) | 中文

当 `DSH_CLIENT_BUILD_PROFILE` 为 `aulos` 时，本包填充 `sidebar.brand.mark`、`sidebar.brand.name` 与 `conversation.hero.brand.mark`。AULOS 图稿不进入通用 Sidebar、Hero 和 primitives 包，因此跟随 upstream 更换展示组件时无需继续携带品牌专用分支。

三个 occupant 通过嵌套 `slots.inject()` 作为同一组可感知声明的注册一起安装。浏览器标题由同一个 AULOS build profile 选择；favicon 与 PWA identity 仍由 `apps/web/public` 下的 deployment public assets 持有。

## 模型体验

无，因为本包只提供浏览器展示 occupant；它不会注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送 provider request。

## 已知限制与后续工作

- 该 profile 提供一套固定的 AULOS occupant；运行时换牌需要单独设计并验证配置机制。

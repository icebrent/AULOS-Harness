# @deepseek-ai/dsh-client-ui-files

[English](README.md) | 中文

Files 面板插件：右栏的项目文件树，数据全部来自宿主的目录列表 seam。它在 [ui-layout](../ui-layout/README.md) 声明的 `details` 槽注册一个条目，并把 `ctx.workspaces.listDirectory` 与 layout 的关闭动作绑定为面板的注入回调。文件树是纯展示：每一行都来自 seam 的单层 `DirectoryListing`（`entries` 目录 + `files` 文件），这里不重新推导路径、不递归扫描层级。

展开是懒加载的——目录只在首次展开时才列出，请求可中止，且会取代同一层级仍在途的请求。切换工作区会改变当前会话的 `cwd`；面板随之重新加载根目录、中止所有在途层级并重置展开与选中状态。根层级渲染本地化的加载中 / 空目录 / 错误状态；失败的列表提供重试，被截断的层级显示"更多条目"标记，隐藏行与其他行一样渲染。文件单击选中、双击经 `ctx.workspaces.openPath` 用宿主默认应用打开；面板的关闭按钮调用 `ctx.layout.closeDetails`。

`/client` 导出只有插件主体（`apply`/`inject`）与契约类型；FilesPanel 与树的派生逻辑保持在槽注册之后的包内部。

## Model Experience

无——文件树只渲染宿主的目录列表，任何内容都不会进入模型请求。

#### KV Cache 影响

无；本包不组装也不发送 provider 请求。

## Known Limitations and Deferred Work

- **不显示 git 修改状态**——列表 seam 不报告 VCS 状态；要支持它需要宿主侧的 git status 调用，推迟到文件树真正需要时再做。
- **没有面板内预览 / 编辑器**——双击把路径交给宿主默认应用打开；预览面属于未来的 editor seam。
- **刷新会重置整棵树**——已加载的子层级会被丢弃，重新展开时再次加载；按层级刷新推迟实现。

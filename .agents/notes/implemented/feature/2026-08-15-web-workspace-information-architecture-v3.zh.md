# Agent Note: Web Workspace information architecture (v3)

Status: implemented

[English](2026-08-15-web-workspace-information-architecture-v3.md) | 中文

部分取代 [v2 presentation layer](2026-08-14-ai-workspace-presentation-layer-v2.md)：三栏布局、浅色视觉系统、工具活动折叠与安静的会话标题栏原样保留；右侧 Inspector 与经 Activity 进入轨迹的方式被下述决策替换。

## Problem

v2 的右侧 Inspector 把三件互不相关的事捆在一起——实时上下文数字、活动流、所选工具调用的详情——而它携带的 Context 数据恰恰在用户阅读对话的位置才最有价值，而不是在侧栏。轨迹藏在 Activity 面板的一键之后，边聊天边观察 agent 就必须离开对话。侧边栏的 Session 行没有任何资源信号，也没有任何界面能浏览 agent 正在改动的工作区文件。产品目标是一块平静的工作区界面：上下文在 transcript 旁边，文件在右栏，轨迹就在聊天下方可见。

## Decision

- **transcript 上方的紧凑 Context Card。** `ContextCard` 渲染在会话标题栏与滚动区之间，靠左对齐（fit-content，绝不铺满宽度），任何投影值都不存在时自动隐藏。它的四个分组——占用圆环／百分比、计费输入／输出 token、缓存命中与读／写、TTFT 平均与解码吞吐——全部复用统计条既有的展示折算（`contextOccupancy`、`billedInputTokens`、`cacheHitPercent`、`formatDuration`），数据来自 `contextPressure`／`tokenUsage`／`sessionStats`；绝不从会话事件重新计算。composer 下方的环境统计条恢复轮次／步骤计数与墙钟时间，于是两个界面分摊了 Inspector 原来独占的数字。
- **右栏是 Files 树。** 新建 `client/ui-files` 插件把 `FilesPanel` 注册进框架的 `details` 槽（ui-conversation 的 InspectorPanel、DetailsPanel 与 `conversation.details.tool` 席位删除；ui-tool 的 `ToolDetails` 一并移除）。树以当前会话的 cwd 为根，切换工作区时重载（中止在途层级），首次展开时才懒加载，并提供加载中／空／错误状态、重试与截断标记；文件单击选中、双击经 `workspaces.openPath` 打开。列举复用既有宿主 seam：`host.listDirectory` 的 `DirectoryListing` 在目录头部旁增加 `files`／`filesTruncated`（同一个有界的按名排序窗口，指向文件的符号链接经探测后并入），因此选择器保持历史形态，文件树不引入 shell 或递归扫描。git 修改状态暂缓——该 seam 不报告 VCS 状态。
- **Session 行携带投影元数据。** 侧边栏第二行从列表发布的 `projectionValues` 折算计费 token、缓存命中率与上下文占用率（细进度条，`sessionRowMetrics`）——与对话界面读取同一批投影，侧边栏从不解析会话日志。没有投影值的行保持历史单行高度。
- **底部 Trajectory 面板。** `TrajectoryBody` 从视图标签抽出，两个界面逐字共享（同一个 inject face：翻页、实际时长偏好、全部 renderer 状态）。完整标签（`conversation.view`，id `trajectory`）保留为详细的 debug／audit 界面，从标题栏工具按钮打开、经既有返回条回来。底部面板注册进会话主体的 `'conversation.session.bottom'` 单席位：默认是一根收起条，展开为 160–560px 的面板，顶部手柄拖动调高；它 sticky 停靠在 composer seat 正上方（读取 `--dsh-composer-height`），聊天与记录表因此同时可见，composer 保持自己的底边。聊天工具行的 inspect 会展开面板并经共享 owner share 把目标调用交给面板；会话主体在完整标签活跃时卸载面板，记录表绝不渲染两次。
- **移除 Inspector。** Activity 标签的步骤／轮次／LLM／工具数字与恢复的统计条和轨迹面重叠，故移除；Context 标签的数字迁往 Context Card；工具详情视图删除——聊天行选中仅高亮，完整的参数／结果检查在轨迹中完成。

## Alternatives considered

**由会话壳在 composer 下方渲染底部区域（目标草图的原义）。** 否决：壳条目是 `session-maybe` 作用域，而活跃视图与 inspect 状态位于会话作用域的聊天 store，slot core 拒绝一个 store handle 挂在两种作用域下（`one handle, one scope`）。框架也没有任何路径把某会话的 store 实例暴露给 `session-maybe` 条目，因此该区域要么引入镜像状态源，要么新增框架扩展。已经与视图环共享该 handle 的会话主体改为渲染并门控该区域，sticky 停靠在 composer 上方。

**由壳做 CSS `:has` 门控。** 否决：它只隐藏面板而不卸载，完整标签活跃时第二个轨迹 body 仍挂载着。

**直接经 `ctx.fs.listDir` 列举工作区文件。** 否决：filesystem 服务在 agent 平面（preset 之后），宿主 RPC 边界够不到；扩展现有 browse 列举只保留一个 seam、一个上限、一个策略面。

**保留 Inspector 并加一个 Files 标签。** 否决：产品目标禁止双占位侧栏；上下文属于 transcript 旁边，活动折叠进轨迹。

## Consequences

右栏不再回答「上下文正在做什么」——Context Card 与统计条在对话旁回答；该栏回答「工作区里有哪些文件」。工具调用的参数／结果检查失去了专属面板，改由轨迹面承担；未来的预览／编辑器面会是新 seam。底部面板的展开／高度状态是组件本地的，切换会话时重置。v2 记录的窄视口无法进入轨迹的缺口已关闭：标题栏工具按钮在任何宽度都能打开完整标签。`formatCompactTokens` 与 `IconFileOutline16` 作为共享原子进入 ui-primitives（三个消费方）。客户端测试套件覆盖每个界面——ContextCard、FilesPanel（懒加载／错误／刷新／切换）、会话元数据折算与行渲染、面板 chrome（展开／收起／拖拽钳制／inspect 自动展开）与共享 body 的注册——组装后的 Web snapshot 经真实客户端组合固定新布局。

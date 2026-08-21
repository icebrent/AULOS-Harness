/** `trajectory` namespace dictionaries (view tab label + toolbar strings). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'trajectory'

/** The trajectory dictionary key set (the source of truth for both locales). */
export type TrajectoryKey =
  | 'view.trajectory'
  | 'panel.expand'
  | 'panel.collapse'
  | 'panel.resize'
  | 'panel.region'
  | 'toolbar.aria'
  | 'toolbar.duration'
  | 'toolbar.useActualDuration'
  | 'toolbar.useEqualWidth'
  | 'toolbar.actualTime'
  | 'toolbar.turns'
  | 'toolbar.expandTurns'
  | 'toolbar.collapseTurns'
  | 'toolbar.calls'
  | 'toolbar.expandCalls'
  | 'toolbar.collapseCalls'
  | 'toolbar.search'
  | 'toolbar.searchPlaceholder'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The trajectory view tab label and toolbar strings. */
    'trajectory': TrajectoryKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<TrajectoryKey, string> = {
  'view.trajectory': '轨迹',
  'panel.expand': '展开轨迹面板',
  'panel.collapse': '收起轨迹面板',
  'panel.resize': '调整轨迹面板高度',
  'panel.region': '底部轨迹面板',
  'toolbar.aria': '轨迹工具栏',
  'toolbar.duration': 'Duration',
  'toolbar.useActualDuration': 'Use actual duration',
  'toolbar.useEqualWidth': 'Use equal-width operations',
  'toolbar.actualTime': '实际时间',
  'toolbar.turns': 'Turns',
  'toolbar.expandTurns': 'Expand turns',
  'toolbar.collapseTurns': 'Collapse turns',
  'toolbar.calls': 'Calls',
  'toolbar.expandCalls': 'Expand calls',
  'toolbar.collapseCalls': 'Collapse calls',
  'toolbar.search': '搜索轨迹',
  'toolbar.searchPlaceholder': '搜索',
}

/** English dictionary. */
export const en: Record<TrajectoryKey, string> = {
  'view.trajectory': 'Trajectory',
  'panel.expand': 'Expand trajectory panel',
  'panel.collapse': 'Collapse trajectory panel',
  'panel.resize': 'Resize trajectory panel',
  'panel.region': 'Bottom trajectory panel',
  'toolbar.aria': 'Trajectory toolbar',
  'toolbar.duration': 'Duration',
  'toolbar.useActualDuration': 'Use actual duration',
  'toolbar.useEqualWidth': 'Use equal-width operations',
  'toolbar.actualTime': 'Actual time',
  'toolbar.turns': 'Turns',
  'toolbar.expandTurns': 'Expand turns',
  'toolbar.collapseTurns': 'Collapse turns',
  'toolbar.calls': 'Calls',
  'toolbar.expandCalls': 'Expand calls',
  'toolbar.collapseCalls': 'Collapse calls',
  'toolbar.search': 'Search trajectory',
  'toolbar.searchPlaceholder': 'Search',
}

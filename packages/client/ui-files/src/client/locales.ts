/** `files` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'files'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'title': '文件',
  'close': '隐藏文件栏',
  'refresh': '刷新文件树',
  'loading': '载入中…',
  'empty': '空目录',
  'error': '无法读取目录',
  'retry': '重试',
  'truncated': '… 更多条目未显示',
  'openFile': '打开 {name}',
} satisfies Record<string, string>

/** The files namespace key union. */
export type FilesKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'title': 'Files',
  'close': 'Hide the Files panel',
  'refresh': 'Refresh file tree',
  'loading': 'Loading…',
  'empty': 'Empty directory',
  'error': 'Cannot read directory',
  'retry': 'Retry',
  'truncated': '… more entries not shown',
  'openFile': 'Open {name}',
} satisfies Record<FilesKey, string>

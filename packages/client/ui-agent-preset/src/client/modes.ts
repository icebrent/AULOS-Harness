/**
 * The two primary new-session modes and their preset mapping.
 *
 * The new-session screen offers Chat and Code as the primary entries; each is
 * one preset id in the roster. Every other preset (Code Mode, Minimal,
 * Creator, user-authored) stays reachable behind the More menu. The mapping is
 * a UI-level projection of the roster: a mode whose preset id is absent from
 * the deployment simply renders nothing, and the roster stays the single
 * source of what may be chosen.
 */

import type { AgentPresetSettingsKey } from './locales.ts'

/** The preset id the Chat mode stages: a read-only, workspace-aware conversation agent. */
export const CHAT_MODE_PRESET_ID = 'workspace-chat'

/** The preset id the Code mode stages: the full coding agent. */
export const CODE_MODE_PRESET_ID = 'standard'

/**
 * Whether a preset id is one of the two primary modes.
 * @param id - a roster preset id.
 * @returns true when the preset is surfaced as a primary mode card.
 */
export function isPrimaryModePreset(id: string): boolean {
  return id === CHAT_MODE_PRESET_ID || id === CODE_MODE_PRESET_ID
}

/**
 * The locale key naming a preset's primary-mode label, when it has one.
 * @param id - a roster preset id.
 * @returns the mode name key for Chat/Code presets, else undefined.
 */
export function modeNameKeyOf(id: string): AgentPresetSettingsKey | undefined {
  if (id === CHAT_MODE_PRESET_ID) return 'modeChatName'
  if (id === CODE_MODE_PRESET_ID) return 'modeCodeName'
  return undefined
}

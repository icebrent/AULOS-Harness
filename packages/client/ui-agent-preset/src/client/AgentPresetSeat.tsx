/**
 * The new-session mode selector, on the screen that starts a session (below
 * the workspace picker).
 *
 * It replaces the flat preset list with two primary entries — Chat and Code,
 * each naming the one preset it stages — plus a More menu that keeps every
 * other preset (Code Mode, Minimal, Creator, user-authored) reachable. The
 * mapping is a roster projection: a mode whose preset is absent from the
 * deployment renders nothing, and everything else still opens from More.
 *
 * Like the chip it replaces, the choice is only available before a
 * conversation starts: once a turn has run, the session's history was
 * produced under that preset's tools and the host refuses to swap them. A
 * control that spends most of its life disabled belongs on the screen where
 * it still works. Picking stages; the choice reaches a session when one
 * becomes current.
 */

import { useEffect, useState } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  IconAgentPresetOutline16, IconCheckOutline16, IconChevronDownOutline14, IconCodeOutline16,
  IconNewChatOutline16, Menu,
} from '@deepseek-ai/dsh-client-ui-primitives'
// Type-only: pulls the ui-conversation SlotMap merge (the hero seat).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { AgentPresetSeatState } from './seat-store.ts'
import { presetDisplayText } from './locales.ts'
import { CHAT_MODE_PRESET_ID, CODE_MODE_PRESET_ID, isPrimaryModePreset } from './modes.ts'
import css from './AgentPresetSeat.module.css'

/** Registration-side business face for the hero mode selector. */
export interface AgentPresetSeatInjected {
  hooks: {
    /** Seat snapshot bound by the renderer as useAgentPresetSeat. */
    agentPresetSeat: SnapshotStore<AgentPresetSeatState>
  }
  /** Read the roster when the selector first renders. */
  load: () => Promise<void>
  /** Stage one preset for the next session. */
  select: (id: string) => Promise<void>
  /** Clear the one-shot introduce cue once the selector has played it. */
  introduced: () => void
}

/* Introduce timeline: the icon eases in first (the CSS animation shares this
   duration); the name's characters start fading up the moment it lands, each
   taking the fade duration to settle. The cue clears after the last one. The
   stagger is capped twice: per tick for short CJK names, and by one shared
   reveal window so a long Latin name finishes in the same time as its CJK
   counterpart instead of dragging the run out per character. */
const INTRO_TEXT_DELAY_MS = 150
const INTRO_CHAR_STAGGER_MS = 40
const INTRO_TEXT_REVEAL_MS = 200
const INTRO_CHAR_FADE_MS = 400

/**
 * Per-character start offset for the introduce reveal.
 * @param count - character count of the shown preset name.
 * @returns milliseconds between successive character starts.
 */
function introStaggerMs(count: number): number {
  if (count <= 1) return 0
  return Math.min(INTRO_CHAR_STAGGER_MS, INTRO_TEXT_REVEAL_MS / (count - 1))
}

/** Full component props. */
export type AgentPresetSeatProps =
  PropsRuntime<'conversation.hero.agentPreset'>
  & PropsLocale<'settings.agentPreset'>
  & InjectFace<AgentPresetSeatInjected>

/**
 * Render the new-session Chat / Code / More mode selector.
 * @param props - composed slot props.
 * @returns the selector, or null when the deployment composes no presets.
 */
export function AgentPresetSeat({ load, select, introduced, useAgentPresetSeat, t }: AgentPresetSeatProps) {
  const state = useAgentPresetSeat(snapshot => snapshot)
  const [moreOpen, setMoreOpen] = useState(false)
  const [introducing, setIntroducing] = useState(false)

  useEffect(() => {
    void load()
  }, [load])

  const chat = state.options.find(option => option.id === CHAT_MODE_PRESET_ID)
  const code = state.options.find(option => option.id === CODE_MODE_PRESET_ID)
  const advanced = state.options.filter(option => !isPrimaryModePreset(option.id))
  const stagedAdvanced = advanced.some(option => option.id === state.current)

  const ready = state.options.length > 0 && state.current !== ''
  // The introduce cue only has something to announce when the staged pick is
  // an advanced preset: a Chat/Code pick is already visible as a selected
  // card, and the creator-draft entry stages advanced presets.
  const cueArmed = state.introduce && stagedAdvanced

  // The More trigger names the staged advanced preset once one is picked, so
  // the staged choice stays legible after the menu closes.
  const stagedOption = stagedAdvanced ? advanced.find(option => option.id === state.current) : undefined
  const moreLabel = stagedOption === undefined
    ? t('modeMore')
    : presetDisplayText(stagedOption, t).name

  // One wrapper span: the trigger is a flex row with a gap, so loose
  // character spans would each pick up the gap between them.
  useEffect(() => {
    if (!cueArmed) {
      // A staged Chat/Code pick (or no pick at all) needs no announcement;
      // acknowledge the cue so it never fires later.
      if (state.introduce) introduced()
      return
    }
    const characters = Array.from(moreLabel)
    if (characters.length === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      introduced()
      return
    }
    setIntroducing(true)
    const done = window.setTimeout(() => {
      setIntroducing(false)
      introduced()
    }, INTRO_TEXT_DELAY_MS + (characters.length - 1) * introStaggerMs(characters.length) + INTRO_CHAR_FADE_MS)
    return () => { window.clearTimeout(done) }
  }, [cueArmed, state.introduce, moreLabel, introduced])

  // Nothing to choose between: the deployment composes no presets and every
  // session shares the host composition.
  if (!ready) return null

  const characters = Array.from(moreLabel)
  const stagger = introStaggerMs(characters.length)
  const shownMoreLabel = introducing
    ? (
      <span className={css.introText}>
        {characters.map((character, index) => (
          <span
            key={index}
            className={css.introChar}
            style={{ animationDelay: `${INTRO_TEXT_DELAY_MS + index * stagger}ms` }}
          >
            {character}
          </span>
        ))}
      </span>
    )
    : moreLabel

  const pick = (id: string): void => {
    setMoreOpen(false)
    void select(id)
  }
  const cardProps = (id: string, selected: boolean, description: string | undefined) => ({
    type: 'button' as const,
    className: selected ? `${css.card} ${css.cardSelected}` : css.card,
    'aria-pressed': selected,
    title: state.error ?? description,
    disabled: state.busy,
    onClick: () => { pick(id) },
  })

  return (
    <div className={css.modes} role="group" aria-label={t('seatHint')}>
      {chat !== undefined && (
        <button {...cardProps(chat.id, state.current === chat.id, presetDisplayText(chat, t).description)}>
          <IconNewChatOutline16 className={css.cardIcon} />
          <span className={css.cardName}>{t('modeChatName')}</span>
          {state.current === chat.id && <IconCheckOutline16 className={css.cardCheck} />}
        </button>
      )}
      {code !== undefined && (
        <button {...cardProps(code.id, state.current === code.id, presetDisplayText(code, t).description)}>
          <IconCodeOutline16 className={css.cardIcon} />
          <span className={css.cardName}>{t('modeCodeName')}</span>
          {state.current === code.id && <IconCheckOutline16 className={css.cardCheck} />}
        </button>
      )}
      {advanced.length > 0 && (
        <Menu
          open={moreOpen}
          onClose={() => { setMoreOpen(false) }}
          items={advanced.map((option) => {
            const text = presetDisplayText(option, t)
            return {
              id: option.id,
              // Name and description together: the id alone never says what a
              // preset does, which is why the roster carries display copy.
              label: (
                <span className={css.item}>
                  <span className={css.itemName}>{text.name}</span>
                  <span className={css.itemDesc}>{text.description ?? t('noDescription')}</span>
                </span>
              ),
            }
          })}
          selectedId={stagedAdvanced ? state.current : undefined}
          onSelect={pick}
          align="start"
          portal
          anchor={(
            <button
              type="button"
              className={stagedAdvanced ? `${css.more} ${css.moreStaged}` : css.more}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              title={state.error ?? t('modeMoreHint')}
              disabled={state.busy}
              onClick={() => { setMoreOpen(value => !value) }}
            >
              <IconAgentPresetOutline16 className={css.moreIcon} />
              {shownMoreLabel}
              <IconChevronDownOutline14 className={css.chevron} />
            </button>
          )}
        />
      )}
    </div>
  )
}

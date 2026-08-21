/**
 * Opt-in, read-only inspection of one calling Agent's effective runtime.
 * @module @deepseek-ai/dsh-tool-cordis/runtime-inspect
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { resolveSessionPreset } from '@deepseek-ai/dsh-agent-presets'
import type { ToolSchema } from '@deepseek-ai/dsh-llm'
import type { JsonValue } from '@deepseek-ai/dsh-session'
import { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import type { PromptAssembly } from '@deepseek-ai/dsh-system-prompt'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'runtime-inspect'
export const inject = ['tools', 'systemPrompt']

const UNEXPECTED_TOOL_NAMES = [
  'bash', 'pwsh', 'write', 'edit', 'run_code', 'terminal', 'terminal_open', 'terminal_send',
  'subagent', 'subagent_fork', 'workflow', 'ralph',
] as const

type PresentationMode = 'native' | 'code' | 'both'

/** Return the first sentence or bounded leading fragment of one Tool description. */
function summarizeDescription(description: string): string {
  const normalized = description.replace(/\s+/g, ' ').trim()
  const sentence = normalized.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? normalized
  return sentence.length <= 160 ? sentence : `${sentence.slice(0, 157)}...`
}

/** Read the declared top-level parameter names from a model-facing JSON Schema. */
function parameterNames(schema: ToolSchema): string[] {
  const properties = schema.parameters['properties']
  if (properties === null || typeof properties !== 'object' || Array.isArray(properties)) return []
  return Object.keys(properties).sort()
}

/** Infer the effective Tool presentation from the capability and wire catalogs. */
function presentationMode(scoped: readonly string[], presented: readonly string[]): PresentationMode {
  if (!scoped.includes('run_code')) return 'native'
  return presented.some(tool => tool !== 'run_code') ? 'both' : 'code'
}

/** Render one final section after variable interpolation, without exposing sibling text. */
function renderSection(assembly: PromptAssembly, index: number): string {
  const section = assembly.sections[index]
  if (section === undefined) return ''
  return renderPrompt({ ...assembly, sections: [section] })
}

/**
 * Collect the same scoped Tool schemas and post-waterfall assembly the agent loop reads.
 * @param ctx - live Harness context containing the registries.
 * @param agent - calling Agent whose scope and Session identify the runtime.
 * @param includePromptText - whether interpolated section text is included.
 * @returns lossless JSON diagnostic data without changing runtime state.
 */
export async function inspectRuntime(
  ctx: Context,
  agent: Agent,
  includePromptText = false,
): Promise<JsonValue> {
  const scopedSchemas = ctx.tools.schemas(agent)
  const assembly = await ctx.systemPrompt.assemble({ scope: agent, agent })
  const scopedNames = scopedSchemas.map(schema => schema.name)
  const presentedNames = assembly.tools.map(schema => schema.name)
  const scopedNameSet = new Set(scopedNames)
  const presentedNameSet = new Set(presentedNames)
  const mode = presentationMode(scopedNames, presentedNames)
  const livePreset = ctx.get('agentPresets')?.composedPreset(agent.ctx)
  const recordedPreset = resolveSessionPreset(agent.session)

  const agentScopedTools = scopedSchemas.map((schema) => {
    const effective = ctx.tools.get(schema.name, agent)
    const global = ctx.tools.get(schema.name)
    return {
      name: schema.name,
      description: summarizeDescription(schema.description),
      parameterNames: parameterNames(schema),
      registrationLayer: effective !== undefined && effective === global ? 'global' : 'scoped-chain',
      registrationSource: null,
    }
  })

  const modelPresentation = [...new Set([...scopedNames, ...presentedNames])]
    .sort()
    .map(name => ({
      name,
      presented: presentedNameSet.has(name),
      native: presentedNameSet.has(name) && name !== 'run_code',
      codeModeSdk: scopedNameSet.has(name) && name !== 'run_code' && mode !== 'native',
      reservedTransport: name === 'run_code',
      hidden: scopedNameSet.has(name) && !presentedNameSet.has(name),
    }))

  const unexpectedTools = Object.fromEntries(UNEXPECTED_TOOL_NAMES.map(tool => [tool, {
    scoped: scopedNameSet.has(tool),
    presented: presentedNameSet.has(tool),
  }]))
  const gitTools = [...new Set([...scopedNames, ...presentedNames])]
    .filter(tool => /(^|_)git($|_)/i.test(tool))
    .sort()

  const systemPromptSections = assembly.sections.map((section, order) => {
    const text = renderSection(assembly, order)
    return {
      name: section.name,
      order,
      textLength: text.length,
      presented: text.length > 0,
      ...includePromptText ? { text } : {},
    }
  })

  return {
    runtimeIdentity: {
      sessionId: String(agent.session.id),
      agentId: String(agent.id),
      presetId: livePreset ?? recordedPreset ?? null,
      livePresetId: livePreset ?? null,
      recordedPresetId: recordedPreset ?? null,
      presetMatchesRecordedSession: livePreset === undefined || recordedPreset === undefined
        ? null
        : livePreset === recordedPreset,
      cwd: agent.session.header.cwd ?? null,
      model: agent.options.model ?? null,
      provider: agent.options.provider ?? null,
      toolPresentationMode: mode,
    },
    catalogSemantics: {
      scopedTools: 'ctx.tools.schemas(agent)',
      presentedTools: 'post-waterfall ctx.systemPrompt.assemble({ scope: agent, agent }).tools',
      sectionOrder: 'zero-based effective order in the final assembly; registration-time numeric order is not retained by PromptAssembly',
      registrationSource: 'unavailable: ToolRuntime retains definitions by scope layer but no plugin provenance',
    },
    agentScopedTools,
    modelPresentedTools: assembly.tools.map(schema => ({
      name: schema.name,
      description: summarizeDescription(schema.description),
      parameterNames: parameterNames(schema),
      native: schema.name !== 'run_code',
      codeModeSdk: scopedNameSet.has(schema.name) && schema.name !== 'run_code' && mode !== 'native',
      reservedTransport: schema.name === 'run_code',
    })),
    presentation: modelPresentation,
    comparison: {
      scopedTools: scopedNames,
      presentedTools: presentedNames,
      scopedOnly: scopedNames.filter(name => !presentedNameSet.has(name)),
      presentedOnly: presentedNames.filter(name => !scopedNameSet.has(name)),
      intersection: scopedNames.filter(name => presentedNameSet.has(name)),
    },
    systemPromptSections,
    unexpectedTools: {
      ...unexpectedTools,
      git: {
        scoped: gitTools.some(name => scopedNameSet.has(name)),
        presented: gitTools.some(name => presentedNameSet.has(name)),
        names: gitTools,
      },
    },
  }
}

/** Register the opt-in read-only runtime inspection Tool. */
export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'inspect_runtime',
    description: 'Inspect this Agent\'s effective scoped Tools, model-presented Tools, system-prompt sections, runtime identity, and suspicious capabilities without changing runtime state.',
    parameters: {
      include_prompt_text: {
        type: 'boolean',
        description: 'Include fully interpolated section text. Defaults to false.',
      },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    isConcurrencySafe: () => true,
    execute(args, exec) {
      if (exec.agent === undefined) throw new Error('inspect_runtime requires an Agent-backed Session')
      return inspectRuntime(ctx, exec.agent, args.include_prompt_text ?? false)
    },
  }))
}

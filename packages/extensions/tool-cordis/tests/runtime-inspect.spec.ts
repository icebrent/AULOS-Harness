import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { CallId } from '@deepseek-ai/dsh-llm'
import { createScope } from '@deepseek-ai/dsh-scope'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import Tools, { defineTool } from '@deepseek-ai/dsh-tools'
import { describe, expect, it } from 'vitest'
import { apply, inspectRuntime } from '../src/runtime-inspect.ts'

interface InspectionView {
  comparison: {
    scopedTools: string[]
    presentedTools: string[]
    scopedOnly: string[]
    presentedOnly: string[]
    intersection: string[]
  }
  agentScopedTools: Array<{ name: string; registrationLayer: string }>
  systemPromptSections: Array<{ name: string; order: number; textLength: number; presented: boolean; text?: string }>
  runtimeIdentity: Record<string, unknown>
  modelPresentedTools: Array<{ name: string }>
  unexpectedTools: Record<string, unknown>
}

const echo = (name: string) => defineTool({
  name,
  description: `${name} description. Additional detail is omitted from the summary.`,
  parameters: { value: { type: 'string', required: true } },
  output: {
    schema: { type: 'string' },
    render: (_args, value) => [{ type: 'text', text: value }],
  },
  isConcurrencySafe: () => true,
  execute: async args => args.value,
})

async function harness(): Promise<{ ctx: Context; agent: Agent }> {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt, { persona: 'Runtime persona.' })
  await ctx.plugin(Tools, { mode: 'native' })
  apply(ctx)
  ctx.tools.register(echo('global_echo'))
  const session = Session.create(SessionId('runtime-inspect-session'))
  const agent = {
    id: session.id,
    options: { provider: 'mock-provider', model: 'mock-model' },
    session,
  } as unknown as Agent
  let scope!: ReturnType<typeof createScope>
  await ctx.plugin(Object.assign(
    (inner: Context) => { scope = createScope(inner, agent) },
    { inject: ['tools', 'systemPrompt'] },
  ))
  scope.ctx.tools.register(echo('scoped_echo'))
  scope.ctx.systemPrompt.section({ name: 'scoped:proof', order: 20, text: 'Scoped proof.' })
  Object.assign(agent, {
    ctx: scope.ctx,
  })
  return { ctx, agent }
}

describe('runtime inspector', () => {
  it('distinguishes scoped capabilities from the post-waterfall model catalog', async () => {
    const { ctx, agent } = await harness()
    agent.ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
      const delegated = await next()
      return { ...delegated, tools: delegated.tools.filter(tool => tool.name !== 'scoped_echo') }
    })

    const inspected = await inspectRuntime(ctx, agent) as unknown as InspectionView
    expect(inspected.comparison).toEqual({
      scopedTools: ['inspect_runtime', 'global_echo', 'scoped_echo'],
      presentedTools: ['global_echo', 'inspect_runtime'],
      scopedOnly: ['scoped_echo'],
      presentedOnly: [],
      intersection: ['inspect_runtime', 'global_echo'],
    })
    expect(inspected.agentScopedTools).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'inspect_runtime', registrationLayer: 'global' }),
      expect.objectContaining({ name: 'scoped_echo', registrationLayer: 'scoped-chain' }),
    ]))
    expect(inspected.systemPromptSections).toEqual([
      expect.objectContaining({ name: 'harness:identity', order: 0, presented: true }),
      expect.objectContaining({ name: 'deployment:persona', order: 1, textLength: 16 }),
      expect.objectContaining({ name: 'scoped:proof', order: 2, presented: true }),
    ])
    expect(inspected.runtimeIdentity).toEqual(expect.objectContaining({
      sessionId: 'runtime-inspect-session',
      agentId: 'runtime-inspect-session',
      provider: 'mock-provider',
      model: 'mock-model',
      toolPresentationMode: 'native',
    }))
    expect(inspected.unexpectedTools['bash']).toEqual({ scoped: false, presented: false })
  })

  it('executes through the real Tool pipeline and includes prompt text only on request', async () => {
    const { ctx, agent } = await harness()
    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('inspect-call'),
      name: 'inspect_runtime',
      arguments: { include_prompt_text: true },
      agent,
    })
    expect(result.isError).toBe(false)
    if (result.isError) return
    const value = result.value as unknown as InspectionView
    expect(value.systemPromptSections[0]?.text).toBe('You are an AI agent powered by DeepSeek Harness.')
    expect(value.modelPresentedTools.map(tool => tool.name))
      .toEqual(['global_echo', 'inspect_runtime', 'scoped_echo'])
  })
})

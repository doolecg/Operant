import { describe, expect, it } from 'vitest'
import type { ChatItem, SubagentItem, ToolItem } from './claude-chat'
import { agentCounts, agentSummaryText, agentTimer, commandProgram, elapsedText, planTurns, shellProgram } from './chat-summary'

const user = (id: string, at = 0): ChatItem => ({ kind: 'user', id, parent: null, text: 'hi', images: [], queued: false, at })
const text = (id: string): ChatItem => ({ kind: 'text', id, parent: null, md: 'ok', streaming: false })
const thinking = (id: string): ChatItem => ({ kind: 'thinking', id, parent: null, tokens: null, text: '', startedAt: 1000, endedAt: 2000 })
const tool = (id: string, over: Partial<ToolItem> = {}): ChatItem => ({
  kind: 'tool',
  id,
  parent: null,
  name: 'Read',
  input: {},
  partial: '',
  summary: '',
  status: 'done',
  result: null,
  diff: null,
  background: false,
  startedAt: 1000,
  endedAt: 2000,
  ...over,
})
const agent = (id: string, status: SubagentItem['status'], over: Partial<SubagentItem> = {}): ChatItem => ({
  kind: 'subagent',
  id,
  parent: null,
  description: 'Look',
  agentType: null,
  prompt: '',
  model: null,
  agentId: null,
  background: false,
  status,
  latest: '',
  toolUses: 0,
  outputTokens: 0,
  startedAt: 1000,
  endedAt: null,
  result: null,
  ...over,
})
const turn = (id: string, over: Partial<Extract<ChatItem, { kind: 'turn' }>> = {}): ChatItem => ({ kind: 'turn', id, durationMs: 263_000, ok: true, costUsd: null, at: 0, ...over })
const notice = (source: 'interrupt' | 'info'): ChatItem => ({ kind: 'notice', id: `n-${source}`, parent: null, source, tone: 'info', text: 'Interrupted', at: 0 })

describe('elapsedText', () => {
  it('writes whole seconds, minutes and hours', () => {
    expect(elapsedText(0)).toBe('0s')
    expect(elapsedText(46_900)).toBe('46s')
    expect(elapsedText(263_000)).toBe('4m 23s')
    expect(elapsedText(3_720_000)).toBe('1h 2m')
  })
  it('treats bad input as zero', () => {
    expect(elapsedText(-5)).toBe('0s')
    expect(elapsedText(NaN)).toBe('0s')
  })
})

describe('commandProgram', () => {
  it('takes the first program', () => {
    expect(commandProgram('npm test')).toBe('npm')
    expect(commandProgram('git log --oneline | head')).toBe('git')
  })
  it('skips setup, env assignments and wrappers', () => {
    expect(commandProgram('cd app && npm run build')).toBe('npm')
    expect(commandProgram('FOO=1 BAR=2 node x.js')).toBe('node')
    expect(commandProgram('sudo apt install x')).toBe('apt')
    expect(commandProgram('$env:CI = 1; npx vitest')).toBe('npx')
  })
  it('strips paths, quotes and extensions', () => {
    expect(commandProgram('"C:\\Program Files\\nodejs\\npm.cmd" test')).toBe('npm')
    expect(commandProgram('& .\\scripts\\build.ps1')).toBe('build')
    expect(commandProgram('/usr/bin/git status')).toBe('git')
  })
  it('falls back to the setup command when that is all there is', () => {
    expect(commandProgram('cd app')).toBe('cd')
  })
  it('returns null for an empty command', () => {
    expect(commandProgram('   ')).toBeNull()
  })
})

describe('shellProgram', () => {
  it('reads Bash and PowerShell calls only', () => {
    expect(shellProgram({ name: 'Bash', input: { command: 'git status' } })).toBe('git')
    expect(shellProgram({ name: 'PowerShell', input: { command: 'npm ci' } })).toBe('npm')
    expect(shellProgram({ name: 'Read', input: { command: 'git status' } })).toBeNull()
  })
  it('returns null while the input is still streaming', () => {
    expect(shellProgram({ name: 'Bash', input: {} })).toBeNull()
    expect(shellProgram({ name: 'Bash', input: null })).toBeNull()
  })
})

describe('agent counts', () => {
  it('counts each status', () => {
    expect(agentCounts(['running', 'running', 'done', 'failed', 'interrupted', 'waiting'])).toEqual({ running: 2, waiting: 1, finished: 1, failed: 1, stopped: 1, total: 6 })
  })
  it('summarises two or more agents', () => {
    expect(agentSummaryText(agentCounts(['running', 'running', 'done']))).toBe('2 running, 1 finished')
    expect(agentSummaryText(agentCounts(['done', 'failed']))).toBe('1 finished, 1 failed')
  })
  it('has no summary for one agent', () => {
    expect(agentSummaryText(agentCounts(['running']))).toBeNull()
    expect(agentSummaryText(agentCounts([]))).toBeNull()
  })
})

describe('agentTimer', () => {
  it('ticks while running and freezes when it ended', () => {
    expect(agentTimer({ startedAt: 1000, endedAt: null, status: 'running' }, 22_000)).toBe(21_000)
    expect(agentTimer({ startedAt: 1000, endedAt: 9000, status: 'done' }, 99_000)).toBe(8000)
  })
  it('is null when it has no end and is not running, or has no start', () => {
    expect(agentTimer({ startedAt: 1000, endedAt: null, status: 'interrupted' }, 5000)).toBeNull()
    expect(agentTimer({ startedAt: 0, endedAt: null, status: 'running' }, 5000)).toBeNull()
  })
})

describe('planTurns', () => {
  const kinds = (items: ChatItem[], live = false, startedAt?: number | null) => planTurns(items, { live, startedAt }).map((e) => (e.type === 'item' ? e.item.id : `${e.type}`))

  it('folds a finished turn after the owner message and keeps the text', () => {
    const items = [user('u'), thinking('th'), tool('t1'), text('a'), tool('t2'), text('b'), turn('end')]
    const plan = planTurns(items, { live: false })
    expect(plan.map((e) => (e.type === 'item' ? e.item.id : e.type))).toEqual(['u', 'fold', 'a', 'b', 'end'])
    const fold = plan[1]!
    expect(fold.type === 'fold' && fold.items.map((i) => i.id)).toEqual(['th', 't1', 't2'])
    expect(fold.type === 'fold' && fold.ms).toBe(263_000)
    expect(fold.type === 'fold' && fold.stopped).toBe(false)
  })

  it('does not fold a turn with no thinking or tool rows', () => {
    expect(kinds([user('u'), text('a'), turn('end')])).toEqual(['u', 'a', 'end'])
  })

  it('marks an interrupted turn as stopped', () => {
    const plan = planTurns([user('u'), tool('t', { status: 'interrupted' }), notice('interrupt'), turn('end', { ok: false })], { live: false })
    const fold = plan.find((e) => e.type === 'fold')
    expect(fold && fold.type === 'fold' && fold.stopped).toBe(true)
  })

  it('does not call a failed turn stopped when nothing was interrupted', () => {
    const plan = planTurns([user('u'), tool('t'), turn('end', { ok: false })], { live: false })
    const fold = plan.find((e) => e.type === 'fold')
    expect(fold && fold.type === 'fold' && fold.stopped).toBe(false)
  })

  it('counts failed tools in the fold', () => {
    const plan = planTurns([user('u'), tool('a', { status: 'failed' }), tool('b'), turn('end')], { live: false })
    const fold = plan.find((e) => e.type === 'fold')
    expect(fold && fold.type === 'fold' && fold.failed).toBe(1)
  })

  it('leaves a still-running tool and the agent rows outside the fold', () => {
    const items = [user('u'), tool('done'), tool('bg', { status: 'running', background: true }), agent('ag', 'done'), turn('end')]
    expect(kinds(items)).toEqual(['u', 'fold', 'bg', 'ag', 'end'])
  })

  it('keeps prompts outside the fold', () => {
    const q: ChatItem = { kind: 'question', id: 'q', requestId: 'r', toolUseId: 'x', parent: null, questions: [], answers: null, expired: false, at: 0 }
    expect(kinds([user('u'), tool('t'), q, turn('end')])).toEqual(['u', 'fold', 'q', 'end'])
  })

  it('gives the running turn a heading and leaves its rows open', () => {
    const items = [user('u', 500), tool('t1'), tool('t2', { status: 'running', endedAt: null })]
    const plan = planTurns(items, { live: true, startedAt: 700 })
    expect(plan.map((e) => (e.type === 'item' ? e.item.id : e.type))).toEqual(['u', 'working', 't1', 't2'])
    const head = plan[1]!
    expect(head.type === 'working' && head.startedAt).toBe(700)
  })

  it('reads the start of the running turn from its items when none is given', () => {
    const plan = planTurns([user('u', 500), tool('t1')], { live: true })
    const head = plan.find((e) => e.type === 'working')
    expect(head && head.type === 'working' && head.startedAt).toBe(500)
  })

  it('shows no heading before the turn has done anything or when not live', () => {
    expect(kinds([user('u'), text('a')], true)).toEqual(['u', 'a'])
    expect(kinds([user('u'), tool('t')], false)).toEqual(['u', 't'])
  })

  it('folds each finished turn on its own and heads the open one', () => {
    const items = [user('u1'), tool('a'), text('r1'), turn('e1', { durationMs: 46_000 }), user('u2'), tool('b'), tool('c', { status: 'running', endedAt: null })]
    const plan = planTurns(items, { live: true, startedAt: 9000 })
    expect(plan.map((e) => (e.type === 'item' ? e.item.id : e.type))).toEqual(['u1', 'fold', 'r1', 'e1', 'u2', 'working', 'b', 'c'])
    expect(plan[1]!.type === 'fold' && (plan[1] as { ms: number }).ms).toBe(46_000)
  })

  it('puts the agent summary above the first of two or more agents', () => {
    const items = [user('u'), agent('a1', 'running'), text('t'), agent('a2', 'done')]
    const plan = planTurns(items, { live: false })
    expect(plan.map((e) => (e.type === 'item' ? e.item.id : e.type))).toEqual(['u', 'agents', 'a1', 't', 'a2'])
    const sum = plan[1]!
    expect(sum.type === 'agents' && sum.text).toBe('1 running, 1 finished')
  })

  it('has no summary for a single agent', () => {
    expect(kinds([user('u'), agent('a1', 'running')])).toEqual(['u', 'a1'])
  })

  it('returns an empty plan for no items', () => {
    expect(planTurns([], { live: true })).toEqual([])
  })
})

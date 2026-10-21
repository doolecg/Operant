import { describe, expect, it } from 'vitest'
import type { ChatItem } from './claude-chat'
import { altEnterTarget, editRefusal, moveQueued, planSteer, queuePreview, runningSubagents, type SteerContext } from './chat-queue'

const ctx = (over: Partial<SteerContext> = {}): SteerContext => ({ process: 'ready', turnRunning: true, stopping: false, compacting: false, runningSubagents: 0, ...over })

describe('planSteer', () => {
  it('stops the current step when nothing else would be cut short', () => {
    expect(planSteer(ctx())).toEqual({ ok: true, how: 'now' })
  })

  it('sends like an ordinary message when no turn runs', () => {
    expect(planSteer(ctx({ turnRunning: false }))).toEqual({ ok: true, how: 'idle' })
  })

  it('joins at the next step instead of stopping one while sub-agents run', () => {
    expect(planSteer(ctx({ runningSubagents: 2 }))).toEqual({ ok: true, how: 'next' })
  })

  it('refuses when the process is not running, stopping or compacting', () => {
    for (const process of ['stopped', 'starting', 'crashed', 'blocked'] as const) expect(planSteer(ctx({ process }))).toMatchObject({ ok: false, reason: 'Claude Code is not running' })
    expect(planSteer(ctx({ stopping: true }))).toMatchObject({ ok: false, reason: 'Claude Code is stopping' })
    expect(planSteer(ctx({ compacting: true }))).toMatchObject({ ok: false, reason: expect.stringContaining('compacting') })
    expect(planSteer(ctx({ compacting: true, turnRunning: false }))).toMatchObject({ ok: false })
    expect(planSteer(ctx({ stopping: true, runningSubagents: 1 }))).toMatchObject({ ok: false })
  })
})

describe('runningSubagents', () => {
  it('counts running and waiting sub-agents only', () => {
    const agent = (id: string, status: string) => ({ kind: 'subagent', id, status }) as unknown as ChatItem
    const text = { kind: 'text', id: 't' } as unknown as ChatItem
    expect(runningSubagents([agent('a', 'running'), agent('b', 'waiting'), agent('c', 'done'), agent('d', 'interrupted'), text])).toBe(2)
  })
})

describe('moveQueued', () => {
  const q = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('moves one place up or down without changing the original', () => {
    expect(moveQueued(q, 'b', -1)?.map((x) => x.id)).toEqual(['b', 'a', 'c'])
    expect(moveQueued(q, 'b', 1)?.map((x) => x.id)).toEqual(['a', 'c', 'b'])
    expect(q.map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })

  it('returns null at the ends and for an unknown id', () => {
    expect(moveQueued(q, 'a', -1)).toBeNull()
    expect(moveQueued(q, 'c', 1)).toBeNull()
    expect(moveQueued(q, 'x', 1)).toBeNull()
  })
})

describe('queuePreview', () => {
  it('shows the first line with text', () => {
    expect(queuePreview('\n  fix the tests  \nthen push')).toBe('fix the tests')
    expect(queuePreview('one line')).toBe('one line')
    expect(queuePreview('  \n ')).toBe('')
  })
})

describe('editRefusal and altEnterTarget', () => {
  it('refuses an edit while the box holds text or an image', () => {
    expect(editRefusal({ text: '', images: 0 })).toBeNull()
    expect(editRefusal({ text: '  \n', images: 0 })).toBeNull()
    expect(editRefusal({ text: 'draft', images: 0 })).toEqual(expect.stringContaining('first'))
    expect(editRefusal({ text: '', images: 1 })).not.toBeNull()
  })

  it('Alt+Enter picks the first queued message from an empty box only', () => {
    const q = [{ id: 'a' }, { id: 'b' }]
    expect(altEnterTarget({ text: '', images: 0 }, q)).toBe('a')
    expect(altEnterTarget({ text: ' ', images: 0 }, q)).toBe('a')
    expect(altEnterTarget({ text: 'hi', images: 0 }, q)).toBeNull()
    expect(altEnterTarget({ text: '', images: 1 }, q)).toBeNull()
    expect(altEnterTarget({ text: '', images: 0 }, [])).toBeNull()
  })
})

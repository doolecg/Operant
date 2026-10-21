import { describe, expect, it } from 'vitest'
import { runningSubagentCount, tileStatusLabel } from './claude-mods'

describe('tileStatusLabel', () => {
  it('says waiting on subagents when one runs and the main session is done', () => {
    expect(tileStatusLabel('done', null, 1)).toEqual({ label: 'Waiting on subagents', tone: 'working' })
    expect(tileStatusLabel('idle', null, 2)?.label).toBe('Waiting on subagents')
    expect(tileStatusLabel('waiting', 'permission_prompt', 1)?.label).toBe('Waiting on subagents')
  })

  it('keeps Done when no sub-agent runs', () => {
    expect(tileStatusLabel('done', null, 0)).toEqual({ label: 'Done', tone: 'done' })
  })

  it('does not count failed, completed or stopped sub-agents as running', () => {
    const n = runningSubagentCount([{ status: 'failed' }, { status: 'completed' }, { status: 'stopped' }, { status: 'unknown' }])
    expect(n).toBe(0)
    expect(tileStatusLabel('done', null, n)?.label).toBe('Done')
    expect(runningSubagentCount([{ status: 'failed' }, { status: 'running' }])).toBe(1)
  })

  it('keeps Working while the main session works', () => {
    expect(tileStatusLabel('working', null, 3)).toEqual({ label: 'Working', tone: 'working' })
  })

  it('keeps the existing waiting and idle labels', () => {
    expect(tileStatusLabel('waiting', 'permission_prompt', 0)?.label).toBe('Needs you')
    expect(tileStatusLabel('waiting', null, 0)?.label).toBe('Waiting')
    expect(tileStatusLabel('idle', null, 0)?.label).toBe('Idle')
    expect(tileStatusLabel('unknown', null, 1)).toBeNull()
  })
})

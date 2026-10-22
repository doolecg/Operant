import { describe, expect, it } from 'vitest'
import { tileState, type ChatItem, type ChatState } from './claude-chat'

const base = { process: 'ready', turn: { phase: 'idle' } } as unknown as Pick<ChatState, 'process' | 'turn'>
const agent = (status: string) => ({ kind: 'subagent', id: 'a1', status }) as unknown as ChatItem

describe('tileState', () => {
  it('reads Idle with nothing running and Working while the turn runs', () => {
    expect(tileState(base)).toBe('Idle')
    expect(tileState({ ...base, turn: { phase: 'working' } } as never)).toBe('Working')
  })

  it('reads Working while a helper runs after the turn ended, and Idle once it is done', () => {
    expect(tileState({ ...base, items: [agent('running')] })).toBe('Working')
    expect(tileState({ ...base, items: [agent('done')] })).toBe('Idle')
  })

  it('still shows a crashed or stopped process as such', () => {
    expect(tileState({ ...base, process: 'crashed', items: [agent('running')] } as never)).toBe('Crashed')
  })
})

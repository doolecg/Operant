import { describe, expect, it } from 'vitest'
import type { ChatItem } from './claude-chat'
import { activeLine, historyLines } from './chat-history-lines'

const user = (id: string, text: string, parent: string | null = null): ChatItem => ({ kind: 'user', id, parent, text, images: [], queued: false, at: 0 })
const text = (id: string, md: string, parent: string | null = null): ChatItem => ({ kind: 'text', id, parent, md, streaming: false })

describe('historyLines', () => {
  it('is empty for an empty chat', () => {
    expect(historyLines([])).toEqual([])
  })

  it('has one line per owner message of the main chat, in order', () => {
    const lines = historyLines([user('u1', 'first'), text('t1', 'a'), user('u2', 'second'), user('sub', 'inside an agent', 'agent1'), text('t2', 'b', 'agent1')])
    expect(lines.map((l) => l.id)).toEqual(['u1', 'u2'])
  })

  it('titles a line with the first non-empty line of the message', () => {
    expect(historyLines([user('u1', '\n  Fix the header\nthen the footer')])[0]?.title).toBe('Fix the header')
  })

  it('previews the first answer text after the message, without markdown marks', () => {
    const [a, b] = historyLines([user('u1', 'q1'), text('t1', '## Done\nChanged `App.tsx`'), text('t2', 'later text'), user('u2', 'q2')])
    expect(a?.reply).toBe('Done Changed App.tsx')
    expect(b?.reply).toBe('')
  })

  it('shortens a long title with an ellipsis', () => {
    const title = historyLines([user('u1', 'x'.repeat(300))])[0]!.title
    expect(title.length).toBe(90)
    expect(title.endsWith('…')).toBe(true)
  })
})

describe('activeLine', () => {
  it('is the last message that has reached the threshold', () => {
    expect(activeLine([-900, -300, 40, 600], 80)).toBe(2)
  })

  it('is the first when every message is still below the threshold', () => {
    expect(activeLine([200, 800], 80)).toBe(0)
  })

  it('is the last when all are above it', () => {
    expect(activeLine([-500, -200], 80)).toBe(1)
  })
})

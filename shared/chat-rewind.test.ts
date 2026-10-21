import { describe, expect, it } from 'vitest'
import { findRewindPoint, promptUuidByText } from './chat-rewind'

const user = (uuid: string, content: unknown, extra: object = {}) => ({ type: 'user', uuid, message: { role: 'user', content }, ...extra })
const assistant = (uuid: string, content: unknown) => ({ type: 'assistant', uuid, message: { role: 'assistant', content } })

const transcript = [
  { type: 'file-history-snapshot', messageId: 'u1' },
  user('u1', 'first prompt'),
  assistant('a1', [{ type: 'text', text: 'ok' }]),
  user('u2', [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } }, { type: 'text', text: 'second prompt' }]),
  assistant('a2', [{ type: 'tool_use', id: 't1', name: 'Edit', input: {} }]),
  user('r1', [{ type: 'tool_result', tool_use_id: 't1', content: 'done' }]),
  assistant('a3', [{ type: 'text', text: 'edited' }]),
  user('u3', 'first prompt'),
]

describe('findRewindPoint', () => {
  it('keeps everything before the prompt, after the last assistant entry', () => {
    expect(findRewindPoint(transcript, 'u3')).toEqual({ keepUuid: 'a3', text: 'first prompt', images: [] })
  })

  it('returns the prompt text and images, and keeps up to the previous turn', () => {
    expect(findRewindPoint(transcript, 'u2')).toEqual({ keepUuid: 'a1', text: 'second prompt', images: [{ mediaType: 'image/png', base64: 'AAAA' }] })
  })

  it('has no entry to keep for the first prompt', () => {
    expect(findRewindPoint(transcript, 'u1')).toEqual({ keepUuid: null, text: 'first prompt', images: [] })
  })

  it('does not treat tool results or unknown ids as prompts', () => {
    expect(findRewindPoint(transcript, 'r1')).toBeNull()
    expect(findRewindPoint(transcript, 'nope')).toBeNull()
  })

  it('ignores side chains and meta entries as the entry to keep', () => {
    const t = [user('u1', 'hi'), assistant('a1', 'x'), { ...assistant('s1', 'side'), isSidechain: true }, user('m1', '<system-reminder>x</system-reminder>', { isMeta: true }), user('u2', 'again')]
    expect(findRewindPoint(t, 'u2')?.keepUuid).toBe('m1')
    expect(findRewindPoint([user('m0', 'caveat', { isMeta: true }), ...t.slice(0, 2)], 'u1')?.keepUuid).toBeNull()
  })
})

describe('promptUuidByText', () => {
  it('counts identical prompts from the end', () => {
    expect(promptUuidByText(transcript, 'first prompt', 0)).toBe('u3')
    expect(promptUuidByText(transcript, 'first prompt', 1)).toBe('u1')
    expect(promptUuidByText(transcript, 'first prompt', 2)).toBeNull()
    expect(promptUuidByText(transcript, ' second prompt ', 0)).toBe('u2')
  })
})

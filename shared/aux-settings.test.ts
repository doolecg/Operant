import { describe, expect, it } from 'vitest'
import { sanitizeMemory } from './aux-settings'

describe('sanitizeMemory', () => {
  it('turns the old on-demand value into session start, and keeps off', () => {
    expect(sanitizeMemory({ recallMode: 'on-demand' }).recallMode).toBe('session-start')
    expect(sanitizeMemory({ recallMode: 'off' }).recallMode).toBe('off')
  })
})

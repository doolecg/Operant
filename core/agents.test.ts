import { describe, expect, it } from 'vitest'
import { scrubLogLine } from './agents'

describe('scrubLogLine', () => {
  it('removes AWS, Google and JWT shaped keys', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
    const out = scrubLogLine(`aws AKIAIOSFODNN7EXAMPLE google AIzaSyA1234567890abcdefghijklmnopqrstuv jwt ${jwt} plain words`)
    expect(out).toBe('aws [secret] google [secret] jwt [secret] plain words')
  })
})

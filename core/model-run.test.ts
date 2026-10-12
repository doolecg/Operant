import { describe, expect, it } from 'vitest'
import { resultUsage } from './model-run'

describe('resultUsage', () => {
  it('adds every input and output token and keeps the cost', () => {
    expect(resultUsage({ usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 300, cache_read_input_tokens: 4000 }, total_cost_usd: 0.012 })).toEqual({ tokens: 4330, usd: 0.012 })
  })

  it('is undefined without usage and ignores bad numbers', () => {
    expect(resultUsage({})).toBeUndefined()
    expect(resultUsage({ usage: { input_tokens: -5, output_tokens: 7 } })).toEqual({ tokens: 7, usd: 0 })
  })
})

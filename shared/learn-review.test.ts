import { describe, expect, it } from 'vitest'
import { needsReview } from './learn'

describe('needsReview', () => {
  it('lets plain advice through', () => {
    for (const t of ['Cart totals are computed in cents, not floats', 'Always run npm test first', 'Keep `cartTotal` pure', 'Never touch the cart module', 'Use the go-to helper in core/cart.ts']) {
      expect(needsReview(t)).toBe('')
    }
  })

  it('holds code blocks, links, installs and commands', () => {
    const held = [
      'Do this:\n```\nnpm run build\n```',
      'See https://example.com/x for the steps',
      'Run npm install first',
      'Use pnpm add zod',
      'pip install requests before testing',
      'winget install Git.Git',
      'Try npx vitest run',
      'Run `git status --short` to check',
      '$ cargo build --release',
    ]
    for (const t of held) expect(needsReview(t), t).not.toBe('')
  })
})

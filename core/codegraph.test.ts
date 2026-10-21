import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CrewIndexes, globalCodegraph } from './codegraph'

describe('CrewIndexes', () => {
  let dir = ''
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }))

  it('reports an unindexed folder, then indexes it on request', async () => {
    dir = mkdtempSync(join(tmpdir(), 'operant-cg-'))
    writeFileSync(join(dir, 'a.ts'), 'export function greet(n: string) { return helper(n) }\nfunction helper(n: string) { return n }\n')
    const idx = new CrewIndexes()

    expect(idx.status(dir)).toMatchObject({ initialized: false, files: 0 })

    const after = await idx.index(dir)
    expect(after).toMatchObject({ initialized: true, indexing: false, files: 1 })
    expect(after.symbols).toBeGreaterThanOrEqual(2)

    // Re-indexing an existing index syncs instead of starting over.
    writeFileSync(join(dir, 'b.ts'), 'export const b = 1\n')
    expect((await idx.index(dir)).files).toBe(2)
  }, 60_000)
})

describe('globalCodegraph', () => {
  const tick = () => new Promise((r) => setTimeout(r, 0))

  it('finds the SDK under the npm global root', async () => {
    const get = globalCodegraph(async () => ({ code: 0, stdout: '/g/node_modules\n', stderr: '' }), () => true)
    await tick()
    expect(get()).toBe(join('/g/node_modules', '@colbymchenry', 'codegraph'))
  })

  it('stays null without an install and looks again on the next call', async () => {
    let installed = false
    let runs = 0
    const get = globalCodegraph(async () => (runs++, { code: 0, stdout: '/g/node_modules', stderr: '' }), () => installed)
    await tick()
    expect(get()).toBeNull()
    installed = true
    await tick()
    expect(get()).toBe(join('/g/node_modules', '@colbymchenry', 'codegraph'))
    expect(runs).toBe(2)
  })

  it('says CodeGraph is not installed when no install was found', async () => {
    vi.resetModules()
    const fresh = await import('./codegraph')
    const status = new fresh.CrewIndexes(() => null).status(tmpdir())
    expect(status.error).toBe(fresh.CODEGRAPH_MISSING)
  })
})

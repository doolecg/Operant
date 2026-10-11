import { describe, expect, it } from 'vitest'
import type { Lesson } from '../shared/learn'
import { buildLinks, clusterLessons } from './lessons'

let n = 0
const mk = (text: string, o: Partial<Lesson> = {}): Lesson => ({
  id: ++n,
  crewId: 1,
  text,
  kind: 'convention',
  scope: 'project',
  files: [],
  symbols: [],
  sourceJobs: [],
  stores: [],
  status: 'active',
  hits: 1,
  related: [],
  consolidatedInto: null,
  createdAt: 0,
  updatedAt: 0,
  ...o,
})

// Word overlap 3 of 5 shared words each side: jaccard 3/7, about 0.43.
const base = 'alpha beta gamma delta epsilon'
const near = (extra: string) => `alpha beta gamma ${extra}`

describe('clusterLessons', () => {
  it('groups similar active lessons of one project, scope and kind', () => {
    const a = mk(base)
    const b = mk(near('zeta eta'))
    const groups = clusterLessons([a, b])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.map((l) => l.id)).toEqual([a.id, b.id])
  })

  it('excludes other scope, kind, project and non-active lessons', () => {
    const a = mk(base)
    const others = [
      mk(near('zeta eta'), { scope: 'user' }),
      mk(near('zeta eta'), { kind: 'pitfall' }),
      mk(near('zeta eta'), { crewId: 2 }),
      mk(near('zeta eta'), { status: 'pending' }),
      mk(near('zeta eta'), { status: 'stale' }),
      mk(near('zeta eta'), { status: 'deleted' }),
    ]
    expect(clusterLessons([a, ...others])).toEqual([])
  })

  it('needs similarity of 0.35 and stays under the duplicate ceiling', () => {
    const a = mk(base)
    expect(clusterLessons([a, mk('alpha beta unrelated words entirely different')])).toEqual([])
    expect(clusterLessons([a, mk(base + ' alpha')])).toEqual([])
    expect(clusterLessons([a, mk('alpha beta gamma delta epsilon zeta eta theta iota kappa')])).toHaveLength(1)
  })

  it('needs the same code targets', () => {
    expect(clusterLessons([mk(base, { files: ['a.ts'] }), mk(near('zeta eta'), { files: ['b.ts'] })])).toEqual([])
  })

  it('holds 2 to 6 lessons per group, largest first', () => {
    const big = Array.from({ length: 8 }, (_, i) => mk(near(`big${i}x`), { kind: 'pitfall' }))
    const small = [mk('red green blue yellow purple'), mk('red green blue orange pink')]
    const groups = clusterLessons([...small, ...big])
    expect(groups.map((g) => g.length)).toEqual([6, 2, 2].slice(0, groups.length))
    expect(groups[0]!.length).toBe(6)
    expect(groups.every((g) => g.length >= 2 && g.length <= 6)).toBe(true)
    expect(clusterLessons([...big], { max: 3 })[0]!.length).toBe(3)
    expect(clusterLessons([mk(base), mk(near('zeta eta'))], { min: 3 })).toEqual([])
  })
})

describe('buildLinks', () => {
  it('links lessons that share a file or symbol, symmetrically and never to themselves', () => {
    const a = mk('first thing', { files: ['Core/X.ts'] })
    const b = mk('second matter', { files: ['core/x.ts'] })
    const c = mk('third item', { symbols: ['go'] })
    const d = mk('fourth bit', { symbols: ['GO'] })
    const e = mk('lonely text here')
    const links = buildLinks([a, b, c, d, e])
    expect(links.get(a.id)).toEqual([b.id])
    expect(links.get(b.id)).toEqual([a.id])
    expect(links.get(c.id)).toEqual([d.id])
    expect(links.has(e.id)).toBe(false)
    for (const [id, to] of links) expect(to).not.toContain(id)
  })

  it('links similar text and ignores other projects, scopes and non-active lessons', () => {
    const a = mk(base)
    const sim = mk(near('zeta eta'))
    const x = mk(near('zeta eta'), { crewId: 2 })
    const y = mk(near('zeta eta'), { scope: 'user' })
    const z = mk(near('zeta eta'), { status: 'stale' })
    const links = buildLinks([a, sim, x, y, z])
    expect(links.get(a.id)).toEqual([sim.id])
    expect(links.has(x.id) || links.has(y.id) || links.has(z.id)).toBe(false)
  })

  it('caps links per lesson and keeps them symmetric', () => {
    const all = Array.from({ length: 10 }, (_, i) => mk(`note ${i}`, { files: ['shared.ts'] }))
    const links = buildLinks(all, 3)
    for (const [id, to] of links) {
      expect(to.length).toBeLessThanOrEqual(3)
      for (const t of to) expect(links.get(t)).toContain(id)
    }
    expect(links.get(all[0]!.id)).toEqual([all[1]!.id, all[2]!.id, all[3]!.id])
  })
})

import type { Lesson } from '../shared/learn'

// Pure helpers over lesson text: comparing, matching and rendering for a brief.

const STOP = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'when', 'should', 'make', 'always', 'never', 'use', 'are', 'was', 'not', 'but', 'you', 'its', 'then', 'than'])

export const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9_./\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export function words(text: string): Set<string> {
  return new Set(normalize(text).split(' ').filter((w) => w.length >= 3 && !STOP.has(w)))
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let both = 0
  for (const w of a) if (b.has(w)) both++
  return both / (a.size + b.size - both)
}

export const similarity = (a: string, b: string): number => (normalize(a) === normalize(b) ? 1 : jaccard(words(a), words(b)))

const lower = (xs: string[]) => xs.map((x) => x.toLowerCase())

type Targets = Pick<Lesson, 'files' | 'symbols'>

// True when the two lessons point at the same code: they share a file or symbol, or both name none.
export function sameTargets(a: Targets, b: Targets): boolean {
  const [af, bf, as, bs] = [lower(a.files), lower(b.files), lower(a.symbols), lower(b.symbols)]
  if (!af.length && !bf.length && !as.length && !bs.length) return true
  return af.some((f) => bf.includes(f)) || as.some((s) => bs.includes(s))
}

export const DUPLICATE_AT = 0.7

export const isDuplicate = (a: Pick<Lesson, 'text' | 'files' | 'symbols'>, b: Pick<Lesson, 'text' | 'files' | 'symbols'>): boolean =>
  similarity(a.text, b.text) >= DUPLICATE_AT && sameTargets(a, b)

export const slug = (text: string, max = 40): string =>
  normalize(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '') || 'lesson'

export const CLUSTER_FLOOR = 0.35
export const LINK_FLOOR = 0.3

const eligible = (l: Lesson): boolean => l.status === 'active' && l.consolidatedInto == null

// Groups of 2 to 6 related, not-yet-duplicate active lessons (same project, scope and kind, same code) for the model to fold into one.
// Greedy from the oldest lesson; largest groups first.
export function clusterLessons(lessons: Lesson[], opts: { min?: number; max?: number } = {}): Lesson[][] {
  const min = opts.min ?? 2
  const max = opts.max ?? 6
  const pool = lessons.filter((l) => eligible(l)).sort((a, b) => a.id - b.id)
  const used = new Set<number>()
  const groups: Lesson[][] = []
  for (const seed of pool) {
    if (used.has(seed.id)) continue
    const group = [seed]
    for (const c of pool) {
      if (group.length >= max) break
      if (c.id === seed.id || used.has(c.id)) continue
      if (c.crewId !== seed.crewId || c.scope !== seed.scope || c.kind !== seed.kind) continue
      if (!sameTargets(seed, c)) continue
      const s = similarity(seed.text, c.text)
      if (s >= CLUSTER_FLOOR && s < DUPLICATE_AT) group.push(c)
    }
    if (group.length < min) continue
    for (const g of group) used.add(g.id)
    groups.push(group)
  }
  return groups.sort((a, b) => b.length - a.length)
}

// Symmetric links between active lessons of one project and scope that share a file or symbol, or read alike
// (similarity of at least 0.3). At most `cap` per lesson, strongest first, ties by lower id. Only linked lessons have an entry.
export function buildLinks(lessons: Lesson[], cap = 5): Map<number, number[]> {
  const pool = lessons.filter(eligible).sort((a, b) => a.id - b.id)
  const pairs: Array<{ a: number; b: number; score: number }> = []
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const x = pool[i]!
      const y = pool[j]!
      if (x.id === y.id || x.crewId !== y.crewId || x.scope !== y.scope) continue
      const [xf, yf, xs, ys] = [lower(x.files), lower(y.files), lower(x.symbols), lower(y.symbols)]
      const shared = xf.filter((f) => yf.includes(f)).length + xs.filter((s) => ys.includes(s)).length
      const sim = similarity(x.text, y.text)
      if (!shared && sim < LINK_FLOOR) continue
      pairs.push({ a: x.id, b: y.id, score: sim + (shared ? 1 + shared / 100 : 0) })
    }
  }
  pairs.sort((p, q) => q.score - p.score || p.a - q.a || p.b - q.b)
  const out = new Map<number, number[]>()
  const add = (from: number, to: number) => out.set(from, [...(out.get(from) ?? []), to])
  for (const p of pairs) {
    if ((out.get(p.a)?.length ?? 0) >= cap || (out.get(p.b)?.length ?? 0) >= cap) continue
    add(p.a, p.b)
    add(p.b, p.a)
  }
  return out
}

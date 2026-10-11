import type { MemorySettings } from '../shared/aux-settings'
import { SOUL_BANK, bankFor, type RecallResult } from './hindsight'

// Plain retrieval: no model call. The Soul Bank (global user preferences) and the project's bank, cut to the
// settings' topK and token budget (about four characters to a token).
export interface RecallSource {
  recall(bank: string, query: string, limit: number): Promise<RecallResult>
}

import type { RecallItem, RecallOutput } from '../shared/ops'

export const estimateTokens = (text: string): number => Math.ceil(text.length / 4)

export interface LessonLookup {
  isLive(id: number): boolean
  related(id: number): string[]
}

const MARKER = /^LESSON #(\d+)(?: \[[^\]]*\])?[ \t]*/
const normalise = (t: string): string => t.trim().replace(/\s+/g, ' ').toLowerCase()

// The lesson id from a `LESSON #12 [pitfall] ` marker at the start of a Hindsight item, or null for older items.
export function lessonIdOf(text: string): number | null {
  const m = MARKER.exec(text)
  return m ? Number(m[1]) : null
}

const stripMarker = (text: string): string => text.replace(MARKER, '')

export async function recallMemory(src: RecallSource, folder: string | null, query: string, s: MemorySettings, lessons?: LessonLookup): Promise<RecallOutput> {
  const none = (error: string): RecallOutput => ({ items: [], text: '', truncated: false, error })
  if (s.recallMode === 'off') return none('Memory recall is off (Settings, Memory)')
  const q = query.trim()
  if (!q) return none('Nothing to recall: the query is empty')
  const asks: Array<Promise<{ bank: RecallItem['bank']; r: RecallResult }>> = []
  if (s.includeSoul) asks.push(src.recall(SOUL_BANK, q, s.topK).then((r) => ({ bank: 'soul' as const, r })))
  if (folder) asks.push(src.recall(bankFor(folder), q, s.topK).then((r) => ({ bank: 'project' as const, r })))
  const answers = await Promise.all(asks)
  const failed = answers.filter((a) => !a.r.ok)
  const items: RecallItem[] = []
  let budget = s.maxTokens
  let truncated = false
  const seen = new Set<string>()
  const relatedIds: number[] = []
  const add = (bank: RecallItem['bank'], text: string): 'ok' | 'full' => {
    if (items.length >= s.topK) return 'full'
    const cost = estimateTokens(text)
    if (cost > budget) return 'full'
    budget -= cost
    items.push({ bank, text })
    seen.add(normalise(text))
    return 'ok'
  }
  for (const a of answers) {
    if (!a.r.ok) continue
    for (const raw of a.r.items) {
      const id = lessonIdOf(raw)
      if (lessons && id !== null && !lessons.isLive(id)) continue
      if (add(a.bank, stripMarker(raw)) === 'full') {
        truncated = true
        break
      }
      if (id !== null) relatedIds.push(id)
    }
  }
  if (lessons) {
    let extra = 0
    outer: for (const id of relatedIds) {
      for (const text of lessons.related(id)) {
        if (extra >= 2) break outer
        if (seen.has(normalise(text))) continue
        if (add('project', text) === 'full') {
          truncated = true
          break outer
        }
        extra++
      }
    }
  }
  const error = answers.length > 0 && failed.length === answers.length && !items.length ? (failed[0]!.r as { error: string }).error : ''
  return { items, text: items.map((i) => i.text).join('\n\n'), truncated, error }
}

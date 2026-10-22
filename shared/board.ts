import { tileState, type ChatItem, type ChatState } from './claude-chat'
import { firstLine } from './notify'
import type { Crew, ProviderStatus, ProviderWindow, ScratchTerminal } from './types'

// The Board: one card per thread across all projects. Pure logic here; the live chat state is read by the renderer.

export type BoardStatus = 'needs' | 'working' | 'failed' | 'done' | 'quiet'
export type BoardFilter = 'all' | 'working' | 'needs'

// What a live (open) Claude chat says about its thread.
export interface BoardLive {
  status: BoardStatus
  line: string | null
  model: string | null
}

export interface BoardCard {
  row: ScratchTerminal
  project: string
  open: boolean
  status: BoardStatus
  line: string | null
  model: string | null
}

const OPENABLE = new Set(['claude', 'opencode'])

// The first line of Claude's latest answer, without markdown marks.
export function lastAssistantLine(items: ChatItem[]): string | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]!
    if (it.kind !== 'text' || it.parent !== null) continue
    const line = firstLine(it.md.replace(/^[\s#>*`-]+/gm, ''))
    if (line) return line
  }
  return null
}

// `headline` is the right-now line of a running turn (only read while it works).
export function liveSummary(state: Pick<ChatState, 'process' | 'turn' | 'items' | 'model' | 'modelDisplayName'>, headline: string): BoardLive {
  const model = state.modelDisplayName ?? state.model
  const word = tileState(state)
  if (word === 'Crashed') return { status: 'failed', line: 'Claude process crashed', model }
  if (word === 'Waiting for you') return { status: 'needs', line: state.turn.pendingLabel ?? 'Waiting for you', model }
  if (word === 'Working') return { status: 'working', line: headline || null, model }
  if (!state.items.some((i) => i.kind === 'user')) return { status: 'quiet', line: null, model }
  return { status: 'done', line: lastAssistantLine(state.items), model }
}

// Claude and OpenCode threads that are open as tiles, or closed with history.
export function buildCards(groups: Array<{ crew: Crew; rows: ScratchTerminal[] }>, openIds: ReadonlySet<number>, live: ReadonlyMap<number, BoardLive>): BoardCard[] {
  const cards: BoardCard[] = []
  for (const { crew, rows } of groups) {
    for (const row of rows) {
      const open = openIds.has(row.id)
      if (!OPENABLE.has(row.agent) || (!open && row.updatedAt <= row.createdAt)) continue
      const l = open ? live.get(row.id) : undefined
      cards.push({ row, project: crew.name, open, status: l?.status ?? 'quiet', line: l?.line ?? null, model: l?.model ?? (row.model || null) })
    }
  }
  return sortCards(cards)
}

// Needs you first, then newest.
export function sortCards(cards: BoardCard[]): BoardCard[] {
  const rank = (c: BoardCard) => (c.status === 'needs' ? 0 : 1)
  return [...cards].sort((a, b) => rank(a) - rank(b) || b.row.updatedAt - a.row.updatedAt || b.row.id - a.row.id)
}

export function boardCounts(cards: BoardCard[]): Record<BoardFilter, number> {
  return { all: cards.length, working: cards.filter((c) => c.status === 'working').length, needs: cards.filter((c) => c.status === 'needs').length }
}

export const filterCards = (cards: BoardCard[], filter: BoardFilter): BoardCard[] =>
  filter === 'all' ? cards : cards.filter((c) => c.status === (filter === 'needs' ? 'needs' : 'working'))

// "3 working, 1 needs you"; null when neither applies.
export function activitySummary(counts: Record<BoardFilter, number>): string | null {
  const parts = [counts.working > 0 ? `${counts.working} working` : null, counts.needs > 0 ? `${counts.needs} needs you` : null].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

const FIVE_HOUR = /5[\s-]?h|five|hour|session/i
const WEEK = /week|7[\s-]?day/i

// The Claude plan windows in percent used (the same reading as the Chat info row).
export function planUsage(providers: Array<Pick<ProviderStatus, 'id' | 'name'> & { windows: Array<Pick<ProviderWindow, 'label' | 'usedPct'>> }>): { fiveHour: number | null; sevenDay: number | null } {
  const wins = providers.filter((p) => p.id === 'claude' || /^claude/i.test(p.name)).flatMap((p) => p.windows.filter((w) => w.usedPct != null))
  return {
    fiveHour: wins.find((w) => FIVE_HOUR.test(w.label))?.usedPct ?? null,
    sevenDay: (wins.find((w) => WEEK.test(w.label) && !w.label.includes('(')) ?? wins.find((w) => WEEK.test(w.label)))?.usedPct ?? null,
  }
}

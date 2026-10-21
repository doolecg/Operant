import type { ChatItem, ChatProcessPhase } from './claude-chat'

// Rules of the queue strip above the chat box (core/claude-chat.ts holds the queue, the renderer draws it). Pure, so
// core and the renderer decide the same way.

export interface SteerContext {
  process: ChatProcessPhase
  turnRunning: boolean
  // The owner stopped Claude or the tile is closing: the process is on its way out.
  stopping: boolean
  compacting: boolean
  runningSubagents: number
}

// How a queued message goes to Claude now: 'idle' is an ordinary message (no turn runs), 'now' stops the current step
// (priority 'now'), 'next' joins the running turn at Claude Code's next step without stopping anything.
export type SteerPlan = { ok: true; how: 'idle' | 'now' | 'next' } | { ok: false; reason: string }

export function planSteer(c: SteerContext): SteerPlan {
  if (c.process !== 'ready') return { ok: false, reason: 'Claude Code is not running' }
  if (c.stopping) return { ok: false, reason: 'Claude Code is stopping' }
  if (c.compacting) return { ok: false, reason: 'Claude is compacting the conversation' }
  if (!c.turnRunning) return { ok: true, how: 'idle' }
  // A step that stops now would cut a running sub-agent short.
  return { ok: true, how: c.runningSubagents > 0 ? 'next' : 'now' }
}

export const runningSubagents = (items: readonly ChatItem[]): number => items.filter((i) => i.kind === 'subagent' && (i.status === 'running' || i.status === 'waiting')).length

// The queue after moving `id` one place (-1 up, 1 down); null when it cannot move.
export function moveQueued<T extends { id: string }>(queue: readonly T[], id: string, by: -1 | 1): T[] | null {
  const from = queue.findIndex((q) => q.id === id)
  const to = from + by
  if (from < 0 || to < 0 || to >= queue.length) return null
  const next = queue.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved!)
  return next
}

// What a collapsed strip row shows: the first line that has text.
export const queuePreview = (text: string): string => text.split(/\r?\n/).find((l) => l.trim() !== '')?.trim() ?? ''

export interface Draft {
  text: string
  images: number
}

const hasDraft = (d: Draft): boolean => d.text.trim() !== '' || d.images > 0

// Editing a queued message puts it in the chat box: refused while the box holds a draft, so a draft is never overwritten.
export const editRefusal = (d: Draft): string | null => (hasDraft(d) ? 'Send or clear what is in the box first, then edit the queued message' : null)

// Alt+Enter sends the first queued message now, but only from an empty box (with text, Enter keeps its normal job).
export const altEnterTarget = (d: Draft, queue: ReadonlyArray<{ id: string }>): string | null => (hasDraft(d) ? null : (queue[0]?.id ?? null))

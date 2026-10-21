import type { ChatItem } from './claude-chat'

// One line of the history strip beside the chat: an owner message, with the start of Claude's answer for the hover card.
export interface HistoryLine {
  id: string
  title: string
  reply: string
}

const TITLE_MAX = 90
const REPLY_MAX = 180

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s)
// Markdown marks that read as noise in a short preview.
const plain = (md: string) => md.replace(/```[\s\S]*?```/g, ' ').replace(/[`*_#>]+/g, '').replace(/\s+/g, ' ').trim()

// One line per owner message of the main conversation, oldest first; `reply` is the first words of the text Claude wrote after it.
export function historyLines(items: readonly ChatItem[]): HistoryLine[] {
  const lines: HistoryLine[] = []
  let open: HistoryLine | null = null
  for (const it of items) {
    if (it.kind === 'user' && it.parent === null) {
      const first = it.text.split('\n').find((l) => l.trim()) ?? (it.images.length ? 'Image' : '')
      open = { id: it.id, title: clip(first.trim(), TITLE_MAX), reply: '' }
      lines.push(open)
    } else if (open && !open.reply && it.kind === 'text' && it.parent === null) {
      open.reply = clip(plain(it.md), REPLY_MAX)
    }
  }
  return lines
}

// The line the owner is reading: the last whose message starts at or above `threshold` px from the top of the view; the first when none does.
// `offsets` are each message's distance from the top of the view, in line order.
export function activeLine(offsets: readonly number[], threshold: number): number {
  let at = 0
  for (let i = 0; i < offsets.length; i++) if (offsets[i]! <= threshold) at = i
  return at
}

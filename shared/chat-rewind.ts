// "Edit from here": finds, in a parsed transcript (~/.claude/projects/<slug>/<session>.jsonl), the prompt to rewind to and
// the entry the conversation keeps (what `claude --resume-session-at` takes).

export interface RewindImage {
  mediaType: string
  base64: string
}

export interface RewindPoint {
  // The `uuid` of the last conversation entry before the prompt; null when it is the first prompt (start a fresh session).
  keepUuid: string | null
  text: string
  images: RewindImage[]
}

type Rec = Record<string, unknown>

const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {})
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

// User entries that are not something the owner typed (the chat shows no bubble for them either).
const NOT_TYPED = /^(<local-command-|<command-name>|<system-reminder>|<task-notification>|\[Request interrupted by user)/

function promptOf(e: Rec): { text: string; images: RewindImage[] } | null {
  if (e.type !== 'user' || e.isSidechain === true || e.isMeta === true || e.isCompactSummary === true) return null
  const c = rec(e.message).content
  const blocks: Rec[] = typeof c === 'string' ? [{ type: 'text', text: c }] : Array.isArray(c) ? c.map(rec) : []
  if (blocks.some((b) => b.type === 'tool_result')) return null
  const text = blocks
    .filter((b) => b.type === 'text')
    .map((b) => str(b.text))
    .join('\n')
    .trim()
  if (NOT_TYPED.test(text)) return null
  const images: RewindImage[] = []
  for (const b of blocks) {
    const s = rec(b.source)
    if (b.type === 'image' && s.type === 'base64' && str(s.data)) images.push({ mediaType: str(s.media_type) || 'image/png', base64: str(s.data) })
  }
  return text || images.length ? { text, images } : null
}

export function findRewindPoint(entries: unknown[], userUuid: string): RewindPoint | null {
  const list = entries.map(rec)
  const at = list.findIndex((e) => e.uuid === userUuid && promptOf(e))
  if (at < 0) return null
  const { text, images } = promptOf(list[at]!)!
  const before = list.slice(0, at)
  if (!before.some((e) => promptOf(e))) return { keepUuid: null, text, images }
  const last = before.reverse().find((e) => (e.type === 'user' || e.type === 'assistant') && e.isSidechain !== true && str(e.uuid))
  return { keepUuid: last ? str(last.uuid) : null, text, images }
}

// The uuid of the prompt with this text that has `after` prompts with the same text after it, for chat bubbles whose id is
// not a transcript uuid (messages sent in this run).
export function promptUuidByText(entries: unknown[], text: string, after: number): string | null {
  const want = text.trim()
  const same = entries.map(rec).filter((e) => str(e.uuid) && promptOf(e)?.text === want)
  return str(same[same.length - 1 - after]?.uuid) || null
}

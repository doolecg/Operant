export const NOTE_COLORS = ['yellow', 'blue', 'green', 'purple', 'orange'] as const
export type NoteColor = (typeof NOTE_COLORS)[number]

export interface Note {
  id: number
  crewId: number
  text: string
  color: NoteColor
  sortOrder: number
  updatedAt: number
}

export interface NotePatch {
  text?: string
  color?: NoteColor
}

export const isNoteColor = (v: unknown): v is NoteColor => NOTE_COLORS.includes(v as NoteColor)

// Note text is a small sanitised HTML subset: b, i, ul, li, br, div, p and an empty checkbox span carrying data-checked="true|false".
const ALLOWED = new Set(['b', 'strong', 'i', 'em', 'ul', 'li', 'br', 'div', 'p', 'span'])
const CANON: Record<string, string> = { strong: 'b', em: 'i' }
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g

const escapeText = (s: string) =>
  s
    .replace(/&(?!(?:amp|lt|gt|nbsp|quot|#\d+|#x[0-9a-f]+);)/gi, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

// Keeps only the allowed tags with no attributes (the checkbox span keeps data-checked); everything else is dropped and stray text is escaped.
export function sanitizeNoteHtml(html: string): string {
  const src = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style)\b[\s\S]*$/i, '')
  let out = ''
  let last = 0
  const spans: boolean[] = []
  for (const m of src.matchAll(TAG)) {
    out += escapeText(src.slice(last, m.index))
    last = m.index + m[0].length
    const closing = m[1] === '/'
    const name = m[2]!.toLowerCase()
    if (!ALLOWED.has(name)) continue
    if (name === 'br') {
      if (!closing) out += '<br>'
    } else if (name === 'span') {
      if (closing) {
        if (spans.pop()) out += '</span>'
      } else {
        const c = /data-checked\s*=\s*["']?(true|false)/i.exec(m[3] ?? '')
        spans.push(c != null)
        if (c) out += `<span data-checked="${c[1]!.toLowerCase()}">`
      }
    } else {
      const tag = CANON[name] ?? name
      out += closing ? `</${tag}>` : `<${tag}>`
    }
  }
  return out + escapeText(src.slice(last))
}

const inlineMarks = (s: string) =>
  escapeText(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')

// Converts a note saved as plain or Markdown text (**bold**, *italic*, "- " bullets, "- [ ] " / "- [x] " items) to the HTML subset.
export function markdownNoteToHtml(text: string): string {
  let out = ''
  let open = false
  for (const line of text.split('\n')) {
    const task = /^- \[([ xX])\] ?(.*)$/.exec(line)
    const bullet = /^- (.*)$/.exec(line)
    if (task || bullet) {
      if (!open) out += '<ul>'
      open = true
      if (task) out += `<li><span data-checked="${task[1] === ' ' ? 'false' : 'true'}"></span>${inlineMarks(task[2]!)}</li>`
      else out += `<li>${inlineMarks(bullet![1]!)}</li>`
      continue
    }
    if (open) out += '</ul>'
    open = false
    out += line === '' ? '<div><br></div>' : `<div>${inlineMarks(line)}</div>`
  }
  return open ? out + '</ul>' : out
}

// Stored text -> editor HTML: text without any HTML tag is an older plain or Markdown note.
export function noteTextToHtml(text: string): string {
  if (text.trim() === '') return ''
  return /<\/?[a-zA-Z][^>]*>/.test(text) ? sanitizeNoteHtml(text) : markdownNoteToHtml(text)
}

// Editor HTML -> stored text. A note with no visible content is stored empty; plain text is wrapped in a div so it is never read as an old note.
export function noteHtmlToSave(html: string): string {
  const clean = sanitizeNoteHtml(html)
  if (!/<li>|data-checked/.test(clean) && clean.replace(/<[^>]*>|&nbsp;/g, '').trim() === '') return ''
  return /<[a-z]/.test(clean) ? clean : `<div>${clean}</div>`
}

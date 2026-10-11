import { existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { scrubLogLine } from './agents'

const TRANSCRIPT_CAP = 12_000

const norm = (p: string): string => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()

// The text of the most recent OpenCode session for a project folder (user messages and assistant text parts), read straight
// from OpenCode's database, opened read-only. '' when the database, the session or the text is missing or unreadable.
export function readOpenCodeSessionText(dbFile: string, folder: string, cap = TRANSCRIPT_CAP): string {
  if (!folder || !existsSync(dbFile)) return ''
  let db: DatabaseSync | null = null
  try {
    db = new DatabaseSync(dbFile, { readOnly: true })
    db.exec('PRAGMA busy_timeout = 2000')
    const want = norm(folder)
    const sessions = db.prepare('SELECT id, directory FROM session ORDER BY time_updated DESC LIMIT 200').all() as Array<{ id: string; directory: string }>
    const session = sessions.find((s) => typeof s.directory === 'string' && norm(s.directory) === want)
    if (!session) return ''
    const roles = new Map<string, string>()
    for (const m of db.prepare('SELECT id, data FROM message WHERE session_id = ? ORDER BY time_created').all(session.id) as Array<{ id: string; data: string }>) {
      try {
        const role = (JSON.parse(m.data) as { role?: unknown }).role
        if (role === 'user' || role === 'assistant') roles.set(m.id, role)
      } catch {
        // an unreadable row
      }
    }
    const lines: string[] = []
    const parts = db.prepare('SELECT message_id, data FROM part WHERE session_id = ? ORDER BY time_created').all(session.id) as Array<{ message_id: string; data: string }>
    for (const p of parts) {
      const role = roles.get(p.message_id)
      if (!role) continue
      try {
        const o = JSON.parse(p.data) as { type?: unknown; text?: unknown; synthetic?: unknown; ignored?: unknown }
        if (o.type !== 'text' || typeof o.text !== 'string' || o.synthetic === true || o.ignored === true) continue
        const text = o.text.replace(/\s+/g, ' ').trim()
        if (text) lines.push(`${role === 'user' ? 'User' : 'Assistant'}: ${text}`)
      } catch {
        // an unreadable row
      }
    }
    return scrubLogLine(lines.join('\n').slice(-cap))
  } catch {
    return ''
  } finally {
    try {
      db?.close()
    } catch {
      /* already closed */
    }
  }
}

import { isNoteColor, type Note, type NoteColor, type NotePatch } from '../shared/notes'
import type { Store } from './store'

type Row = Record<string, unknown>

const MAX_TEXT = 20_000

const toNote = (r: Row): Note => ({
  id: Number(r.id),
  crewId: Number(r.crew_id),
  text: String(r.text),
  color: isNoteColor(r.color) ? r.color : 'yellow',
  sortOrder: Number(r.sort_order),
  updatedAt: Number(r.updated_at),
})

// A project's notes, newest first (a new note takes a sort order below every other one).
export function listNotes(store: Store, crewId: number): Note[] {
  return (store.db.prepare('SELECT * FROM notes WHERE crew_id = ? ORDER BY sort_order ASC, id DESC').all(crewId) as Row[]).map(toNote)
}

export function getNote(store: Store, id: number): Note | null {
  const r = store.db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Row | undefined
  return r ? toNote(r) : null
}

export function createNote(store: Store, crewId: number, color: NoteColor = 'yellow', now: number = Date.now()): Note {
  if (!isNoteColor(color)) throw new Error('The note colour is not valid')
  const top = Number((store.db.prepare('SELECT COALESCE(MIN(sort_order), 0) - 1 AS n FROM notes WHERE crew_id = ?').get(crewId) as Row).n)
  const res = store.db.prepare('INSERT INTO notes (crew_id, text, color, sort_order, updated_at) VALUES (?, ?, ?, ?, ?)').run(crewId, '', color, top, now)
  return getNote(store, Number(res.lastInsertRowid))!
}

export function updateNote(store: Store, id: number, patch: NotePatch, now: number = Date.now()): Note {
  const cur = getNote(store, id)
  if (!cur) throw new Error('That note no longer exists')
  if (patch.color !== undefined && !isNoteColor(patch.color)) throw new Error('The note colour is not valid')
  const text = patch.text === undefined ? cur.text : String(patch.text).slice(0, MAX_TEXT)
  store.db.prepare('UPDATE notes SET text = ?, color = ?, updated_at = ? WHERE id = ?').run(text, patch.color ?? cur.color, now, id)
  return getNote(store, id)!
}

// Returns the project the note belonged to, or null when it was already gone.
export function deleteNote(store: Store, id: number): number | null {
  const cur = getNote(store, id)
  if (!cur) return null
  store.db.prepare('DELETE FROM notes WHERE id = ?').run(id)
  return cur.crewId
}

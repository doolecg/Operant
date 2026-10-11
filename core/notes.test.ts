import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Store } from './store'
import { createNote, deleteNote, getNote, listNotes, updateNote } from './notes'

describe('notes', () => {
  let store: Store
  let crewId: number
  beforeEach(() => {
    store = new Store(':memory:')
    crewId = store.createCrew('Alpha', '/tmp/alpha').id
  })
  afterEach(() => store.close())

  it('creates yellow notes at the top of the list', () => {
    const a = createNote(store, crewId, 'yellow', 1)
    const b = createNote(store, crewId, 'blue', 2)
    expect(a).toMatchObject({ text: '', color: 'yellow', crewId })
    expect(listNotes(store, crewId).map((n) => n.id)).toEqual([b.id, a.id])
  })

  it('updates text and colour and keeps the rest', () => {
    const n = createNote(store, crewId, 'yellow', 1)
    expect(updateNote(store, n.id, { text: 'buy milk' }, 5)).toMatchObject({ text: 'buy milk', color: 'yellow', updatedAt: 5 })
    expect(updateNote(store, n.id, { color: 'green' }, 6)).toMatchObject({ text: 'buy milk', color: 'green' })
    expect(() => updateNote(store, 9999, { text: 'x' })).toThrow()
  })

  it('deletes a note and reports its project', () => {
    const n = createNote(store, crewId)
    expect(deleteNote(store, n.id)).toBe(crewId)
    expect(getNote(store, n.id)).toBeNull()
    expect(deleteNote(store, n.id)).toBeNull()
  })

  it('removes a project\'s notes with the project', () => {
    createNote(store, crewId)
    store.db.prepare('DELETE FROM crews WHERE id = ?').run(crewId)
    expect(listNotes(store, crewId)).toEqual([])
  })
})

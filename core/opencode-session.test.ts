import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readOpenCodeSessionText } from './opencode-session'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'oc-session-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function fixture(file: string): void {
  const db = new DatabaseSync(file)
  db.exec('CREATE TABLE session (id text primary key, directory text, time_created integer, time_updated integer)')
  db.exec('CREATE TABLE message (id text primary key, session_id text, time_created integer, data text)')
  db.exec('CREATE TABLE part (id text primary key, message_id text, session_id text, time_created integer, data text)')
  db.prepare('INSERT INTO session VALUES (?, ?, ?, ?)').run('old', 'C:\\proj', 1, 10)
  db.prepare('INSERT INTO session VALUES (?, ?, ?, ?)').run('new', 'C:\\proj\\', 2, 20)
  db.prepare('INSERT INTO session VALUES (?, ?, ?, ?)').run('other', 'C:\\else', 3, 30)
  const msg = db.prepare('INSERT INTO message VALUES (?, ?, ?, ?)')
  const part = db.prepare('INSERT INTO part VALUES (?, ?, ?, ?, ?)')
  msg.run('m0', 'old', 1, JSON.stringify({ role: 'user' }))
  part.run('p0', 'm0', 'old', 1, JSON.stringify({ type: 'text', text: 'old question' }))
  msg.run('m1', 'new', 1, JSON.stringify({ role: 'user' }))
  part.run('p1', 'm1', 'new', 1, JSON.stringify({ type: 'text', text: 'Fix the parser' }))
  msg.run('m2', 'new', 2, JSON.stringify({ role: 'assistant' }))
  part.run('p2', 'm2', 'new', 2, JSON.stringify({ type: 'text', text: 'Done, token=abcdefghijkl123456' }))
  part.run('p3', 'm2', 'new', 3, JSON.stringify({ type: 'tool', text: 'ignored' }))
  db.close()
}

describe('readOpenCodeSessionText', () => {
  it('returns the latest session for the folder, scrubbed', () => {
    const file = join(dir, 'opencode.db')
    fixture(file)
    const text = readOpenCodeSessionText(file, 'c:/proj')
    expect(text).toContain('User: Fix the parser')
    expect(text).toContain('Assistant: Done')
    expect(text).not.toContain('abcdefghijkl123456')
    expect(text).not.toContain('old question')
    expect(text).not.toContain('ignored')
    expect(readOpenCodeSessionText(file, 'c:/proj', 10).length).toBeLessThanOrEqual(10)
  })

  it('returns an empty string when the database or session is missing or unreadable', () => {
    const file = join(dir, 'opencode.db')
    expect(readOpenCodeSessionText(join(dir, 'nope.db'), 'c:/proj')).toBe('')
    fixture(file)
    expect(readOpenCodeSessionText(file, 'c:/nothing')).toBe('')
    const bad = join(dir, 'bad.db')
    new DatabaseSync(bad).close()
    expect(readOpenCodeSessionText(bad, 'c:/proj')).toBe('')
  })
})

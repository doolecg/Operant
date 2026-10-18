import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFirefoxCookiesFromDb } from './firefox'

describe('readFirefoxCookiesFromDb', () => {
  let dir: string
  beforeEach(() => (dir = mkdtempSync(join(tmpdir(), 'ff-db-'))))
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('reads moz_cookies with plain values and maps the fields', () => {
    const file = join(dir, 'cookies.sqlite')
    const db = new DatabaseSync(file)
    db.exec('CREATE TABLE moz_cookies (name TEXT, value TEXT, host TEXT, path TEXT, expiry INT, isSecure INT, isHttpOnly INT, sameSite INT)')
    const ins = db.prepare('INSERT INTO moz_cookies VALUES (?,?,?,?,?,?,?,?)')
    ins.run('sid', 'abc123', '.example.com', '/', 1893456000, 1, 1, 2)
    ins.run('tmp', 'x', 'session.test', '', 0, 0, 0, 0)
    db.close()
    const cookies = readFirefoxCookiesFromDb(file)
    expect(cookies).toHaveLength(2)
    expect(cookies[0]).toEqual({ host: '.example.com', name: 'sid', value: 'abc123', path: '/', secure: true, httpOnly: true, sameSite: 'strict', expires: 1893456000 })
    expect(cookies[1]).toMatchObject({ host: 'session.test', path: '/', secure: false, sameSite: 'unspecified', expires: null })
  })
})

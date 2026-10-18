import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { withCookieDbCopy } from './copy'
import type { RawCookie } from './types'

interface MozRow {
  name: string
  value: string
  host: string
  path: string
  // Seconds since the epoch; 0 for a session cookie.
  expiry: number
  isSecure: number
  isHttpOnly: number
  // 0 none/unset, 1 lax, 2 strict.
  sameSite: number
}

function mapSameSite(v: number): RawCookie['sameSite'] {
  if (v === 1) return 'lax'
  if (v === 2) return 'strict'
  return 'unspecified'
}

// Reads Firefox's moz_cookies table from an already-copied, unlocked database file. Values are plain text.
export function readFirefoxCookiesFromDb(dbFile: string): RawCookie[] {
  let db: DatabaseSync | null = null
  try {
    db = new DatabaseSync(dbFile, { readOnly: true })
    db.exec('PRAGMA busy_timeout = 2000')
    const rows = db.prepare('SELECT name, value, host, path, expiry, isSecure, isHttpOnly, sameSite FROM moz_cookies').all() as unknown as MozRow[]
    return rows.map((r) => ({
      host: r.host,
      name: r.name,
      value: r.value,
      path: r.path || '/',
      secure: r.isSecure === 1,
      httpOnly: r.isHttpOnly === 1,
      sameSite: mapSameSite(r.sameSite),
      // Firefox expiry is epoch seconds; 0 (or absent) means a session cookie.
      expires: r.expiry && r.expiry > 0 ? r.expiry : null,
    }))
  } finally {
    db?.close()
  }
}

// Reads the default Firefox profile's cookies, copying the locked store first.
export async function readFirefoxCookies(profileDir: string): Promise<RawCookie[]> {
  const dbFile = join(profileDir, 'cookies.sqlite')
  if (!existsSync(dbFile)) return []
  return withCookieDbCopy(dbFile, async (copy) => readFirefoxCookiesFromDb(copy))
}

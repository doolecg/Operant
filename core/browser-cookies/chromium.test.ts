import { createCipheriv, randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { chromiumEpochToSeconds, decryptAesCbc, decryptAesGcm, mapChromiumSameSite, readChromiumRowsFromDb, valueVersion, windowsWrappedKey } from './chromium'

// Builds a v10 AES-256-GCM blob the way Chromium does on Windows, so the decrypt can be checked against a known value.
function makeGcmBlob(key: Buffer, plain: string): Buffer {
  const nonce = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key, nonce)
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return Buffer.concat([Buffer.from('v10'), nonce, ct, c.getAuthTag()])
}

// Builds a v10 AES-128-CBC blob the way Chromium does on macOS/Linux (16-space IV, PKCS#7 padding).
function makeCbcBlob(key: Buffer, plain: string): Buffer {
  const iv = Buffer.alloc(16, 0x20)
  const c = createCipheriv('aes-128-cbc', key, iv)
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return Buffer.concat([Buffer.from('v10'), ct])
}

describe('mapChromiumSameSite', () => {
  it('maps the stored codes', () => {
    expect(mapChromiumSameSite(-1)).toBe('unspecified')
    expect(mapChromiumSameSite(0)).toBe('no_restriction')
    expect(mapChromiumSameSite(1)).toBe('lax')
    expect(mapChromiumSameSite(2)).toBe('strict')
  })
})

describe('chromiumEpochToSeconds', () => {
  it('converts microseconds since 1601 to Unix seconds', () => {
    // 1601 epoch + 11644473600s = Unix 0; add one day of microseconds.
    const micros = (11_644_473_600 + 86_400) * 1_000_000
    expect(chromiumEpochToSeconds(micros)).toBe(86_400)
  })
  it('treats 0 as a session cookie', () => {
    expect(chromiumEpochToSeconds(0)).toBeNull()
  })
})

describe('valueVersion', () => {
  it('reads the version tag', () => {
    expect(valueVersion(Buffer.from('v10abc'))).toBe('v10')
    expect(valueVersion(Buffer.from('v11abc'))).toBe('v11')
    expect(valueVersion(Buffer.from('v20abc'))).toBe('v20')
    expect(valueVersion(Buffer.from('legacy'))).toBe('')
  })
})

describe('decryptAesGcm', () => {
  it('round-trips a v10 value', () => {
    const key = randomBytes(32)
    expect(decryptAesGcm(makeGcmBlob(key, 'hello=world; token'), key)).toBe('hello=world; token')
  })
  it('throws on a wrong key', () => {
    const blob = makeGcmBlob(randomBytes(32), 'secret')
    expect(() => decryptAesGcm(blob, randomBytes(32))).toThrow()
  })
})

describe('decryptAesCbc', () => {
  it('round-trips a v10 value and strips padding', () => {
    const key = randomBytes(16)
    expect(decryptAesCbc(makeCbcBlob(key, 'abc123'), key)).toBe('abc123')
  })
})

describe('windowsWrappedKey', () => {
  let dir: string
  beforeEach(() => (dir = mkdtempSync(join(tmpdir(), 'ck-ls-'))))
  afterEach(() => rmSync(dir, { recursive: true, force: true }))
  it('strips the DPAPI marker', () => {
    const wrapped = Buffer.concat([Buffer.from('DPAPI'), Buffer.from([1, 2, 3, 4])])
    const file = join(dir, 'Local State')
    writeFileSync(file, JSON.stringify({ os_crypt: { encrypted_key: wrapped.toString('base64') } }))
    expect(windowsWrappedKey(file)).toEqual(Buffer.from([1, 2, 3, 4]))
  })
  it('returns null when the file is missing or malformed', () => {
    expect(windowsWrappedKey(join(dir, 'nope'))).toBeNull()
  })
})

describe('readChromiumRowsFromDb', () => {
  let dir: string
  beforeEach(() => (dir = mkdtempSync(join(tmpdir(), 'ck-db-'))))
  afterEach(() => rmSync(dir, { recursive: true, force: true }))
  it('reads rows with encrypted and plain values', () => {
    const file = join(dir, 'Cookies')
    const db = new DatabaseSync(file)
    db.exec('CREATE TABLE cookies (host_key TEXT, name TEXT, value TEXT, encrypted_value BLOB, path TEXT, is_secure INT, is_httponly INT, samesite INT, expires_utc INT)')
    const enc = Buffer.from('v10cipher')
    db.prepare('INSERT INTO cookies VALUES (?,?,?,?,?,?,?,?,?)').run('.example.com', 'sid', '', enc, '/', 1, 1, 1, 13300000000000000n)
    db.prepare('INSERT INTO cookies VALUES (?,?,?,?,?,?,?,?,?)').run('plain.test', 'p', 'rawvalue', Buffer.alloc(0), '/x', 0, 0, 0, 0)
    db.close()
    const rows = readChromiumRowsFromDb(file)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ host: '.example.com', name: 'sid', path: '/', secure: true, httpOnly: true, sameSite: 'lax' })
    expect(rows[0]?.encrypted.equals(enc)).toBe(true)
    expect(rows[1]).toMatchObject({ host: 'plain.test', plain: 'rawvalue', sameSite: 'no_restriction', path: '/x' })
    expect(rows[1]?.encrypted.length).toBe(0)
  })
})

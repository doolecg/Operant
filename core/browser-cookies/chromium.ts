import { createDecipheriv } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { withCookieDbCopy } from './copy'
import type { RawCookie } from './types'

// One row of Chromium's cookies table, value still encrypted.
export interface ChromiumRow {
  host: string
  name: string
  encrypted: Buffer
  // Plain value, used only when `encrypted` is empty (some rows store the value unencrypted here).
  plain: string
  path: string
  secure: boolean
  httpOnly: boolean
  sameSite: RawCookie['sameSite']
  // Microseconds since 1601-01-01 UTC; 0 for a session cookie.
  expiresUtc: number
}

export function mapChromiumSameSite(v: number): RawCookie['sameSite'] {
  if (v === 0) return 'no_restriction'
  if (v === 1) return 'lax'
  if (v === 2) return 'strict'
  return 'unspecified'
}

// Chromium stores expiry as microseconds since 1601-01-01; the Unix epoch is 11644473600 seconds later. 0 means a
// session cookie (no expiry).
export function chromiumEpochToSeconds(microsSince1601: number): number | null {
  if (!microsSince1601 || microsSince1601 <= 0) return null
  return Math.floor(microsSince1601 / 1_000_000 - 11_644_473_600)
}

// The version tag at the front of an encrypted value ('v10', 'v11', 'v20'), or '' for a legacy (DPAPI-wrapped) value.
export function valueVersion(blob: Buffer): string {
  const tag = blob.subarray(0, 3).toString('latin1')
  return tag === 'v10' || tag === 'v11' || tag === 'v20' ? tag : ''
}

// AES-256-GCM, the scheme Chromium uses on Windows (and Linux libsecret) for v10/v11 values: 3-byte tag, 12-byte nonce,
// ciphertext, 16-byte auth tag.
export function decryptAesGcm(blob: Buffer, key: Buffer): string {
  const nonce = blob.subarray(3, 15)
  const tag = blob.subarray(blob.length - 16)
  const ct = blob.subarray(15, blob.length - 16)
  const d = createDecipheriv('aes-256-gcm', key, nonce)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8')
}

// AES-128-CBC with a 16-space IV, the scheme Chromium uses on macOS and on Linux's "peanuts" fallback. The 3-byte
// version tag is stripped first and PKCS#7 padding removed.
export function decryptAesCbc(blob: Buffer, key: Buffer): string {
  const iv = Buffer.alloc(16, 0x20)
  const d = createDecipheriv('aes-128-cbc', key, iv)
  d.setAutoPadding(false)
  let out = Buffer.concat([d.update(blob.subarray(3)), d.final()])
  const pad = out[out.length - 1] ?? 0
  if (pad > 0 && pad <= 16) out = out.subarray(0, out.length - pad)
  return out.toString('utf8')
}

// Reads Chromium's cookies table from an already-copied, unlocked database. Values stay encrypted here; the caller
// decrypts them with the platform key.
export function readChromiumRowsFromDb(dbFile: string): ChromiumRow[] {
  let db: DatabaseSync | null = null
  try {
    db = new DatabaseSync(dbFile, { readOnly: true })
    db.exec('PRAGMA busy_timeout = 2000')
    // expires_utc is microseconds since 1601 and routinely exceeds JS's safe-integer range, so it is read as text.
    const rows = db
      .prepare('SELECT host_key, name, value, encrypted_value, path, is_secure, is_httponly, samesite, CAST(expires_utc AS TEXT) AS expires_utc FROM cookies')
      .all() as unknown as Array<{
      host_key: string
      name: string
      value: string
      encrypted_value: Uint8Array
      path: string
      is_secure: number
      is_httponly: number
      samesite: number
      expires_utc: string
    }>
    return rows.map((r) => ({
      host: r.host_key,
      name: r.name,
      encrypted: Buffer.from(r.encrypted_value),
      plain: typeof r.value === 'string' ? r.value : '',
      path: r.path || '/',
      secure: r.is_secure === 1,
      httpOnly: r.is_httponly === 1,
      sameSite: mapChromiumSameSite(r.samesite),
      expiresUtc: Number(r.expires_utc) || 0,
    }))
  } finally {
    db?.close()
  }
}

// Reads the raw (still-encrypted) rows of a Chromium profile, copying the locked store first.
export async function readChromiumRows(profileDir: string): Promise<ChromiumRow[]> {
  const dbFile = existsSync(join(profileDir, 'Network', 'Cookies')) ? join(profileDir, 'Network', 'Cookies') : join(profileDir, 'Cookies')
  if (!existsSync(dbFile)) return []
  return withCookieDbCopy(dbFile, async (copy) => readChromiumRowsFromDb(copy))
}

// Reads os_crypt.encrypted_key from a Chromium "Local State" file and returns the DPAPI-wrapped key bytes (the
// 'DPAPI' marker stripped), ready to unprotect. Null when absent. The key is never logged.
export function windowsWrappedKey(localStatePath: string): Buffer | null {
  try {
    const raw: unknown = JSON.parse(readFileSync(localStatePath, 'utf8'))
    const b64 = (raw as { os_crypt?: { encrypted_key?: unknown } }).os_crypt?.encrypted_key
    if (typeof b64 !== 'string') return null
    const bytes = Buffer.from(b64, 'base64')
    // The key is prefixed with the ASCII marker "DPAPI".
    return bytes.subarray(0, 5).toString('latin1') === 'DPAPI' ? bytes.subarray(5) : bytes
  } catch {
    return null
  }
}

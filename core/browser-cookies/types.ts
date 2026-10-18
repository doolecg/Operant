// A cookie read from a system browser's store, decrypted to its plain value. Values never leave the main process and
// are never logged.
export interface RawCookie {
  // The domain as the source browser stored it; a leading dot means "and subdomains".
  host: string
  name: string
  value: string
  path: string
  secure: boolean
  httpOnly: boolean
  sameSite: 'unspecified' | 'no_restriction' | 'lax' | 'strict'
  // Epoch seconds, or null for a session cookie (no expiry).
  expires: number | null
}

// The result of reading the default browser's cookies. `cookies` carries plain values and must stay in main/core.
export interface CookieReadResult {
  // True when the default browser is one we can read. When false, `reason` explains why.
  supported: boolean
  // A display name for the browser ('Firefox', 'Google Chrome', …), or '' when none was detected.
  browser: string
  // The profile folder's own name, safe to show (never a full path).
  profile: string
  cookies: RawCookie[]
  // Cookies found but not readable (Chrome 127+/Edge app-bound encryption needs elevation).
  locked: number
  // The store was locked because the browser is running and a copy could not be made.
  needsClose: boolean
  reason?: string
}

// The counts-only shapes that cross IPC live in shared (the IPC contract); re-exported here for convenience.
export type { CookieImportPreview, CookieImportResult } from '../../shared/browser-inspect'

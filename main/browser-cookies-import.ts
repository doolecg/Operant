import { session as electronSession } from 'electron'
import type { RawCookie } from '../core/browser-cookies'
import { cookieUrl } from '../shared/browser-inspect'
import { partitionOf } from '../shared/browser'

// Writes the read cookies into every project's browser partition. A cookie Electron rejects (for example SameSite=None
// without Secure) is skipped and counted. A cookie accepted into at least one partition counts as imported. Values are
// never logged.
export async function importCookiesToCrews(cookies: readonly RawCookie[], crewIds: readonly number[]): Promise<{ imported: number; rejected: number }> {
  if (crewIds.length === 0) return { imported: 0, rejected: cookies.length }
  const sessions = crewIds.map((id) => electronSession.fromPartition(partitionOf(id)))
  let imported = 0
  let rejected = 0
  for (const c of cookies) {
    const domain = c.host.trim()
    const set = {
      url: cookieUrl({ domain, path: c.path, secure: c.secure }),
      name: c.name,
      value: c.value,
      // A leading dot keeps the cookie a domain cookie; without one it is host-only.
      ...(domain.startsWith('.') ? { domain } : {}),
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite,
      ...(c.expires != null ? { expirationDate: c.expires } : {}),
    }
    let ok = false
    for (const ses of sessions) {
      try {
        await ses.cookies.set(set)
        ok = true
      } catch {
        // This partition rejected it; try the rest.
      }
    }
    if (ok) imported++
    else rejected++
  }
  return { imported, rejected }
}

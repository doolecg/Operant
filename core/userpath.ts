import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { runHiddenSync } from './proc'

// An app started by the installer (or from Finder / a desktop launcher) can get a PATH without the user's own entries,
// so claude and opencode look missing. This puts them back: on Windows from the registry, elsewhere from the usual
// per-user install folders that exist.

const WIN_KEYS = ['HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment', 'HKCU\\Environment']

// Pulls the Path value out of `reg query <key> /v Path` output.
export function parseRegPath(output: string): string | null {
  return /^\s*Path\s+REG_(?:EXPAND_)?SZ\s+(.*)$/im.exec(output)?.[1]?.trim() ?? null
}

// Expands %NAME% from env (names are case-insensitive on Windows); unknown names stay as they are.
export function expandWin(value: string, env: NodeJS.ProcessEnv): string {
  const lower = new Map(Object.entries(env).map(([k, v]) => [k.toLowerCase(), v]))
  return value.replace(/%([^%]+)%/g, (m, name: string) => lower.get(name.toLowerCase()) ?? m)
}

// The current PATH followed by every extra entry it lacks, so what the app was started with still wins.
export function mergePath(current: string, extra: string[], platform: NodeJS.Platform): string {
  const sep = platform === 'win32' ? ';' : ':'
  const norm = (d: string) => {
    const t = d.trim().replace(/[\\/]+$/, '')
    return platform === 'win32' ? t.toLowerCase() : t
  }
  const dirs = current.split(sep).filter(Boolean)
  const seen = new Set(dirs.map(norm))
  for (const d of extra) {
    const n = norm(d)
    if (!n || seen.has(n)) continue
    seen.add(n)
    dirs.push(d.trim())
  }
  return dirs.join(sep)
}

function regPath(key: string): string | null {
  const out = runHiddenSync('reg', ['query', key, '/v', 'Path'], { timeoutMs: 3000 })
  return out === null ? null : parseRegPath(out)
}

export function userPathDirs(platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env, home = homedir()): string[] {
  if (platform === 'win32') {
    return WIN_KEYS.flatMap((k) => (regPath(k) ?? '').split(';')).map((d) => expandWin(d, env).trim()).filter(Boolean)
  }
  const dirs = ['.local/bin', '.opencode/bin', '.bun/bin', '.npm-global/bin', '.cargo/bin'].map((d) => join(home, d))
  if (platform === 'darwin') dirs.push('/opt/homebrew/bin', '/usr/local/bin')
  return dirs.filter((d) => existsSync(d))
}

// Adds the user's PATH entries to this process's PATH, so the CLIs and every terminal started afterwards find them.
export function refreshUserPath(env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): void {
  const key = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH'
  env[key] = mergePath(env[key] ?? '', userPathDirs(platform, env), platform)
}

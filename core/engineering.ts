import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// The skill pack (plugin/engineering and plugin/factory) copied into <userData>/engineering so the owner can edit it.
const PLUGINS = ['engineering', 'factory']
const MANIFEST = '.manifest.json'

type Manifest = Record<string, string>

const sha = (file: string): string => createHash('sha256').update(readFileSync(file)).digest('hex')

// Relative paths (forward slashes) of every file under dir.
function walk(dir: string, rel = ''): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name
    if (e.isDirectory()) out.push(...walk(join(dir, e.name), r))
    else if (e.isFile()) out.push(r)
  }
  return out
}

const packFiles = (builtinDir: string): string[] => PLUGINS.flatMap((p) => walk(join(builtinDir, p), p))

function readManifest(userDir: string): Manifest {
  try {
    const m: unknown = JSON.parse(readFileSync(join(userDir, MANIFEST), 'utf8'))
    return m && typeof m === 'object' && !Array.isArray(m) ? (m as Manifest) : {}
  } catch {
    return {}
  }
}

function copyOut(from: string, to: string): void {
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
}

// Brings the user's copy up to date: a missing file is copied, a file the user never edited (it still matches the
// hash recorded at the last install) takes the new built-in, an edited file is left alone.
export function syncPack(builtinDir: string, userDir: string): void {
  const manifest = readManifest(userDir)
  const next: Manifest = { ...manifest }
  for (const rel of packFiles(builtinDir)) {
    const src = join(builtinDir, rel)
    const dest = join(userDir, rel)
    const fresh = sha(src)
    if (!existsSync(dest)) {
      copyOut(src, dest)
      next[rel] = fresh
      continue
    }
    const cur = sha(dest)
    if (cur === fresh) next[rel] = fresh
    else if (manifest[rel] === cur) {
      copyOut(src, dest)
      next[rel] = fresh
    } else if (!manifest[rel]) next[rel] = fresh
  }
  mkdirSync(userDir, { recursive: true })
  writeFileSync(join(userDir, MANIFEST), `${JSON.stringify(next, null, 2)}\n`)
}

// Files whose content no longer matches the last installed built-in version.
export function packStatus(userDir: string): { edited: string[] } {
  const manifest = readManifest(userDir)
  const edited = Object.keys(manifest)
    .filter((rel) => existsSync(join(userDir, rel)) && sha(join(userDir, rel)) !== manifest[rel])
    .sort()
  return { edited }
}

// Overwrites every file from the built-in pack. Edited files are first copied to <userDir>/.backup-<timestamp>/.
export function resetPack(builtinDir: string, userDir: string, now = Date.now()): { backup: string | null } {
  const { edited } = packStatus(userDir)
  let backup: string | null = null
  if (edited.length) {
    backup = join(userDir, `.backup-${now}`)
    for (const rel of edited) copyOut(join(userDir, rel), join(backup, rel))
  }
  const manifest: Manifest = {}
  for (const rel of packFiles(builtinDir)) {
    copyOut(join(builtinDir, rel), join(userDir, rel))
    manifest[rel] = sha(join(builtinDir, rel))
  }
  writeFileSync(join(userDir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`)
  return { backup }
}

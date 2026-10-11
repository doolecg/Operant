import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { ChatImage } from '../shared/claude-chat'

export const SHOT_IMAGE_MAX = 3_000_000
export const SHOT_FILE_MAX = 20 * 1024 * 1024

const MEDIA: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' }

export interface SavedShot {
  path: string
  relPath: string
  image: ChatImage | null
}

export function shotKind(kind: string | undefined): string {
  const k = (kind ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '')
  return k || 'shot'
}

function stamp(now: number): string {
  const d = new Date(now)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

// Copies a test screenshot into <project>/docs/specs/screenshots and reads it back as a chat image.
export function saveScreenshot(opts: { projectDir: string; kind?: string; file: string; now: number }): SavedShot {
  const { file } = opts
  if (!isAbsolute(file)) throw new Error('The screenshot path must be absolute')
  const ext = extname(file).toLowerCase()
  const mediaType = MEDIA[ext]
  if (!mediaType) throw new Error('The screenshot must be a .png, .jpg or .webp file')
  const st = existsSync(file) ? statSync(file) : null
  if (!st?.isFile()) throw new Error(`Screenshot not found: ${file}`)
  if (st.size >= SHOT_FILE_MAX) throw new Error('The screenshot is over 20 MB')

  const dir = join(opts.projectDir, 'docs', 'specs', 'screenshots')
  mkdirSync(dir, { recursive: true })
  const ignore = join(dir, '.gitignore')
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n')

  const rel = relative(resolve(dir), resolve(file))
  const inside = rel !== '' && !rel.startsWith('..') && !isAbsolute(rel) && !rel.includes(sep)
  let dest = resolve(file)
  if (!inside) {
    const base = `${shotKind(opts.kind)}-${stamp(opts.now)}`
    let name = `${base}${ext}`
    for (let n = 2; existsSync(join(dir, name)); n++) name = `${base}-${n}${ext}`
    dest = join(dir, name)
    copyFileSync(file, dest)
  }
  const data = readFileSync(dest).toString('base64')
  return {
    path: dest,
    relPath: relative(opts.projectDir, dest).split(sep).join('/'),
    image: data.length > SHOT_IMAGE_MAX ? null : { mediaType, dataUrl: `data:${mediaType};base64,${data}` },
  }
}

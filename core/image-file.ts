import { readFileSync, realpathSync, statSync } from 'node:fs'
import { extname, isAbsolute, relative, resolve } from 'node:path'
import type { ChatImage } from '../shared/claude-chat'

// Images a project file can be read back as (the Agents panel's artifact viewer). The size cap keeps the data URL small.
export const IMAGE_FILE_MAX = 8 * 1024 * 1024

const MEDIA: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

// Reads an image file of the project as a data URL. The path (absolute, or relative to the project folder) is resolved
// through symlinks and must stay inside the folder, so nothing outside the project can be read. Throws a short message.
export function readProjectImage(root: string, path: string): ChatImage {
  const mediaType = MEDIA[extname(path).toLowerCase()]
  if (!mediaType) throw new Error('Only a png, jpg, gif, webp or svg image can be shown')
  let file: string
  try {
    const realRoot = realpathSync(root)
    file = realpathSync(isAbsolute(path) ? resolve(path) : resolve(realRoot, path))
    const rel = relative(process.platform === 'win32' ? realRoot.toLowerCase() : realRoot, process.platform === 'win32' ? file.toLowerCase() : file)
    if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) throw new Error('outside')
  } catch {
    throw new Error('That image is outside the project folder, or missing')
  }
  const st = statSync(file)
  if (!st.isFile()) throw new Error('That path is not a file')
  if (st.size > IMAGE_FILE_MAX) throw new Error('That image is over 8 MB')
  return { mediaType, dataUrl: `data:${mediaType};base64,${readFileSync(file).toString('base64')}` }
}

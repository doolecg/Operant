// A read-only loopback server for documents the browser tile shows. The browser refuses file: addresses, so an HTML or
// Markdown file of a project is served here instead: http://127.0.0.1:<port>/d/<token>/<crewId>/<path>, and a document
// held in memory (a presented plan) at /p/<token>/<id>. The token is random per run; paths are confined to the
// project folder. Markdown is rendered to HTML here.
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { readFileSync, realpathSync, statSync } from 'node:fs'
import { extname, sep } from 'node:path'
import { MARKDOWN_CSP, renderMarkdownPage } from './docs-render'

export const DOC_MAX_BYTES = 10 * 1024 * 1024
const MEMORY_MAX = 50

// Documents plus the static files an HTML artifact needs. Nothing else is ever served.
const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

export const docContentType = (path: string): string | null => TYPES[extname(path).toLowerCase()] ?? null

export type DocRoute = { kind: 'file'; crewId: number; segments: string[] } | { kind: 'memory'; id: string }

const sameToken = (a: string, b: string): boolean => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

const BAD_SEGMENT = /[\\/\0]/

// Splits a request path into its route, or null when the token is wrong or the path is not one of ours. Every segment
// is decoded once and must not hold a separator, a NUL, or be empty, "." or "..".
export function parseDocPath(rawPath: string, token: string): DocRoute | null {
  const parts = rawPath.split('/')
  if (parts[0] !== '' || parts.length < 4) return null
  const [, kind, given, ...rest] = parts
  if (!given || !sameToken(given, token)) return null
  const segments: string[] = []
  for (const raw of rest) {
    let s: string
    try {
      s = decodeURIComponent(raw)
    } catch {
      return null
    }
    if (s === '' || s === '.' || s === '..' || BAD_SEGMENT.test(s)) return null
    segments.push(s)
  }
  if (kind === 'p' && segments.length === 1) return { kind: 'memory', id: segments[0]! }
  if (kind === 'd' && segments.length >= 2 && /^\d{1,9}$/.test(segments[0]!)) return { kind: 'file', crewId: Number(segments[0]), segments: segments.slice(1) }
  return null
}

const within = (root: string, file: string): boolean => {
  const win = process.platform === 'win32'
  const a = win ? root.toLowerCase() : root
  const b = win ? file.toLowerCase() : file
  return b === a || b.startsWith(a.endsWith(sep) ? a : a + sep)
}

// The real path of a servable file inside the project folder, or null: a wrong extension, a missing file, a symlink or
// junction that leads out of the folder, a directory, or a file over the size cap.
export function resolveDocFile(root: string, segments: readonly string[], maxBytes: number = DOC_MAX_BYTES): { file: string; size: number } | null {
  if (segments.length === 0 || segments.some((s) => s === '' || s === '.' || s === '..' || BAD_SEGMENT.test(s) || /^[a-z]:/i.test(s))) return null
  if (!docContentType(segments[segments.length - 1]!)) return null
  try {
    const realRoot = realpathSync(root)
    const file = realpathSync([realRoot, ...segments].join(sep))
    if (!within(realRoot, file) || file === realRoot) return null
    if (!docContentType(file)) return null
    const st = statSync(file)
    if (!st.isFile() || st.size > maxBytes) return null
    return { file, size: st.size }
  } catch {
    return null
  }
}

export interface DocsServerOptions {
  // A project's folder; null when the project is unknown.
  folderOf: (crewId: number) => string | null
  maxBytes?: number
}

export class DocsServer {
  readonly token = randomBytes(18).toString('hex')
  private server: Server | null = null
  private starting: Promise<number> | null = null
  private readonly memory = new Map<string, { title: string; md: string }>()
  private nextId = 1

  constructor(private readonly o: DocsServerOptions) {}

  // Listens on first use.
  private port(): Promise<number> {
    if (this.server?.listening) return Promise.resolve((this.server.address() as AddressInfo).port)
    this.starting ??= new Promise<number>((resolveStart, reject) => {
      const server = createServer((req, res) => this.handle(req, res))
      server.once('error', (e) => {
        this.starting = null
        reject(e)
      })
      server.listen(0, '127.0.0.1', () => {
        this.server = server
        resolveStart((server.address() as AddressInfo).port)
      })
    })
    return this.starting
  }

  // The address of a project file (path relative to the project folder, forward slashes).
  async urlFor(crewId: number, relPath: string): Promise<string> {
    const port = await this.port()
    return `http://127.0.0.1:${String(port)}/d/${this.token}/${String(crewId)}/${relPath.split('/').map(encodeURIComponent).join('/')}`
  }

  // The address of a Markdown document held in memory (the oldest ones are dropped past a cap).
  async urlForMemory(title: string, md: string): Promise<string> {
    const port = await this.port()
    const id = String(this.nextId++)
    this.memory.set(id, { title, md })
    if (this.memory.size > MEMORY_MAX) this.memory.delete(this.memory.keys().next().value as string)
    return `http://127.0.0.1:${String(port)}/p/${this.token}/${id}`
  }

  async close(): Promise<void> {
    const s = this.server
    this.server = null
    this.starting = null
    if (s) await new Promise<void>((r) => s.close(() => r()))
  }

  private send(res: ServerResponse, status: number, type: string, body: string | Buffer, head: boolean, csp?: string): void {
    res.writeHead(status, {
      'Content-Type': type,
      'Content-Length': Buffer.byteLength(body),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      ...(csp ? { 'Content-Security-Policy': csp } : {}),
    })
    res.end(head ? undefined : body)
  }

  private handle(req: IncomingMessage, res: ServerResponse): void {
    const head = req.method === 'HEAD'
    if (req.method !== 'GET' && !head) {
      res.writeHead(405, { Allow: 'GET, HEAD', 'X-Content-Type-Options': 'nosniff' })
      res.end()
      return
    }
    const route = parseDocPath((req.url ?? '').split(/[?#]/)[0] ?? '', this.token)
    const notFound = () => this.send(res, 404, 'text/plain; charset=utf-8', 'Not found', head)
    if (!route) return notFound()
    if (route.kind === 'memory') {
      const doc = this.memory.get(route.id)
      return doc ? this.send(res, 200, 'text/html; charset=utf-8', renderMarkdownPage(doc.title, doc.md), head, MARKDOWN_CSP) : notFound()
    }
    const root = this.o.folderOf(route.crewId)
    const found = root ? resolveDocFile(root, route.segments, this.o.maxBytes) : null
    if (!found) return notFound()
    try {
      const data = readFileSync(found.file)
      if (extname(found.file).toLowerCase() === '.md') {
        const name = route.segments[route.segments.length - 1]!
        this.send(res, 200, 'text/html; charset=utf-8', renderMarkdownPage(name, data.toString('utf8')), head, MARKDOWN_CSP)
      } else {
        this.send(res, 200, docContentType(found.file)!, data, head)
      }
    } catch {
      notFound()
    }
  }
}

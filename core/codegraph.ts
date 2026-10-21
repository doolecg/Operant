import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import type { CodeGraph as CodeGraphClass } from '@colbymchenry/codegraph'
import type { IndexStatus } from '../shared/types'
import { runHidden, type RunResult } from './proc'

export type { IndexStatus }

type CodeGraphStatic = typeof CodeGraphClass

export const CODEGRAPH_MISSING = 'CodeGraph is not installed. Install it from Settings, Install.'

// Loaded lazily, and a missing library only disables indexing, not the app. In development the SDK comes from the
// repo's node_modules; packaged builds use the user's global install (null until one is found). Only a success is
// kept, so a CodeGraph installed while Operant runs is picked up on the next call.
let loaded: CodeGraphStatic | null = null
function load(libraryPath?: string | null): CodeGraphStatic {
  if (loaded) return loaded
  if (libraryPath === null) throw new Error(CODEGRAPH_MISSING)
  const req = createRequire(import.meta.url ?? __filename)
  loaded = (req(libraryPath ?? '@colbymchenry/codegraph') as { CodeGraph: CodeGraphStatic }).CodeGraph
  return loaded
}

// The SDK of a global `npm i -g @colbymchenry/codegraph`. The returned getter is null until npm reports a global
// root holding it; while null, each call looks again in the background.
export function globalCodegraph(
  run: () => Promise<RunResult> = () => runHidden('npm', ['root', '-g'], { shell: process.platform === 'win32', timeoutMs: 15_000, quiet: true }),
  exists: (p: string) => boolean = existsSync,
): () => string | null {
  let found: string | null = null
  let looking = false
  const look = (): void => {
    if (looking) return
    looking = true
    void run().then((r) => {
      looking = false
      const dir = r.code === 0 ? join(r.stdout.trim(), '@colbymchenry', 'codegraph') : ''
      if (dir && exists(join(dir, 'package.json'))) found = dir
    })
  }
  look()
  return () => {
    if (found === null) look()
    return found
  }
}

// One CodeGraph index per crew folder. Indexing only happens when asked, because
// creating a .codegraph/ folder in someone's project is their decision.
export class CrewIndexes {
  private readonly indexing = new Set<string>()

  constructor(private readonly library?: () => string | null) {}

  private get libraryPath(): string | null | undefined {
    return this.library?.()
  }

  status(folder: string): IndexStatus {
    const base = { initialized: false, indexing: this.indexing.has(folder), files: 0, symbols: 0, edges: 0 }
    try {
      const CodeGraph = load(this.libraryPath)
      if (!CodeGraph.isInitialized(folder)) return base
      const g = CodeGraph.openSync(folder, { readOnly: true })
      try {
        const s = g.getStats()
        return { ...base, initialized: true, files: s.fileCount, symbols: s.nodeCount, edges: s.edgeCount }
      } finally {
        g.close()
      }
    } catch (err) {
      return { ...base, error: err instanceof Error ? err.message : String(err) }
    }
  }

  // A compact list of the symbols matching the query ("name (kind) file:line - signature"), from the existing index only.
  // null when the folder has no index; never indexes.
  symbols(folder: string, query: string, limit = 40): string[] | null {
    const CodeGraph = load(this.libraryPath)
    if (!CodeGraph.isInitialized(folder)) return null
    const g = CodeGraph.openSync(folder, { readOnly: true })
    try {
      if (g.getStats().fileCount === 0) return null
      const words = query.replace(/[^\p{L}\p{N}_ ]+/gu, ' ').split(/\s+/).filter((w) => w.length > 2).slice(0, 12).join(' ')
      if (!words) return []
      return g.searchNodes(words, { limit }).map(({ node: n }) => {
        const role = (n.signature ?? n.docstring ?? '').split(/\r?\n/)[0]!.trim().slice(0, 100)
        return `${n.name} (${n.kind}) ${n.filePath}:${n.startLine}${role ? ` - ${role}` : ''}`
      })
    } finally {
      g.close()
    }
  }

  async index(folder: string): Promise<IndexStatus> {
    if (this.indexing.has(folder)) return this.status(folder)
    this.indexing.add(folder)
    try {
      const CodeGraph = load(this.libraryPath)
      const g = CodeGraph.isInitialized(folder) ? await CodeGraph.open(folder) : await CodeGraph.init(folder)
      try {
        await (CodeGraph.isInitialized(folder) && g.getStats().fileCount > 0 ? g.sync() : g.indexAll())
      } finally {
        g.close()
      }
    } finally {
      this.indexing.delete(folder)
    }
    return this.status(folder)
  }

  // A forced full rebuild: the existing index is discarded and every file is indexed again. Runs only when asked.
  async rebuild(folder: string): Promise<IndexStatus> {
    if (this.indexing.has(folder)) throw new Error('This project is already being indexed')
    this.indexing.add(folder)
    try {
      const CodeGraph = load(this.libraryPath)
      const g = await CodeGraph.recreate(folder)
      try {
        await g.indexAll()
      } finally {
        g.close()
      }
    } finally {
      this.indexing.delete(folder)
    }
    return this.status(folder)
  }
}

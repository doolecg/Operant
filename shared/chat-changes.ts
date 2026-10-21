import { diffFromInput, type ChatItem } from './claude-chat'

// Pure logic behind the Chat view's "changed files" card. No React here so it can be tested.

const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit'])

export interface FileChange {
  path: string
  added: number
  removed: number
}

export const normalizePath = (p: string): string => p.replace(/\\/g, '/')

// The files the finished edit calls of a turn changed, with the edits to one file summed into one entry. A failed, denied or
// interrupted call changed nothing and is skipped. Counts come from the tool's diff: the result's patch when it has one,
// else the input's whole old and new text, so an edit that rewrites a line counts it as removed plus added (approximate).
export function collectChanges(items: ChatItem[]): FileChange[] {
  const byPath = new Map<string, FileChange>()
  for (const it of items) {
    if (it.kind !== 'tool' || it.status !== 'done' || !EDIT_TOOLS.has(it.name)) continue
    const d = it.diff ?? diffFromInput(it.name, it.input)
    if (!d?.path) continue
    const path = normalizePath(d.path)
    const have = byPath.get(path)
    if (have) {
      have.added += d.added
      have.removed += d.removed
    } else byPath.set(path, { path, added: d.added, removed: d.removed })
  }
  return [...byPath.values()]
}

export const sumChanges = (files: Array<Pick<FileChange, 'added' | 'removed'>>): { added: number; removed: number } =>
  files.reduce((t, f) => ({ added: t.added + f.added, removed: t.removed + f.removed }), { added: 0, removed: 0 })

// 999 stays 999; 1234 becomes "1.2k", 12000 "12k", 1500000 "1.5m".
export function compactCount(n: number): string {
  if (n < 1000) return String(n)
  const unit = (v: number, suffix: string) => `${Number.isInteger(v) ? v : v.toFixed(1)}${suffix}`
  const k = Math.round(n / 100) / 10
  if (k < 1000) return unit(k, 'k')
  return unit(Math.round(n / 100_000) / 10, 'm')
}

export const changedFilesTitle = (count: number): string => `${count} changed ${count === 1 ? 'file' : 'files'}`

export interface FileNode {
  type: 'file'
  // Unique across the tree: the path from the tree's root.
  id: string
  name: string
  // The full path as the tool reported it (slashes normalised).
  path: string
  added: number
  removed: number
}

export interface DirNode {
  type: 'dir'
  id: string
  // "renderer/src" when single-child folders were joined.
  name: string
  added: number
  removed: number
  files: number
  children: TreeNode[]
}

export type TreeNode = FileNode | DirNode

const segmentsOf = (path: string): string[] => normalizePath(path).split('/').filter(Boolean)

// The folders every path shares (a project's absolute prefix); the file name is never part of it.
function commonDir(paths: string[][]): number {
  const first = paths[0]
  if (!first) return 0
  let n = first.length - 1
  for (const p of paths) {
    let i = 0
    while (i < n && i < p.length - 1 && p[i] === first[i]) i++
    n = i
  }
  return n
}

// The changes as a folder tree below their common folder (or below `root` when given and every path is inside it).
// Folders sort before files, each by name; a folder whose only child is a folder joins it ("renderer/src").
export function buildTree(files: FileChange[], root?: string): TreeNode[] {
  const rootSegs = root ? segmentsOf(root) : []
  const all = files.map((f) => segmentsOf(f.path))
  const inRoot = rootSegs.length > 0 && all.every((p) => p.length > rootSegs.length && rootSegs.every((s, i) => p[i] === s))
  const skip = inRoot ? rootSegs.length : commonDir(all)

  interface Draft {
    dirs: Map<string, Draft>
    files: FileNode[]
  }
  const top: Draft = { dirs: new Map(), files: [] }
  files.forEach((f, i) => {
    const segs = all[i]!.slice(skip)
    const name = segs.pop() ?? f.path
    let at = top
    for (const s of segs) {
      let next = at.dirs.get(s)
      if (!next) at.dirs.set(s, (next = { dirs: new Map(), files: [] }))
      at = next
    }
    at.files.push({ type: 'file', id: [...segs, name].join('/'), name, path: f.path, added: f.added, removed: f.removed })
  })

  const finish = (d: Draft, prefix: string[]): TreeNode[] => {
    const dirs: DirNode[] = []
    for (const [name, child] of [...d.dirs].sort((a, b) => a[0].localeCompare(b[0]))) {
      let names = [name]
      let node = child
      while (node.files.length === 0 && node.dirs.size === 1) {
        const [[n, only]] = [...node.dirs] as [[string, Draft]]
        names = [...names, n]
        node = only
      }
      const kids = finish(node, [...prefix, ...names])
      const t = sumChanges(kids)
      dirs.push({ type: 'dir', id: [...prefix, ...names].join('/'), name: names.join('/'), ...t, files: kids.reduce((n, k) => n + (k.type === 'file' ? 1 : k.files), 0), children: kids })
    }
    return [...dirs, ...d.files.sort((a, b) => a.name.localeCompare(b.name))]
  }
  return finish(top, [])
}

export function dirIds(nodes: TreeNode[]): string[] {
  return nodes.flatMap((n) => (n.type === 'dir' ? [n.id, ...dirIds(n.children)] : []))
}

// Few files show open; a long list starts collapsed.
export const EXPAND_ALL_UP_TO = 3

export const initiallyOpen = (fileCount: number, nodes: TreeNode[]): string[] => (fileCount <= EXPAND_ALL_UP_TO ? dirIds(nodes) : [])

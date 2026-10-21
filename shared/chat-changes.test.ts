import { describe, expect, it } from 'vitest'
import type { ChatItem, DiffFile, ToolItem } from './claude-chat'
import { buildTree, changedFilesTitle, collectChanges, compactCount, dirIds, initiallyOpen, sumChanges, type DirNode, type FileChange } from './chat-changes'

const tool = (id: string, over: Partial<ToolItem> = {}): ChatItem => ({
  kind: 'tool',
  id,
  parent: null,
  name: 'Edit',
  input: {},
  partial: '',
  summary: '',
  status: 'done',
  result: null,
  diff: null,
  background: false,
  startedAt: 1000,
  endedAt: 2000,
  ...over,
})
const diff = (path: string, added: number, removed: number, created = false): DiffFile => ({ path, created, added, removed, hunks: [] })
const change = (path: string, added = 1, removed = 0): FileChange => ({ path, added, removed })

describe('collectChanges', () => {
  it('reads the counts from a tool diff', () => {
    expect(collectChanges([tool('a', { diff: diff('/p/a.ts', 3, 1) })])).toEqual([{ path: '/p/a.ts', added: 3, removed: 1 }])
  })

  it('builds the counts from the input when the item has no diff', () => {
    const edit = tool('a', { name: 'Edit', input: { file_path: '/p/a.ts', old_string: 'one\ntwo', new_string: 'one\ntwo\nthree' } })
    expect(collectChanges([edit])).toEqual([{ path: '/p/a.ts', added: 3, removed: 2 }])
    const write = tool('b', { name: 'Write', input: { file_path: '/p/b.ts', content: 'x\ny\nz' } })
    expect(collectChanges([write])).toEqual([{ path: '/p/b.ts', added: 3, removed: 0 }])
    const multi = tool('c', { name: 'MultiEdit', input: { file_path: '/p/c.ts', edits: [{ old_string: 'a', new_string: 'b' }, { old_string: 'c\nd', new_string: 'e' }] } })
    expect(collectChanges([multi])).toEqual([{ path: '/p/c.ts', added: 2, removed: 3 }])
  })

  it('sums several edits to one file, ignoring slash style', () => {
    const items = [tool('a', { diff: diff('C:\\p\\a.ts', 2, 1) }), tool('b', { diff: diff('C:/p/a.ts', 5, 4) })]
    expect(collectChanges(items)).toEqual([{ path: 'C:/p/a.ts', added: 7, removed: 5 }])
  })

  it('skips failed, denied, interrupted and unfinished calls and tools that do not edit', () => {
    const d = diff('/p/a.ts', 1, 1)
    const items = [
      tool('a', { status: 'failed', diff: d }),
      tool('b', { status: 'denied', diff: d }),
      tool('c', { status: 'interrupted', diff: d }),
      tool('d', { status: 'running', diff: d }),
      tool('e', { name: 'Read', diff: d }),
      tool('f', { name: 'Bash', input: { command: 'ls' } }),
      tool('g', { name: 'Edit', input: {} }),
    ]
    expect(collectChanges(items)).toEqual([])
  })

  it('counts NotebookEdit and keeps the order the files were first changed', () => {
    const items = [tool('a', { name: 'NotebookEdit', input: { notebook_path: '/p/n.ipynb', new_source: 'x' } }), tool('b', { diff: diff('/p/a.ts', 1, 0) })]
    expect(collectChanges(items).map((f) => f.path)).toEqual(['/p/n.ipynb', '/p/a.ts'])
  })
})

describe('compactCount', () => {
  it('prints small numbers whole and larger ones as k and m', () => {
    expect(compactCount(0)).toBe('0')
    expect(compactCount(999)).toBe('999')
    expect(compactCount(1000)).toBe('1k')
    expect(compactCount(1234)).toBe('1.2k')
    expect(compactCount(12_000)).toBe('12k')
    expect(compactCount(865_400)).toBe('865.4k')
    expect(compactCount(999_990)).toBe('1m')
    expect(compactCount(1_500_000)).toBe('1.5m')
  })
})

describe('changedFilesTitle', () => {
  it('uses the singular for one file', () => {
    expect(changedFilesTitle(1)).toBe('1 changed file')
    expect(changedFilesTitle(16)).toBe('16 changed files')
  })
})

describe('buildTree', () => {
  const files = [
    change('/r/core/a.ts', 10, 2),
    change('/r/core/b.ts', 3, 1),
    change('/r/main/m.ts', 4, 0),
    change('/r/renderer/src/x.tsx', 20, 5),
    change('/r/renderer/src/y.tsx', 17, 23),
    change('/r/shared/s.ts', 24, 0),
  ]

  it('groups by folder below the shared project path with totals', () => {
    const tree = buildTree(files)
    expect(tree.map((n) => n.type === 'dir' && [n.name, n.added, n.removed, n.files])).toEqual([
      ['core', 13, 3, 2],
      ['main', 4, 0, 1],
      ['renderer/src', 37, 28, 2],
      ['shared', 24, 0, 1],
    ])
  })

  it('joins single-folder chains but keeps a folder that holds a file and a folder', () => {
    const tree = buildTree([change('/r/a/b/c/f.ts'), change('/r/a/b/g.ts'), change('/r/z.ts')])
    const a = tree[0] as DirNode
    expect(a.name).toBe('a/b')
    expect(a.id).toBe('a/b')
    expect(a.children.map((n) => n.name)).toEqual(['c', 'g.ts'])
    expect(tree[1]).toMatchObject({ type: 'file', name: 'z.ts', path: '/r/z.ts' })
  })

  it('lists folders before files and sorts each by name', () => {
    const tree = buildTree([change('/r/b.ts'), change('/r/z/q.ts'), change('/r/a.ts'), change('/r/m/q.ts')])
    expect(tree.map((n) => n.name)).toEqual(['m', 'z', 'a.ts', 'b.ts'])
  })

  it('shows one file as a plain row and strips Windows drive prefixes', () => {
    expect(buildTree([change('C:/Users/me/p/core/a.ts')])).toMatchObject([{ type: 'file', name: 'a.ts' }])
    const two = buildTree([change('C:\\p\\core\\a.ts'), change('C:\\p\\main\\b.ts')])
    expect(two.map((n) => n.name)).toEqual(['core', 'main'])
  })

  it('cuts at a given project root, even when every change is in one folder', () => {
    const tree = buildTree([change('/r/core/a.ts'), change('/r/core/b.ts')], '/r')
    expect(tree).toMatchObject([{ type: 'dir', name: 'core', files: 2 }])
  })

  it('falls back to the common folder when a change is outside the root', () => {
    const tree = buildTree([change('/r/core/a.ts'), change('/other/b.ts')], '/r')
    expect(tree.map((n) => n.name)).toEqual(['other', 'r/core'])
  })

  it('totals match the sum of the files', () => {
    expect(sumChanges(files)).toEqual({ added: 78, removed: 31 })
  })
})

describe('initiallyOpen', () => {
  it('opens every folder for three files or fewer and none above that', () => {
    const three = buildTree([change('/r/a/x.ts'), change('/r/b/y.ts'), change('/r/b/z/w.ts')])
    expect(initiallyOpen(3, three)).toEqual(dirIds(three))
    expect(initiallyOpen(3, three)).toEqual(['a', 'b', 'b/z'])
    expect(initiallyOpen(4, three)).toEqual([])
  })
})

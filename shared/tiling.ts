// Pure port of the 2.8.2 dwindle tree (renderer.js 134-260). A leaf is a tile; a split places `a` and `b` side by side
// ('h') or stacked ('v'). Nothing here mutates its input. `gap` is the space between two tiles (2.8.2: gapsIn * 2).

export type TileNode = { tile: string } | { split: 'h' | 'v'; ratio: number; a: TileNode; b: TileNode }
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}
export type TileLayout = 'dwindle' | 'master'

export const MIN_RATIO = 0.1
export const MAX_RATIO = 0.9

type Split = Extract<TileNode, { split: 'h' | 'v' }>

const isLeaf = (n: TileNode): n is { tile: string } => 'tile' in n

// The tile ids in tree order (a before b).
export function tileIds(tree: TileNode | null, out: string[] = []): string[] {
  if (!tree) return out
  if (isLeaf(tree)) out.push(tree.tile)
  else {
    tileIds(tree.a, out)
    tileIds(tree.b, out)
  }
  return out
}

export const hasTile = (tree: TileNode | null, tile: string): boolean => tileIds(tree).includes(tile)

export interface SplitHandle {
  // Which child to take at each step from the root to the split.
  path: ('a' | 'b')[]
  split: 'h' | 'v'
  // The gap strip between the two children.
  rect: Rect
  // The whole rect of the split.
  parent: Rect
  ratio: number
}

function rects(n: TileNode | null, r: Rect, gap: number, out: Map<string, Rect>, handles?: SplitHandle[], path: ('a' | 'b')[] = []): Map<string, Rect> {
  if (!n) return out
  if (isLeaf(n)) {
    out.set(n.tile, r)
    return out
  }
  if (n.split === 'h') {
    const w1 = (r.w - gap) * n.ratio
    handles?.push({ path, split: 'h', rect: { x: r.x + w1, y: r.y, w: gap, h: r.h }, parent: r, ratio: n.ratio })
    rects(n.a, { x: r.x, y: r.y, w: w1, h: r.h }, gap, out, handles, [...path, 'a'])
    rects(n.b, { x: r.x + w1 + gap, y: r.y, w: r.w - w1 - gap, h: r.h }, gap, out, handles, [...path, 'b'])
  } else {
    const h1 = (r.h - gap) * n.ratio
    handles?.push({ path, split: 'v', rect: { x: r.x, y: r.y + h1, w: r.w, h: gap }, parent: r, ratio: n.ratio })
    rects(n.a, { x: r.x, y: r.y, w: r.w, h: h1 }, gap, out, handles, [...path, 'a'])
    rects(n.b, { x: r.x, y: r.y + h1 + gap, w: r.w, h: r.h - h1 - gap }, gap, out, handles, [...path, 'b'])
  }
  return out
}

// One handle per split in the tree (parents before children), for resizing by dragging the gap.
export function splitHandles(tree: TileNode | null, area: Rect, gap: number): SplitHandle[] {
  const handles: SplitHandle[] = []
  rects(tree, area, gap, new Map(), handles)
  return handles
}

const clampRatio = (ratio: number) => (Number.isFinite(ratio) ? Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio)) : 0.5)

// Sets the ratio of the split at `path` (clamped to 0.1-0.9). An unknown path leaves the tree as it was.
export function setRatioAt(tree: TileNode, path: ('a' | 'b')[], ratio: number): TileNode {
  if (isLeaf(tree)) return tree
  const [head, ...rest] = path
  if (head === undefined) return { ...tree, ratio: clampRatio(ratio) }
  return head === 'a' ? { ...tree, a: setRatioAt(tree.a, rest, ratio) } : { ...tree, b: setRatioAt(tree.b, rest, ratio) }
}

// Swaps the places of two tiles. Anything else is returned unchanged.
export function swapTiles(tree: TileNode, a: string, b: string): TileNode {
  if (a === b || !hasTile(tree, a) || !hasTile(tree, b)) return tree
  const swap = (n: TileNode): TileNode =>
    isLeaf(n) ? (n.tile === a ? { tile: b } : n.tile === b ? { tile: a } : n) : { ...n, a: swap(n.a), b: swap(n.b) }
  return swap(tree)
}

// Rectangles per tile. 'master': the first tile in tree order takes the left pane (width mfact), the rest stack right.
export function tileRects(tree: TileNode | null, area: Rect, layout: TileLayout, mfact: number, gap: number): Map<string, Rect> {
  if (layout !== 'master') return rects(tree, area, gap, new Map())
  const list = tileIds(tree)
  const out = new Map<string, Rect>()
  if (list.length === 1) out.set(list[0]!, area)
  if (list.length < 2) return out
  const mw = (area.w - gap) * mfact
  out.set(list[0]!, { x: area.x, y: area.y, w: mw, h: area.h })
  const rest = list.slice(1)
  const h = (area.h - gap * (rest.length - 1)) / rest.length
  rest.forEach((t, k) => out.set(t, { x: area.x + mw + gap, y: area.y + k * (h + gap), w: area.w - mw - gap, h }))
  return out
}

function replaceLeaf(n: TileNode, tile: string, repl: TileNode): TileNode {
  if (isLeaf(n)) return n.tile === tile ? repl : n
  return { ...n, a: replaceLeaf(n.a, tile, repl), b: replaceLeaf(n.b, tile, repl) }
}

// Splits `target` (else the last tile) to make room: side by side when the target is wider than ~0.9x its height,
// otherwise stacked. A tile already in the tree is returned unchanged.
export function insertTile(tree: TileNode | null, tile: string, target: string | null, area: Rect, gap: number): TileNode {
  if (!tree) return { tile }
  const ids = tileIds(tree)
  if (ids.includes(tile)) return tree
  const t = target !== null && ids.includes(target) ? target : ids[ids.length - 1]!
  const r = rects(tree, area, gap, new Map()).get(t)!
  const split: TileNode = { split: r.w >= r.h * 0.9 ? 'h' : 'v', ratio: 0.5, a: { tile: t }, b: { tile } }
  return replaceLeaf(tree, t, split)
}

// Removes a tile; its sibling takes the parent's place. null when the tree becomes empty.
export function removeTile(tree: TileNode | null, tile: string): TileNode | null {
  if (!tree) return null
  if (isLeaf(tree)) return tree.tile === tile ? null : tree
  if (isLeaf(tree.a) && tree.a.tile === tile) return tree.b
  if (isLeaf(tree.b) && tree.b.tile === tile) return tree.a
  return { ...tree, a: removeTile(tree.a, tile)!, b: removeTile(tree.b, tile)! }
}

// Applies `fn` to the split that directly holds `tile`.
function onParent(n: TileNode, tile: string, fn: (s: Split) => TileNode): TileNode {
  if (isLeaf(n)) return n
  if ((isLeaf(n.a) && n.a.tile === tile) || (isLeaf(n.b) && n.b.tile === tile)) return fn(n)
  return { ...n, a: onParent(n.a, tile, fn), b: onParent(n.b, tile, fn) }
}

// Flips the tile's parent split between side by side and stacked.
export function toggleSplit(tree: TileNode, tile: string): TileNode {
  return onParent(tree, tile, (s) => ({ ...s, split: s.split === 'h' ? 'v' : 'h' }))
}

// Sets the share the first child of the tile's parent split takes (clamped to 0.1-0.9).
export function setRatio(tree: TileNode, tile: string, ratio: number): TileNode {
  const r = clampRatio(ratio)
  return onParent(tree, tile, (s) => ({ ...s, ratio: r }))
}

// Swaps the tile with the first tile in tree order, so it takes the master pane.
export function promoteTile(tree: TileNode, tile: string): TileNode {
  const first = tileIds(tree)[0]
  if (first === undefined || first === tile || !hasTile(tree, tile)) return tree
  const swap = (n: TileNode): TileNode =>
    isLeaf(n) ? (n.tile === tile ? { tile: first } : n.tile === first ? { tile } : n) : { ...n, a: swap(n.a), b: swap(n.b) }
  return swap(tree)
}

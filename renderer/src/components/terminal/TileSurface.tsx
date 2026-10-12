import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { insertTile, removeTile, setRatioAt, splitHandles, swapTiles, tileIds, tileRects, toggleSplit, type Rect, type TileNode } from '@shared/tiling'
import { cn } from '@/lib/utils'
import { matches, matchesMouseEvent } from '@/lib/keys'
import { useSaveSettings, useSettings } from '@/lib/queries'
import { TileFrame } from './TileFrame'
import type { TileInfo } from './useProjectTiles'

// The tree per project, kept while the app runs so switching projects and back keeps the arrangement.
const trees = new Map<number, TileNode | null>()

// The master pane's share of the width per project, kept alongside the trees.
const mfacts = new Map<number, number>()

const MASTER_FACTOR = 0.55
const MIN_MFACT = 0.2
const MAX_MFACT = 0.8
const KEY_STEP = 24
// The smallest hit area of a gap handle, so a 0 or 2px gap can still be grabbed.
const HANDLE_HIT = 10
// How far the pointer must travel before a press on the move handle becomes a drag.
const MOVE_THRESHOLD = 4

interface Handle {
  key: string
  // The split's path in the tree; null is the master pane's divider.
  path: ('a' | 'b')[] | null
  split: 'h' | 'v'
  rect: Rect
  parent: Rect
  ratio: number
}

// The strip over the gap between two tiles: drag it (or use the arrow keys, Shift for bigger steps; Home or a double
// click resets) to resize the neighbours. The pointer position gives the ratio against the split's whole rect.
function GapHandle({ h, gap, box, onRatio, onReset, onActive }: { h: Handle; gap: number; box: RefObject<HTMLDivElement | null>; onRatio: (ratio: number) => void; onReset: () => void; onActive: (on: boolean) => void }) {
  const [active, setActive] = useState(false)
  const horizontal = h.split === 'h'
  const span = (horizontal ? h.parent.w : h.parent.h) - gap || 1
  const t = Math.max(gap, HANDLE_HIT)
  const style = horizontal
    ? { left: h.rect.x + gap / 2 - t / 2, top: h.rect.y, width: t, height: h.rect.h }
    : { left: h.rect.x, top: h.rect.y + gap / 2 - t / 2, width: h.rect.w, height: t }
  const set = (on: boolean) => {
    setActive(on)
    onActive(on)
  }
  const move = (e: PointerEvent) => {
    if (!active) return
    const b = box.current?.getBoundingClientRect()
    if (!b) return
    const p = horizontal ? e.clientX - b.left - h.parent.x : e.clientY - b.top - h.parent.y
    onRatio((p - gap / 2) / span)
  }
  const key = (e: ReactKeyboardEvent) => {
    const dir = horizontal ? { ArrowRight: 1, ArrowLeft: -1 }[e.key] : { ArrowDown: 1, ArrowUp: -1 }[e.key]
    if (e.key === 'Home') {
      e.preventDefault()
      onReset()
    } else if (dir) {
      e.preventDefault()
      onRatio(h.ratio + (dir * (e.shiftKey ? KEY_STEP * 4 : KEY_STEP)) / span)
    }
  }
  return (
    <div
      role="separator"
      aria-orientation={horizontal ? 'vertical' : 'horizontal'}
      aria-label="Resize tiles"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(h.ratio * 100)}
      tabIndex={0}
      title="Resize tiles: drag, arrow keys, double click or Home to reset"
      data-active={active || undefined}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        set(true)
      }}
      onPointerMove={move}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onDoubleClick={onReset}
      onKeyDown={key}
      style={style}
      className={cn('group/gap absolute z-20 touch-none outline-none', horizontal ? 'cursor-col-resize' : 'cursor-row-resize')}
    >
      <span
        aria-hidden
        className={cn(
          'bg-primary/0 group-hover/gap:bg-primary/50 group-focus-visible/gap:bg-primary group-data-[active]/gap:bg-primary absolute transition-colors',
          horizontal ? 'inset-y-0 left-1/2 w-0.5 -translate-x-1/2' : 'inset-x-0 top-1/2 h-0.5 -translate-y-1/2',
        )}
      />
    </div>
  )
}

// Brings the tree in line with the tiles that should be open: gone ones are removed, new ones are split off the focused tile.
function syncTree(tree: TileNode | null, wanted: string[], area: Rect, gap: number, focus: string | null): TileNode | null {
  let t = tree
  const want = new Set(wanted)
  for (const id of tileIds(t)) if (!want.has(id)) t = removeTile(t, id)
  for (const id of wanted) if (!tileIds(t).includes(id)) t = insertTile(t, id, focus, area, gap)
  return t
}

interface Props {
  crewId: number
  tiles: TileInfo[]
  onClose: (tile: TileInfo) => void
  // The handler that pops a tile out into its own window; null when it cannot be (it is out already).
  popOut?: (tile: TileInfo) => (() => void) | null
  body: (tile: TileInfo) => ReactNode
  info?: (tile: TileInfo) => ReactNode
  // The header's icon, heading, subtitle and status for a tile.
  chrome?: (tile: TileInfo) => { icon?: ReactNode; heading?: string; subtitle?: string; badge?: ReactNode; status?: ReactNode }
  // The focused tile's id (null when none), for panels that follow the focus.
  onFocusChange?: (id: string | null) => void
  // A tile opened on purpose (a new agent or shell) that takes the focus.
  focusId?: string | null
}

// Tiling for the project's tiles: absolute frames placed from the pure tree (shared/tiling.ts), moved with a
// CSS transition. Tile keys (settings > Shortcuts) work while the focus is anywhere in the page.
export function TileSurface({ crewId, tiles, onClose, popOut, body, info, chrome, onFocusChange, focusId }: Props) {
  const settings = useSettings().data
  const save = useSaveSettings()
  const box = useRef<HTMLDivElement>(null)
  const [area, setArea] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 })
  const [tree, setTree] = useState<TileNode | null>(() => trees.get(crewId) ?? null)
  const [focus, setFocus] = useState<string | null>(null)
  useEffect(() => onFocusChange?.(focus), [focus])
  const [full, setFull] = useState<string | null>(null)
  const [mfact, setMfact] = useState(() => mfacts.get(crewId) ?? MASTER_FACTOR)
  const [resizing, setResizing] = useState(false)
  const [swap, setSwap] = useState<{ id: string; over: string | null } | null>(null)
  const swapFrom = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const layout = settings?.tiles.layout ?? 'dwindle'
  const gap = settings?.tiles.gaps ?? 6
  const strip = settings?.tiles.strip ?? 'normal'

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setArea({ x: 0, y: 0, w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // A project switch loads that project's arrangement.
  useEffect(() => {
    setTree(trees.get(crewId) ?? null)
    setMfact(mfacts.get(crewId) ?? MASTER_FACTOR)
    setFocus(null)
    setFull(null)
  }, [crewId])
  useEffect(() => {
    if (focusId && tiles.some((t) => t.id === focusId)) setFocus(focusId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId])

  const wanted = tiles.map((t) => t.id)
  const wantedKey = wanted.join('|')
  useEffect(() => {
    setTree((cur) => {
      const next = syncTree(cur, wanted, area, gap, focus)
      trees.set(crewId, next)
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey, crewId, area.w > 0])
  useEffect(() => {
    const ids = tileIds(tree)
    if (focus && !ids.includes(focus)) setFocus(ids[0] ?? null)
    if (full && !ids.includes(full)) setFull(null)
  }, [tree, focus, full])

  const act = useCallback(
    (what: 'layout' | 'split' | 'full' | 'next' | 'prev' | 'close') => {
      const ids = tileIds(tree)
      if (what === 'layout') return save.mutate({ tiles: { layout: layout === 'dwindle' ? 'master' : 'dwindle' } })
      if (what === 'split') {
        if (!tree || !focus) return
        const next = toggleSplit(tree, focus)
        trees.set(crewId, next)
        return setTree(next)
      }
      if (what === 'full') return setFull((f) => (f === focus ? null : focus))
      if (what === 'close') {
        const t = tiles.find((x) => x.id === focus)
        return t && onClose(t)
      }
      if (ids.length === 0) return
      const at = focus ? ids.indexOf(focus) : -1
      setFocus(ids[(at + (what === 'next' ? 1 : -1) + ids.length) % ids.length]!)
    },
    [tree, focus, tiles, layout, crewId, save, onClose],
  )
  const actRef = useRef(act)
  actRef.current = act
  const binds = settings?.keybinds
  useEffect(() => {
    if (!binds) return
    const map: Array<[string, Parameters<typeof act>[0]]> = [
      [binds.tileLayout, 'layout'],
      [binds.tileSplit, 'split'],
      [binds.tileFullscreen, 'full'],
      [binds.tileFocusNext, 'next'],
      [binds.tileFocusPrev, 'prev'],
      [binds.tileClose, 'close'],
    ]
    const onKey = (e: KeyboardEvent) => {
      const hit = map.find(([accel]) => matches(e, accel))
      if (!hit) return
      e.preventDefault()
      actRef.current(hit[1])
    }
    const onMouse = (e: MouseEvent) => {
      const hit = map.find(([accel]) => matchesMouseEvent(e, accel))
      if (!hit) return
      e.preventDefault()
      actRef.current(hit[1])
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onMouse)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onMouse)
    }
  }, [binds])

  const rects = tileRects(tree, area, layout, mfact, gap)

  const ids = tileIds(tree)
  const handles: Handle[] =
    full !== null || !tree
      ? []
      : layout === 'master'
        ? ids.length < 2
          ? []
          : [{ key: 'master', path: null, split: 'h', rect: { x: area.x + (area.w - gap) * mfact, y: area.y, w: gap, h: area.h }, parent: area, ratio: mfact }]
        : splitHandles(tree, area, gap).map((s) => ({ key: s.path.join('') || 'root', ...s }))
  const resize = (h: Handle, ratio: number) => {
    if (h.path === null) {
      const next = Math.min(MAX_MFACT, Math.max(MIN_MFACT, ratio))
      mfacts.set(crewId, next)
      return setMfact(next)
    }
    if (!tree) return
    const next = setRatioAt(tree, h.path, ratio)
    trees.set(crewId, next)
    setTree(next)
  }

  // Moving a tile uses pointer events on the handle, not HTML5 drag and drop, which a browser tile's native view would
  // swallow. The tile under the pointer comes from the computed rects.
  const tileAt = (e: PointerEvent): string | null => {
    const b = box.current?.getBoundingClientRect()
    if (!b) return null
    const x = e.clientX - b.left
    const y = e.clientY - b.top
    for (const [id, r] of rects) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return id
    return null
  }
  const endSwap = () => {
    swapFrom.current = null
    setSwap(null)
  }
  useEffect(() => {
    if (!swap) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') endSwap()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [swap !== null])
  const moveProps = (id: string) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      swapFrom.current = { x: e.clientX, y: e.clientY, moved: false }
    },
    onPointerMove: (e: PointerEvent<HTMLButtonElement>) => {
      const from = swapFrom.current
      if (!from) return
      if (!from.moved && Math.hypot(e.clientX - from.x, e.clientY - from.y) < MOVE_THRESHOLD) return
      from.moved = true
      const over = tileAt(e)
      setSwap({ id, over: over !== id ? over : null })
    },
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
      const over = swapFrom.current?.moved ? tileAt(e) : null
      endSwap()
      if (!tree || !over || over === id) return
      const next = swapTiles(tree, id, over)
      trees.set(crewId, next)
      setTree(next)
    },
    onPointerCancel: endSwap,
  })

  return (
    <div ref={box} className="relative min-h-0 flex-1 overflow-hidden p-0" data-testid="tile-surface" data-layout={layout}>
      {tiles.map((t) => {
        const r = (full === t.id ? area : rects.get(t.id)) ?? { x: 0, y: 0, w: 0, h: 0 }
        return (
          <TileFrame
            key={t.id}
            id={t.id}
            title={t.title}
            focused={focus === t.id}
            fullscreen={full === t.id}
            hidden={full !== null && full !== t.id}
            style={{ left: r.x, top: r.y, width: r.w, height: r.h, zIndex: full === t.id ? 10 : 0 }}
            strip={strip}
            moveProps={full === null && ids.length > 1 ? moveProps(t.id) : undefined}
            dragging={resizing}
            moving={swap?.id === t.id}
            dropTarget={swap?.over === t.id}
            info={info?.(t)}
            {...chrome?.(t)}
            onClose={() => onClose(t)}
            onPopOut={popOut?.(t) ?? undefined}
            onFocus={() => setFocus(t.id)}
            onFullscreen={() => (setFocus(t.id), setFull((f) => (f === t.id ? null : t.id)))}
          >
            {body(t)}
          </TileFrame>
        )
      })}
      {handles.map((h) => (
        <GapHandle key={h.key} h={h} gap={gap} box={box} onRatio={(r) => resize(h, r)} onReset={() => resize(h, h.path === null ? MASTER_FACTOR : 0.5)} onActive={setResizing} />
      ))}
    </div>
  )
}

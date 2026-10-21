import { useLayoutEffect, type RefObject } from 'react'

const moves = new WeakMap<Element, Animation>()
const spots = new WeakMap<Element, Map<string, { x: number; y: number }>>()

// Rows marked data-flip="<key>" inside `host` glide to their new place when a render moves them (FLIP). Every render measures the rows
// against the previous one, in the host's own coordinates so scrolling does not count, and each row that moved plays a spring from its old spot.
// Rows that only appear or disappear are left to the caller; nothing moves under reduced motion.
export function useFlip(host: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const root = host.current
    if (!root) return
    const rows = root.querySelectorAll<HTMLElement>('[data-flip]')
    for (const el of rows) moves.get(el)?.cancel()
    const base = root.getBoundingClientRect()
    const now = new Map<string, { x: number; y: number }>()
    for (const el of rows) {
      const r = el.getBoundingClientRect()
      now.set(el.dataset.flip!, { x: r.left - base.left + root.scrollLeft, y: r.top - base.top + root.scrollTop })
    }
    const before = spots.get(root)
    spots.set(root, now)
    if (!before || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const easing = getComputedStyle(document.documentElement).getPropertyValue('--m-spring-soft').trim()
    for (const el of rows) {
      const from = before.get(el.dataset.flip!)
      const to = now.get(el.dataset.flip!)!
      if (!from || (from.x === to.x && from.y === to.y)) continue
      moves.set(el, el.animate([{ transform: `translate(${from.x - to.x}px, ${from.y - to.y}px)` }, { transform: 'none' }], { duration: 420, easing }))
    }
  })
}

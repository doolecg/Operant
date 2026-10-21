import { useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

// The selection indicator of a segmented control or tab strip: one block under the item that matches `selector`, sliding and resizing to the
// next one. Render it as the first child of the strip (which must be `relative`) and give the items `relative` so they sit above it.
// It is placed at once the first time and under reduced motion (--m-select is 0ms there).
export function SlidingThumb({ selector, className }: { selector: string; className?: string }) {
  const thumb = useRef<HTMLSpanElement>(null)
  const placed = useRef(false)

  const place = () => {
    const el = thumb.current
    if (!el) return
    const target = el.parentElement?.querySelector<HTMLElement>(selector)
    el.style.opacity = target ? '1' : '0'
    if (!target) return
    el.style.width = `${target.offsetWidth}px`
    el.style.height = `${target.offsetHeight}px`
    el.style.transform = `translate(${target.offsetLeft}px, ${target.offsetTop}px)`
  }

  useLayoutEffect(() => {
    const el = thumb.current
    if (!el) return
    if (placed.current) {
      place()
      return
    }
    el.style.transition = 'none'
    place()
    void el.offsetWidth
    el.style.transition = ''
    placed.current = true
  })
  useLayoutEffect(() => {
    const strip = thumb.current?.parentElement
    if (!strip) return
    const ro = new ResizeObserver(place)
    ro.observe(strip)
    return () => ro.disconnect()
  }, [])

  return <span ref={thumb} aria-hidden className={cn('m-thumb opacity-0', className)} />
}

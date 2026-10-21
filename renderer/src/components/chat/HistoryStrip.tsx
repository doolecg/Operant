import { useEffect, useState, type RefObject } from 'react'
import { activeLine, type HistoryLine } from '@shared/chat-history-lines'
import { cn } from '@/lib/utils'

// How far below the top of the view a message still counts as the one being read.
const READ_LINE = 96

const messageEl = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"]`)

// A strip of short lines at the edge of the chat (left of a wide one, right of a narrow one), one per owner message, in place of the scrollbar: the line for the
// message being read is long and bright, hovering one shows that message and the start of Claude's answer, clicking scrolls to it.
export function HistoryStrip({ scroller, lines }: { scroller: RefObject<HTMLDivElement | null>; lines: HistoryLine[] }) {
  const [at, setAt] = useState(0)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    let frame = 0
    const measure = () => {
      frame = 0
      const top = el.getBoundingClientRect().top
      setAt(activeLine(lines.map((l) => (messageEl(el, l.id)?.getBoundingClientRect().top ?? Infinity) - top), READ_LINE))
    }
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    el.addEventListener('scroll', queue, { passive: true })
    const ro = new ResizeObserver(queue)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', queue)
      ro.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [scroller, lines])

  const go = (id: string) => {
    const el = scroller.current
    if (!el) return
    const target = messageEl(el, id)
    if (target) el.scrollTo({ top: el.scrollTop + target.getBoundingClientRect().top - el.getBoundingClientRect().top - 12, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  // The lines near the one being read (or hovered) are long and taper off with distance, like a dock.
  const focus = hover ?? at
  const width = (i: number) => 8 + 22 * Math.exp(-(((i - focus) / 2.2) ** 2))

  return (
    <nav aria-label="Message history" data-chat="history-strip" className="flex min-h-0 flex-1 flex-col justify-center">
      <ol className="flex max-h-full min-h-0 flex-col" onMouseLeave={() => setHover(null)}>
        {lines.map((l, i) => (
          <li key={l.id} className="group relative flex min-h-[3px] flex-[0_1_10px] basis-[10px]" onMouseEnter={() => setHover(i)}>
            <button type="button" onClick={() => go(l.id)} aria-label={`Go to message: ${l.title}`} aria-current={i === at ? 'true' : undefined} className="flex w-9 flex-1 items-center justify-end outline-none @[900px]:justify-start" onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
              <span style={{ width: width(i) }} className={cn('block h-[2px] rounded-full transition-[width,background-color] duration-200', i === at ? 'bg-foreground' : 'bg-muted-foreground/50 group-hover:bg-foreground/80')} />
            </button>
            <div
              role="tooltip"
              className="surface-edge bg-popover pointer-events-none absolute top-1/2 right-full mr-2 w-64 -translate-y-1/2 translate-x-1 rounded-xl p-3 opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100 @[900px]:right-auto @[900px]:left-full @[900px]:mr-0 @[900px]:ml-2 @[900px]:-translate-x-1 @[900px]:group-hover:translate-x-0 @[900px]:group-focus-within:translate-x-0"
            >
              <p className="text-foreground line-clamp-2 text-[13px] font-medium">{l.title}</p>
              {l.reply && <p className="text-muted-foreground mt-1 line-clamp-3 text-xs">{l.reply}</p>}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  )
}

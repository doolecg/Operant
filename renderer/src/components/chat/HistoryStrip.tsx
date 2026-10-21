import { useEffect, useState, type RefObject } from 'react'
import { activeLine, type HistoryLine } from '@shared/chat-history-lines'
import { cn } from '@/lib/utils'

// How far below the top of the view a message still counts as the one being read.
const READ_LINE = 96

const messageEl = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"]`)

// A strip of short lines on the right edge of the chat, one per owner message, in place of the scrollbar: the line for the
// message being read is long and bright, hovering one shows that message and the start of Claude's answer, clicking scrolls to it.
export function HistoryStrip({ scroller, lines }: { scroller: RefObject<HTMLDivElement | null>; lines: HistoryLine[] }) {
  const [at, setAt] = useState(0)

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

  return (
    <nav aria-label="Message history" data-chat="history-strip" className="absolute top-3 right-1 bottom-3 z-10 flex flex-col justify-center">
      <ol className="flex max-h-full min-h-0 flex-col">
        {lines.map((l, i) => (
          <li key={l.id} className="group relative flex min-h-[3px] flex-[0_1_10px] basis-[10px]">
            <button type="button" onClick={() => go(l.id)} aria-label={`Go to message: ${l.title}`} aria-current={i === at ? 'true' : undefined} className="flex w-6 flex-1 items-center justify-end outline-none">
              <span className={cn('block h-[2px] rounded-full transition-all duration-200', i === at ? 'bg-foreground w-4' : 'bg-muted-foreground/50 group-hover:bg-foreground/80 group-focus-within:bg-foreground/80 w-2.5')} />
            </button>
            <div
              role="tooltip"
              className="surface-edge bg-popover pointer-events-none absolute top-1/2 right-full mr-2 w-64 -translate-y-1/2 translate-x-1 rounded-xl p-3 opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100"
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

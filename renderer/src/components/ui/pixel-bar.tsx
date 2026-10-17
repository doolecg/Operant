import { memo, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { PIXEL_FRAME_MS, PIXEL_HEIGHT, PIXEL_PITCH, pixelCols, pixelFrame, solidFrame } from '@shared/pixel-bar'
import { cn } from '@/lib/utils'

// One shared 250 ms frame clock for every moving pixel bar; it runs only while a bar is animating.
let tick = 0
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  if (!timer) timer = setInterval(() => (tick++, listeners.forEach((l) => l())), PIXEL_FRAME_MS)
  return () => {
    listeners.delete(fn)
    if (listeners.size === 0 && timer) (clearInterval(timer), (timer = null))
  }
}
const noop = () => () => {}
const reducedMotion = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// The frame number while `active` (and motion is allowed), else 0.
export function usePixelTick(active: boolean): number {
  const on = active && !reducedMotion()
  return useSyncExternalStore(on ? subscribe : noop, () => (on ? tick : 0))
}

export type PixelBarTone = 'primary' | 'success' | 'warning' | 'destructive' | 'muted'
const COLOR: Record<PixelBarTone, string> = {
  primary: 'var(--primary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  destructive: 'var(--destructive)',
  muted: 'var(--muted-foreground)',
}

// Context and usage meters: amber from `warn`, red from `danger` (the Bottom Bar's 60 and 80 by default).
export const meterTone = (pct: number, warn = 60, danger = 80): PixelBarTone => (pct >= danger ? 'destructive' : pct >= warn ? 'warning' : 'success')

interface Props {
  // 0..1 lit. Ignored by a sweep.
  fraction?: number
  // Work with no percent: a lit patch runs along the track.
  sweep?: boolean
  // Rolling faint pixels on the empty track while work runs.
  wave?: boolean
  // Flicker frame by frame (a sweep or a wave always animates).
  animate?: boolean
  // Every dot lit at full strength, still: something finished.
  solid?: boolean
  tone?: PixelBarTone
  // Fixed width in pixels; without it the bar fills its container.
  width?: number
  // Accessible name; without it the bar is decorative.
  label?: string
  title?: string
  className?: string
}

/**
 * The Dooles Tools pixel bar (Flightdeck, Bottom Bar, Task View): small dots on a dark rounded track, part of them
 * lit, flickering on a shared 250 ms clock. Drawn at its real size so the dots are never stretched.
 */
export const PixelBar = memo(function PixelBar({ fraction = 0, sweep = false, wave = false, animate = false, solid = false, tone = 'primary', width, label, title, className }: Props) {
  const box = useRef<HTMLSpanElement>(null)
  const [measured, setMeasured] = useState(0)
  useLayoutEffect(() => {
    if (width !== undefined) return
    const el = box.current
    if (!el) return
    setMeasured(Math.floor(el.clientWidth))
    const ro = new ResizeObserver(([e]) => e && setMeasured(Math.floor(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [width])
  const w = Math.max(PIXEL_PITCH * 4, width ?? measured)
  const t = usePixelTick(!solid && (sweep || wave || animate))
  const id = useId().replace(/:/g, '')
  const f = solid ? solidFrame(pixelCols(w)) : pixelFrame(w, fraction, sweep, t, wave)
  const color = COLOR[tone]
  const fill = { to: color, from: color, tint: 'var(--foreground)' } as const
  const r = PIXEL_HEIGHT / 2
  return (
    <span
      ref={box}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      title={title}
      className={cn('inline-block shrink-0 align-middle leading-none', width === undefined && 'block w-full min-w-0', className)}
      style={{ height: PIXEL_HEIGHT, ...(width !== undefined ? { width } : {}) }}
    >
      {w > 0 && (
        <svg width={w} height={PIXEL_HEIGHT} viewBox={`0 0 ${w} ${PIXEL_HEIGHT}`} className="block">
          <defs>
            <filter id={`g${id}`} x="-2" y="-2" width="5" height="5">
              <feGaussianBlur stdDeviation="1.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <clipPath id={`c${id}`}>
              <rect width={w} height={PIXEL_HEIGHT} rx={r} />
            </clipPath>
          </defs>
          <rect width={w} height={PIXEL_HEIGHT} rx={r} fill="var(--muted)" />
          <g clipPath={`url(#c${id})`}>
            {f.dots.map((d) => (
              <rect
                key={d.col * 3 + d.row}
                x={d.col * PIXEL_PITCH + 0.5}
                y={d.row * PIXEL_PITCH + 0.5}
                width={2}
                height={2}
                rx={0.4}
                fill={fill[d.tone]}
                opacity={d.tone === 'from' ? d.opacity * 0.6 : d.opacity}
                filter={d.glow ? `url(#g${id})` : undefined}
              />
            ))}
          </g>
        </svg>
      )}
    </span>
  )
})

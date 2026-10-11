import { Box } from 'lucide-react'
import type { ChatState } from '@shared/claude-chat'
import { keepWarmLine } from '@shared/keepwarm'
import { cn } from '@/lib/utils'
import { useNow } from './useChat'

const BADGE = {
  warm: 'bg-success/20 text-success',
  cooling: 'bg-warning/20 text-warning',
  cold: 'bg-muted text-muted-foreground',
  off: 'bg-muted text-muted-foreground',
} as const

// In the row above the composer, right-aligned, while keep-warm runs (and after it stopped on its own, so a restart or a limit is visible):
// the cache state as a badge, the time left, the next ping and what the last one read.
export function KeepWarmLine({ state }: { state: ChatState }) {
  const kw = state.keepWarm
  const show = !!kw && (kw.active || !!kw.stopped)
  const now = useNow(!!kw?.active, 15_000)
  if (!show || !kw) return null
  const line = keepWarmLine(kw, kw.active ? now : Date.now())
  return (
    <span role="status" aria-label="Keep-warm status" data-chat="keepwarm-line" className="bg-muted/60 text-muted-foreground inline-flex max-w-full flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 rounded-[13px] px-2.5 py-1 text-[13px]">
      <Box className="size-3.5 shrink-0 whitespace-nowrap" aria-hidden />
      <span className="shrink-0 whitespace-nowrap">keep-warm</span>
      <span className={cn('shrink-0 rounded-full px-2 py-px text-xs font-semibold whitespace-nowrap', BADGE[line.badge])}>{line.badge === 'off' ? 'off' : line.badge}</span>
      {line.parts.map((p, i) => (
        <span key={i} className="whitespace-nowrap">{kw.active || i > 0 ? '· ' : ''}{p}</span>
      ))}
    </span>
  )
}

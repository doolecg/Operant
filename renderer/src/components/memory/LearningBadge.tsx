import { Brain } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useLearnStatus } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { STORE_LABEL } from './ui'

export const OPEN_SETTINGS_EVENT = 'operant:open-settings'

// The one small memory button, next to the context readout: grey when learning is off, amber when a store is down, the
// last run failed or something waits for review, otherwise green. Opens the Lessons page in Settings.
export function LearningBadge() {
  const status = useLearnStatus()
  const s = status.data
  if (!s) return null
  const down = s.stores.filter((x) => x.enabled && !x.up)
  const waiting = s.pendingLessons + s.pendingDrafts
  const problems = [
    ...down.map((d) => `${STORE_LABEL[d.store]} is down`),
    ...(s.lastRun?.error ? ['the last learn run failed'] : []),
    ...(s.lastRun && s.lastRun.skipped.some((k) => s.stores.find((x) => x.store === k.store)?.enabled) ? ['the last run skipped a store'] : []),
  ]
  const tone = !s.enabled ? 'off' : problems.length > 0 ? 'warn' : 'ok'
  const text = !s.enabled
    ? 'Learning is off'
    : [problems.length ? `Learning needs attention: ${problems.join(', ')}` : 'Learning is healthy', waiting ? `${waiting} waiting for review` : ''].filter(Boolean).join('. ')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-5 gap-0.5 px-1', tone === 'ok' && 'text-emerald-400', tone === 'warn' && 'text-amber-400', tone === 'off' && 'text-muted-foreground')}
          aria-label={`Learning health: ${text}`}
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT, { detail: 'lessons' }))}
        >
          <Brain className="size-3.5" />
          {waiting > 0 && <span className="text-[11px]">{waiting}</span>}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}

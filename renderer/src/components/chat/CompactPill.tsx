import { Minimize2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { kTokens } from './chatHelpers'

// Shown when the context is getting full: the next message compacts the conversation first, unless the owner clicks to keep the full history.
export function CompactPill({ tokens, keepFull, onToggle }: { tokens: number; keepFull: boolean; onToggle: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-pressed={!keepFull}
          aria-label={keepFull ? `Full history is kept (${kTokens(tokens)} tokens)` : `Compact ${kTokens(tokens)} tokens before the next message`}
          onClick={onToggle}
          className={cn('m-press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium outline-none', keepFull ? 'border-border text-muted-foreground hover:text-foreground' : 'border-primary/50 bg-primary/10 text-primary')}
        >
          <Minimize2 className="size-3.5" aria-hidden />
          {keepFull ? 'Keeping history' : `Compact ${kTokens(tokens)}`}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px]">
        {keepFull ? `The next message goes with the full ${kTokens(tokens)} tokens of history. Click to compact first.` : `Next send compacts ${kTokens(tokens)} tokens first. Click to keep full history.`}
      </TooltipContent>
    </Tooltip>
  )
}

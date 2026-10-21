import { Factory, Hammer } from 'lucide-react'
import type { Crew } from '@shared/types'
import { decodeIpcError } from '@shared/ipc'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useUpdateCrew } from '@/lib/queries'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

// The two per-project modes. They apply when a tile starts, so running tiles keep their state.
export function ModeToggles({ crew, tier }: { crew: Crew; tier: number }) {
  const update = useUpdateCrew()
  const toggle = (key: 'engineering' | 'factory') =>
    update.mutate([crew.id, key === 'engineering' ? { engineering: !crew.engineering } : { factory: !crew.factory }], { onError: (e) => toast(decodeIpcError(e).message, true) })
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Toggle label="Engineering Mode" text="Engineering" showText={tier < 3} on={crew.engineering} onClick={() => toggle('engineering')} tip="Engineering Mode: new tiles follow the engineering workflow (plan, build, review, ship). Applies to new tiles.">
        <Hammer />
      </Toggle>
      <Toggle label="Subagent Factory Mode" text="Factory" showText={tier < 2} on={crew.factory} onClick={() => toggle('factory')} tip="Subagent Factory Mode: new tiles run work through helper agents with strict rules. Applies to new tiles.">
        <Factory />
      </Toggle>
    </div>
  )
}

function Toggle({ label, text, showText, on, tip, onClick, children }: { label: string; text: string; showText: boolean; on: boolean; tip: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={on}
          onClick={onClick}
          className={cn(
            'm-press focus-visible:ring-ring/50 inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full text-xs whitespace-nowrap outline-none focus-visible:ring-[3px] [&_svg]:size-4',
            showText ? 'px-2.5' : 'w-[26px] justify-center',
            on ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {children}
          {showText && text}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tip}</TooltipContent>
    </Tooltip>
  )
}

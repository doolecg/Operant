import { ChevronDown } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { SlidingThumb } from '@/components/ui/sliding-thumb'
import { cn } from '@/lib/utils'

export type Mode = 'terminal' | 'memory'
export const MODES: Mode[] = ['terminal', 'memory']
export const MODE_LABEL: Record<Mode, string> = { terminal: 'Terminal', memory: 'Memory' }

// Terminal | Memory as a pill track; a single accent pill slides under the active label.
// Left and right arrow keys move between the pills. `menu` swaps the track for a dropdown when the bar is too narrow.
export function ViewSwitcher({ mode, onMode, menu, badges }: { mode: Mode; onMode: (m: Mode) => void; menu: boolean; badges?: Partial<Record<Mode, number>> }) {
  if (menu) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={`View: ${MODE_LABEL[mode]}`} className="flex h-[28px] shrink-0 items-center gap-1 rounded-full bg-[#d97757] pl-3 pr-2 text-xs font-medium text-[#1f1208]">
            {MODE_LABEL[mode]}
            <ChevronDown className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {MODES.map((m) => (
            <DropdownMenuItem key={m} onSelect={() => onMode(m)}>
              {MODE_LABEL[m]}
              {!!badges?.[m] && <span className="bg-muted ml-2 rounded-full px-1.5 text-[10px] tabular-nums">{badges[m]}</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = MODES[(MODES.indexOf(mode) + step + MODES.length) % MODES.length]!
    onMode(next)
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)?.focus()
  }
  return (
    <div role="group" aria-label="Dashboard mode" onKeyDown={onKey} className="bg-foreground/5 relative flex shrink-0 items-center gap-1 rounded-full p-[3px]">
      <SlidingThumb selector='[aria-pressed="true"]' className="rounded-full bg-[#d97757]" />
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          data-mode={m}
          aria-pressed={m === mode}
          tabIndex={m === mode ? 0 : -1}
          onClick={() => onMode(m)}
          className={cn(
            'm-press relative h-[22px] rounded-full px-3 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            m === mode ? 'font-semibold text-[#1f1208]' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {MODE_LABEL[m]}
          {!!badges?.[m] && (
            <span data-mode-badge={m} className={cn('ml-1.5 rounded-full px-1.5 text-[10px] tabular-nums', m === mode ? 'bg-[#1f1208]/20' : 'bg-[#d97757] text-[#1f1208]')}>
              {badges[m]}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

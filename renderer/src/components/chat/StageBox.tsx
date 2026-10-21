import { Check } from 'lucide-react'
import type { StageLine } from '@shared/engineering'
import { useTaskStages } from '@/lib/queries/engineering'
import { cn } from '@/lib/utils'

// The Engineering task's steps at the top of the chat, the current one marked; read from the newest task folder of the project.
export function StageBox({ crewId, on }: { crewId: number | null; on: boolean }) {
  const stages: StageLine[] | null | undefined = useTaskStages(crewId, on).data
  if (!on || !stages) return null
  return (
    <ol aria-label="Engineering stages" data-chat="stage-box" className="surface mx-auto mt-2 flex w-[calc(100%-2.5rem)] max-w-[680px] shrink-0 flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-3 py-1.5 text-xs">
      {stages.map((s) => (
        <li key={s.key} aria-current={s.state === 'current' ? 'step' : undefined} className={cn('flex items-center gap-1.5', s.state === 'current' ? 'text-foreground' : s.state === 'done' ? 'text-muted-foreground' : 'text-muted-foreground/60')}>
          {s.state === 'done' ? <Check className="text-success size-3.5" aria-hidden /> : <span aria-hidden className={cn('size-1.5 rounded-full', s.state === 'current' ? 'bg-primary' : 'bg-muted-foreground/40')} />}
          <span className={cn(s.state === 'current' && 'font-medium')}>{s.label}</span>
          {s.detail && <span className="text-muted-foreground">{s.detail}</span>}
        </li>
      ))}
    </ol>
  )
}

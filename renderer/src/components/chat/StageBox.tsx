import { Check } from 'lucide-react'
import type { StageLine } from '@shared/engineering'
import { useTaskStages } from '@/lib/queries/engineering'
import { cn } from '@/lib/utils'

const tone = (s: StageLine) => (s.state === 'current' ? 'text-foreground' : s.state === 'done' ? 'text-muted-foreground' : 'text-muted-foreground/60')

function useStages(crewId: number | null, on: boolean): StageLine[] | null {
  const stages: StageLine[] | null | undefined = useTaskStages(crewId, on).data
  return on && stages ? stages : null
}

// The Engineering task's steps in one row at the top of a narrow chat, the current one marked.
export function StageBar({ crewId, on }: { crewId: number | null; on: boolean }) {
  const stages = useStages(crewId, on)
  if (!stages) return null
  return (
    <ol aria-label="Engineering stages" data-chat="stage-box" className="surface mx-auto mt-2 flex w-[calc(100%-2.5rem)] max-w-[680px] shrink-0 flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-3 py-1.5 text-xs @[900px]:hidden">
      {stages.map((s) => (
        <li key={s.key} aria-current={s.state === 'current' ? 'step' : undefined} className={cn('flex items-center gap-1.5', tone(s))}>
          {s.state === 'done' ? <Check className="text-success size-3.5" aria-hidden /> : <span aria-hidden className={cn('size-1.5 rounded-full', s.state === 'current' ? 'bg-primary' : 'bg-muted-foreground/40')} />}
          <span className={cn(s.state === 'current' && 'font-medium')}>{s.label}</span>
          {s.detail && <span className="text-muted-foreground">{s.detail}</span>}
        </li>
      ))}
    </ol>
  )
}

// The same steps as a column on the left of a wide chat: the name, and on the right a tick when done or a ring on the current one.
export function StageRail({ crewId, on }: { crewId: number | null; on: boolean }) {
  const stages = useStages(crewId, on)
  if (!stages) return null
  return (
    <ol aria-label="Engineering stages" data-chat="stage-rail" className="surface hidden w-[200px] shrink-0 flex-col gap-0.5 rounded-xl p-2 text-[13px] @[900px]:flex">
      {stages.map((s) => (
        <li key={s.key} aria-current={s.state === 'current' ? 'step' : undefined} className={cn('flex min-h-7 items-center gap-2 rounded-lg px-2', s.state === 'current' && 'bg-accent', tone(s))}>
          <span className={cn('min-w-0 flex-1', s.state === 'current' && 'font-medium')}>
            {s.label}
            {s.detail && <span className="text-muted-foreground ml-1.5 text-xs font-normal">{s.detail}</span>}
          </span>
          {s.state === 'done' ? (
            <Check className="text-success size-4 shrink-0" aria-hidden />
          ) : s.state === 'current' ? (
            <span aria-hidden className="border-primary size-3 shrink-0 rounded-full border-2" />
          ) : (
            <span aria-hidden className="bg-muted-foreground/40 h-0.5 w-2.5 shrink-0 rounded-full" />
          )}
        </li>
      ))}
    </ol>
  )
}

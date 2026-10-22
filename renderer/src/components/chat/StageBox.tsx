import { Check, ChevronDown, GitBranch, X } from 'lucide-react'
import type { StageLine, TaskInfo } from '@shared/engineering'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { call, refreshGit, useGitInfo, useRepoBranches } from '@/lib/queries'
import { useTaskStages } from '@/lib/queries/engineering'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'

const tone = (s: StageLine) => (s.state === 'current' ? 'text-foreground' : s.state === 'done' ? 'text-muted-foreground' : 'text-muted-foreground/60')

function useTask(crewId: number | null, on: boolean): TaskInfo | null {
  const task: TaskInfo | null | undefined = useTaskStages(crewId, on).data
  return on && task ? task : null
}

// The branch the project is on, as a button: it lists the branches and switches to the one picked.
function BranchPicker({ crewId }: { crewId: number }) {
  const qc = useQueryClient()
  const branch = useGitInfo(crewId).data?.branch
  const branches = useRepoBranches(crewId)
  if (!branch) return null
  const switchTo = async (name: string) => {
    try {
      const r = await call('git:checkout', crewId, name)
      if (!r.ok) toast(`Could not switch to ${name}: ${r.output}`, true)
    } catch (e) {
      toast(`Could not switch to ${name}: ${e instanceof Error ? e.message : String(e)}`, true)
    }
    void refreshGit(qc)
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="m-press text-muted-foreground hover:text-foreground hover:bg-accent inline-flex max-w-full items-center gap-1 rounded-md px-1 py-0.5 text-xs outline-none" aria-label={`Branch ${branch}, switch branch`} title="Switch branch">
        <GitBranch className="size-3 shrink-0" aria-hidden />
        <span className="truncate">{branch}</span>
        <ChevronDown className="size-3 shrink-0" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
        {(branches.data?.branches ?? []).map((b) => (
          <DropdownMenuItem key={b.name} onSelect={() => !b.current && void switchTo(b.name)} className="gap-2">
            <Check className={cn('size-3.5', !b.current && 'invisible')} aria-hidden />
            {b.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// The feature the task is about and the branch it is on, and a button that takes the task off the panel (its files stay).
// `stacked` (the left column) puts the branch under the title.
function TaskHeader({ crewId, task, stacked }: { crewId: number; task: TaskInfo; stacked?: boolean }) {
  const clear = (
    <button
      type="button"
      onClick={() => void call('engineering:clearTask', crewId)}
      aria-label="Clear this task from the panel"
      title="Clear this task from the panel. Its files stay; it shows again if they change."
      className="m-press text-muted-foreground hover:text-foreground hover:bg-accent ml-auto inline-flex size-5 shrink-0 items-center justify-center rounded-md"
    >
      <X className="size-3.5" aria-hidden />
    </button>
  )
  const title = (
    <span className={cn('text-foreground min-w-0 font-medium', stacked ? 'line-clamp-2 flex-1' : 'truncate')} title={task.title}>
      {task.title}
    </span>
  )
  return stacked ? (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        {title}
        {clear}
      </div>
      <div className="-ml-1 flex">
        <BranchPicker crewId={crewId} />
      </div>
    </div>
  ) : (
    <div className="flex min-w-0 items-center gap-2">
      {title}
      <BranchPicker crewId={crewId} />
      {clear}
    </div>
  )
}

export const chipClass = 'm-press bg-accent/60 text-muted-foreground hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground inline-flex h-[26px] shrink-0 items-center gap-2 rounded-full px-3 text-[13px] outline-none'

// The Engineering task as a chip at the top of the chat ("Build 4 of 6", a dot per step); it opens the task's title, branch, clear button and the steps.
export function StageChip({ crewId, on }: { crewId: number | null; on: boolean }) {
  const task = useTask(crewId, on)
  if (!task || crewId === null) return null
  const at = Math.max(0, task.stages.findIndex((s) => s.state === 'current'))
  const current = task.stages[at]
  return (
    <Popover>
      <PopoverTrigger data-chat="stage-chip" aria-label={`Engineering task: ${current?.label ?? 'steps'}, step ${at + 1} of ${task.stages.length}`} className={chipClass}>
        <span aria-hidden className="flex gap-[3px]">
          {task.stages.map((s) => (
            <i key={s.key} className={cn('size-[5px] rounded-full', s.state === 'current' ? 'bg-primary' : s.state === 'done' ? 'bg-muted-foreground' : 'bg-muted-foreground/30')} />
          ))}
        </span>
        {current?.label} {at + 1} of {task.stages.length}
        <ChevronDown className="size-3.5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] p-4 text-[13px]" data-chat="stage-popover">
        <TaskHeader crewId={crewId} task={task} stacked />
        <ol aria-label="Engineering stages" className="mt-3 flex flex-col gap-0.5">
          {task.stages.map((s) => (
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
      </PopoverContent>
    </Popover>
  )
}

import { useQueries } from '@tanstack/react-query'
import type { TaskListItem } from '@shared/engineering'
import type { Crew } from '@shared/types'
import { taskListQuery } from '@/lib/queries/engineering'
import { timeAgo } from '@/lib/format'

// "Build 4 of 6": the stage the task is at and its place among the stages.
const stageText = (t: TaskListItem) => {
  const at = Math.max(0, t.stages.findIndex((s) => s.state === 'current'))
  return `${t.stages[at]?.label ?? 'Frame'} ${at + 1} of ${t.stages.length}`
}

// The Engineering tasks of every project, newest change first, one quiet row each.
export function PlansView({ crews, onOpenProject }: { crews: Crew[]; onOpenProject: (crewId: number) => void }) {
  const results = useQueries({ queries: crews.map((c) => taskListQuery(c.id)) })
  const loaded = results.every((r) => !r.isPending)
  const rows = crews.flatMap((crew, i) => (results[i]?.data ?? []).map((task) => ({ crew, task }))).sort((a, b) => b.task.updatedAt - a.task.updatedAt)
  return (
    <section aria-label="Plans" className="mx-auto flex h-full w-full max-w-3xl min-h-0 flex-col overflow-y-auto px-6 py-8">
      <h2 className="text-lg font-semibold">Plans</h2>
      {rows.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">{loaded ? 'No Engineering tasks in any project yet.' : 'Reading the projects...'}</p>
      ) : (
        <ul aria-label="Engineering tasks" className="mt-4 flex flex-col">
          {rows.map(({ crew, task }) => (
            <li key={`${crew.id}/${task.name}`}>
              <button
                type="button"
                aria-label={`${task.title}, ${crew.name}, ${stageText(task)}. Open the project`}
                onClick={() => onOpenProject(crew.id)}
                className="m-press hover:bg-accent focus-visible:ring-ring flex w-full min-w-0 items-center gap-4 rounded-lg px-3 py-2.5 text-left outline-none focus-visible:ring-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{task.title}</span>
                <span className="text-muted-foreground w-32 shrink-0 truncate text-[13px]">{crew.name}</span>
                <span className="bg-accent/60 text-muted-foreground shrink-0 rounded-full px-2.5 py-0.5 text-xs">{stageText(task)}</span>
                <span className="text-muted-foreground w-16 shrink-0 text-right text-xs tabular-nums">{timeAgo(task.updatedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

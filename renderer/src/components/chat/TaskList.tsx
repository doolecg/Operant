import { useEffect, useMemo, useReducer, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ChatState } from '@shared/claude-chat'
import { TODO_LINGER_MS, todoListFrom, todoVisible, todoWindow, type TodoStatus } from '@shared/todo-list'
import { PixelBar } from '@/components/ui/pixel-bar'
import { cn } from '@/lib/utils'

const MAX_SHOWN = 8
const MARKER: Record<TodoStatus, string> = { done: '✓', active: '▶', pending: '○' }
const MARKER_COLOR: Record<TodoStatus, string> = { done: 'text-success', active: 'text-primary', pending: 'text-muted-foreground/60' }
const NAME_COLOR: Record<TodoStatus, string> = { done: 'text-muted-foreground', active: 'text-foreground font-semibold', pending: 'text-muted-foreground/70' }
const STATE_LABEL: Record<TodoStatus, string> = { done: 'done', active: 'in progress', pending: 'not started' }

// Claude's own to-do list above the prompt, read from the tool calls already in the chat (no tokens spent): a header with
// the count, one pixel bar for the list and a line with a small bar per item. Shown while items are open and for two
// minutes after the last one is ticked off.
export function TaskList({ state }: { state: ChatState }) {
  const list = useMemo(() => todoListFrom(state.items), [state.items])
  const [open, setOpen] = useState(true)
  const [, refresh] = useReducer((n: number) => n + 1, 0)

  // One timer to hide a finished list; nothing runs while items are open.
  const finishedAt = list?.allDone ? list.finishedAt : null
  useEffect(() => {
    if (finishedAt === null) return
    const left = finishedAt + TODO_LINGER_MS - Date.now()
    if (left <= 0) return
    const t = setTimeout(refresh, left + 50)
    return () => clearTimeout(t)
  }, [finishedAt])

  if (!list || !todoVisible(list, Date.now())) return null
  const working = state.turn.phase === 'working' && list.tasks.some((t) => t.status === 'active')
  const { shown, hidden } = todoWindow(list.tasks, MAX_SHOWN)
  const summary = list.allDone ? `All done · ${list.total} of ${list.total}` : `${list.done} of ${list.total} done · ${list.percent}%`
  const Chevron = open ? ChevronDown : ChevronRight

  return (
    <div className="mx-auto w-full max-w-[720px] px-5 pb-2" data-chat="task-list">
      <section aria-label="To-do list" className="border-border bg-card flex flex-col gap-2 rounded-xl border px-3 py-2 text-[13px]">
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? 'Collapse the to-do list' : 'Expand the to-do list'}
          onClick={() => setOpen((v) => !v)}
          className="hover:bg-accent/50 -mx-1 flex items-center gap-1.5 rounded-md px-1 text-left"
        >
          <Chevron className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          <b className="font-semibold">To-do</b>
          <span className={cn('ml-auto shrink-0 text-xs', list.allDone ? 'text-success' : 'text-muted-foreground')}>{summary}</span>
        </button>
        <PixelBar
          fraction={list.total === 0 ? 0 : list.done / list.total}
          tone={list.allDone ? 'success' : 'primary'}
          solid={list.allDone}
          animate={working}
          wave={working}
          label={`${list.done} of ${list.total} done, ${list.percent}%`}
        />
        {open && (
          <ul className="flex flex-col gap-1">
            {shown.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <span aria-hidden className={cn('w-3.5 shrink-0 text-center text-xs', MARKER_COLOR[t.status])}>
                  {MARKER[t.status]}
                </span>
                <span title={t.name} className={cn('min-w-0 flex-1 truncate', NAME_COLOR[t.status])}>
                  {t.name}
                </span>
                <PixelBar
                  width={120}
                  fraction={t.status === 'done' ? 1 : t.status === 'active' && !working ? 0.5 : 0}
                  sweep={t.status === 'active' && working}
                  tone={t.status === 'done' ? 'success' : 'primary'}
                  solid={t.status === 'done'}
                  label={`${t.name}: ${STATE_LABEL[t.status]}`}
                />
              </li>
            ))}
            {hidden > 0 && <li className="text-muted-foreground pl-[22px] text-xs">+{hidden} more</li>}
          </ul>
        )}
      </section>
    </div>
  )
}

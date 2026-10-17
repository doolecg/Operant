import type { ChatItem, ToolItem } from './claude-chat'

// Claude's own to-do list, read from the tool calls already in the chat (TodoWrite, TaskCreate, TaskUpdate, TaskList).
// Pure: no tokens are spent and nothing is asked of Claude.

export type TodoStatus = 'done' | 'active' | 'pending'

export interface TodoTask {
  id: string
  name: string
  status: TodoStatus
}

export interface TodoList {
  tasks: TodoTask[]
  done: number
  total: number
  percent: number
  allDone: boolean
  // When the last item was ticked off (the time of the call that did it); null while items are open.
  finishedAt: number | null
}

// A finished list stays on screen this long.
export const TODO_LINGER_MS = 2 * 60_000
const MAX_TASKS = 100
const MAX_NAME = 120

const clip = (raw: unknown): string => {
  const s = String(raw ?? '').replace(/\s+/g, ' ').trim()
  if (!s) return 'Untitled'
  return s.length > MAX_NAME ? `${s.slice(0, MAX_NAME - 1).trimEnd()}…` : s
}

const statusOf = (raw: unknown): TodoStatus => (raw === 'completed' ? 'done' : raw === 'in_progress' ? 'active' : 'pending')

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

function fromTodoWrite(input: unknown): TodoTask[] {
  const todos = rec(input).todos
  if (!Array.isArray(todos)) return []
  return todos
    .filter((t) => t && typeof t === 'object')
    .slice(0, MAX_TASKS)
    .map((t, i) => {
      const r = rec(t)
      return { id: `t${i}`, name: clip(r.content ?? r.subject), status: statusOf(r.status) }
    })
}

// A TaskList result: JSON with a `tasks` array, or lines like "#1 [in_progress] Write the intro".
function fromTaskList(text: string): TodoTask[] {
  try {
    const list = rec(JSON.parse(text)).tasks
    if (Array.isArray(list)) return list.slice(0, MAX_TASKS).map((t, i) => ({ id: String(rec(t).id ?? i + 1), name: clip(rec(t).subject), status: statusOf(rec(t).status) }))
  } catch {
    // not JSON: read the lines
  }
  const out: TodoTask[] = []
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*#?(\d+)[.:]?\s*\[(\w+)\]\s*(.+?)\s*$/.exec(line)
    if (m) out.push({ id: m[1]!, name: clip(m[3]), status: statusOf(m[2]) })
  }
  return out.slice(0, MAX_TASKS)
}

const summarise = (tasks: TodoTask[]) => {
  const done = tasks.filter((t) => t.status === 'done').length
  return { done, total: tasks.length, percent: tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100) }
}

/**
 * The main thread's current to-do list from the chat items, in order: a TodoWrite replaces the list, TaskCreate adds,
 * TaskUpdate changes or removes, TaskList replaces. Sub-agents' lists (parent set) and failed calls are ignored.
 * Null when there is no list.
 */
export function todoListFrom(items: readonly ChatItem[]): TodoList | null {
  let tasks: TodoTask[] = []
  let touched = 0
  let created = 0
  for (const it of items) {
    if (it.kind !== 'tool' || it.parent !== null) continue
    const tool: ToolItem = it
    if (tool.status === 'preparing' || tool.status === 'failed' || tool.status === 'denied' || tool.status === 'interrupted' || tool.result?.isError) continue
    const at = tool.endedAt ?? tool.startedAt
    const input = rec(tool.input)
    if (tool.name === 'TodoWrite') {
      tasks = fromTodoWrite(tool.input)
      touched = at
    } else if (tool.name === 'TaskCreate') {
      created += 1
      const id = /#\s*(\d+)/.exec(tool.result?.text ?? '')?.[1] ?? String(created)
      tasks = [...tasks.filter((t) => t.id !== id), { id, name: clip(input.subject), status: 'pending' as const }].slice(0, MAX_TASKS)
      touched = at
    } else if (tool.name === 'TaskUpdate') {
      const id = String(input.taskId ?? '')
      if (!tasks.some((t) => t.id === id)) continue
      tasks =
        input.status === 'deleted'
          ? tasks.filter((t) => t.id !== id)
          : tasks.map((t) =>
              t.id !== id
                ? t
                : {
                    ...t,
                    name: typeof input.subject === 'string' && input.subject.trim() ? clip(input.subject) : t.name,
                    status: typeof input.status === 'string' ? statusOf(input.status) : t.status,
                  },
            )
      touched = at
    } else if (tool.name === 'TaskList') {
      const listed = fromTaskList(tool.result?.text ?? '')
      if (listed.length === 0) continue
      tasks = listed
      touched = at
    }
  }
  if (tasks.length === 0) return null
  const s = summarise(tasks)
  const allDone = s.done === s.total
  return { tasks, ...s, allDone, finishedAt: allDone ? touched : null }
}

// Shown while items are open, or for TODO_LINGER_MS after the last one was ticked off.
export const todoVisible = (list: TodoList | null, now: number): boolean =>
  !!list && (!list.allDone || (list.finishedAt !== null && now < list.finishedAt + TODO_LINGER_MS))

// At most `cap` tasks, kept around the first open one so the work in progress stays in view; `hidden` is how many were cut.
export function todoWindow(tasks: readonly TodoTask[], cap: number): { shown: TodoTask[]; hidden: number } {
  if (tasks.length <= cap) return { shown: [...tasks], hidden: 0 }
  const open = tasks.findIndex((t) => t.status !== 'done')
  const start = Math.min(Math.max(0, (open < 0 ? tasks.length : open) - 1), tasks.length - cap)
  return { shown: tasks.slice(start, start + cap), hidden: tasks.length - cap }
}

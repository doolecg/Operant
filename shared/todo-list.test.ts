import { describe, expect, it } from 'vitest'
import type { ChatItem, ToolItem } from './claude-chat'
import { TODO_LINGER_MS, todoListFrom, todoVisible, todoWindow, type TodoTask } from './todo-list'

let n = 0
const tool = (name: string, input: unknown, extra: Partial<ToolItem> = {}): ChatItem => {
  n += 1
  return { kind: 'tool', id: `x${n}`, parent: null, name, input, partial: '', summary: '', status: 'done', result: null, diff: null, background: false, startedAt: n * 1000, endedAt: n * 1000 + 500, ...extra }
}
const result = (text: string, isError = false): ToolItem['result'] => ({ text, summary: text, isError, truncated: false, images: [] })
const todo = (...s: Array<[string, string]>) => tool('TodoWrite', { todos: s.map(([content, status]) => ({ content, status })) })

describe('todoListFrom', () => {
  it('is null without a list', () => {
    expect(todoListFrom([])).toBeNull()
    expect(todoListFrom([tool('Bash', {})])).toBeNull()
    expect(todoListFrom([tool('TodoWrite', { todos: [] })])).toBeNull()
  })

  it('reads the newest TodoWrite and counts done', () => {
    const list = todoListFrom([todo(['a', 'pending']), todo(['a', 'completed'], ['b', 'in_progress'], ['c', 'pending'], ['d', 'pending'])])!
    expect(list.tasks.map((t) => t.status)).toEqual(['done', 'active', 'pending', 'pending'])
    expect(list).toMatchObject({ done: 1, total: 4, percent: 25, allDone: false, finishedAt: null })
  })

  it('ignores sub-agent lists, failed calls and calls still being prepared', () => {
    const list = todoListFrom([
      todo(['main', 'pending']),
      tool('TodoWrite', { todos: [{ content: 'agent', status: 'pending' }] }, { parent: 'agent1' }),
      tool('TodoWrite', { todos: [{ content: 'bad', status: 'pending' }] }, { status: 'failed' }),
      tool('TodoWrite', { todos: [{ content: 'half', status: 'pending' }] }, { status: 'preparing' }),
    ])!
    expect(list.tasks.map((t) => t.name)).toEqual(['main'])
  })

  it('builds a list from TaskCreate and TaskUpdate, by the id in the result or by count', () => {
    const list = todoListFrom([
      tool('TaskCreate', { subject: 'One' }, { result: result('Task #1 created successfully: One') }),
      tool('TaskCreate', { subject: 'Two' }),
      tool('TaskCreate', { subject: 'Three' }),
      tool('TaskUpdate', { taskId: '1', status: 'completed' }),
      tool('TaskUpdate', { taskId: '2', status: 'in_progress', subject: 'Two, renamed' }),
      tool('TaskUpdate', { taskId: '3', status: 'deleted' }),
      tool('TaskUpdate', { taskId: '99', status: 'completed' }),
    ])!
    expect(list.tasks).toEqual([
      { id: '1', name: 'One', status: 'done' },
      { id: '2', name: 'Two, renamed', status: 'active' },
    ])
  })

  it('replaces the list from a TaskList result, as JSON or as lines', () => {
    const json = todoListFrom([tool('TaskList', {}, { result: result(JSON.stringify({ tasks: [{ id: '4', subject: 'A', status: 'in_progress' }] })) })])!
    expect(json.tasks).toEqual([{ id: '4', name: 'A', status: 'active' }])
    const lines = todoListFrom([tool('TaskList', {}, { result: result('#1 [completed] First\n#2 [pending] Second') })])!
    expect(lines.tasks.map((t) => [t.id, t.status])).toEqual([['1', 'done'], ['2', 'pending']])
  })

  it('is finished at the time of the call that ticked off the last item', () => {
    const last = todo(['a', 'completed'], ['b', 'completed'])
    const list = todoListFrom([todo(['a', 'completed'], ['b', 'pending']), last])!
    expect(list.allDone).toBe(true)
    expect(list.finishedAt).toBe((last as ToolItem).endedAt)
  })
})

describe('todoVisible', () => {
  const open = todoListFrom([todo(['a', 'pending'])])
  const doneItem = todo(['a', 'completed'])
  const done = todoListFrom([doneItem])
  const at = (doneItem as ToolItem).endedAt!

  it('shows an open list at any time and a finished one for two minutes', () => {
    expect(todoVisible(null, at)).toBe(false)
    expect(todoVisible(open, at + 10 * TODO_LINGER_MS)).toBe(true)
    expect(todoVisible(done, at + TODO_LINGER_MS - 1)).toBe(true)
    expect(todoVisible(done, at + TODO_LINGER_MS)).toBe(false)
  })
})

describe('todoWindow', () => {
  const tasks = (statuses: TodoTask['status'][]): TodoTask[] => statuses.map((status, i) => ({ id: String(i), name: `t${i}`, status }))

  it('returns everything under the cap', () => {
    expect(todoWindow(tasks(['done', 'active']), 5)).toMatchObject({ hidden: 0 })
  })

  it('keeps the first open item in view when cutting', () => {
    const w = todoWindow(tasks(['done', 'done', 'done', 'done', 'active', 'pending', 'pending', 'pending']), 4)
    expect(w.hidden).toBe(4)
    expect(w.shown.map((t) => t.id)).toEqual(['3', '4', '5', '6'])
  })

  it('shows the tail when everything is done', () => {
    expect(todoWindow(tasks(['done', 'done', 'done', 'done', 'done']), 3).shown.map((t) => t.id)).toEqual(['2', '3', '4'])
  })
})

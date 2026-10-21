import { existsSync, readdirSync, readFileSync, realpathSync, statSync, watch, type FSWatcher } from 'node:fs'
import { join } from 'node:path'
import { taskStages, type StageLine, type TaskInfo } from '../shared/engineering'

const tasksDir = (folder: string) => join(folder, '.operant', 'engineering')

// The files of one task folder with the time the newest of them changed.
function readTask1(dir: string): { files: string[]; at: number } {
  const files = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name)
  const at = files.reduce((max, f) => Math.max(max, statSync(join(dir, f)).mtimeMs), 0)
  return { files, at }
}

// A readable name for the task: the <title> of its spec, notes or slices page without the "Spec: " lead, else the folder name.
function taskTitle(dir: string, files: string[], name: string): string {
  for (const f of ['spec.html', 'notes.html', 'slices.html']) {
    if (!files.includes(f)) continue
    const t = /<title[^>]*>([^<]*)<\/title>/i.exec(readFileSync(join(dir, f), 'utf8'))?.[1]?.replace(/^\s*(spec|notes|slices)\s*:\s*/i, '').trim()
    if (t) return t
  }
  const words = name.replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// The project's newest Engineering task (the one whose files changed last, and after `clearedAt`); null when there is none.
export function readTask(folder: string, clearedAt = 0): TaskInfo | null {
  const root = tasksDir(folder)
  if (!existsSync(root)) return null
  let best: { name: string; dir: string; files: string[]; at: number } | null = null
  for (const e of readdirSync(root, { withFileTypes: true })) {
    if (!e.isDirectory()) continue
    const dir = join(root, e.name)
    const task = readTask1(dir)
    if (!best || task.at > best.at) best = { name: e.name, dir, ...task }
  }
  if (!best || best.at <= clearedAt) return null
  const slices = best.files.includes('slices.html') ? readFileSync(join(best.dir, 'slices.html'), 'utf8') : null
  return { name: best.name, title: taskTitle(best.dir, best.files, best.name), stages: taskStages(best.files, slices) }
}

export const readTaskStages = (folder: string): StageLine[] | null => readTask(folder)?.stages ?? null

const DEBOUNCE_MS = 50

// Calls onChange (debounced) when anything under the project's Engineering folder changes. Until that folder exists it
// watches the deepest existing parent, and moves down as the folders appear, so nothing is polled.
export function watchTasks(folder: string, onChange: () => void): () => void {
  // Windows reports long names: watching an 8.3 short path (C:\Users\ABCDEF~1) trips a libuv assertion that kills the process.
  if (!existsSync(folder)) return () => {}
  const real = realpathSync.native(folder)
  const levels = [tasksDir(real), join(real, '.operant'), real]
  let watcher: FSWatcher | null = null
  let level = -1
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  const arm = () => {
    const next = levels.findIndex((d) => existsSync(d))
    if (next === level || next < 0) return
    watcher?.close()
    level = next
    try {
      watcher = watch(levels[next]!, { recursive: next === 0 }, (_, name) => {
        // Above the Engineering folder only the next folder down matters, not every file of the project.
        if (next === 0 || name === (next === 1 ? 'engineering' : '.operant')) fire()
      })
      watcher.on('error', () => {})
    } catch {
      watcher = null
    }
  }
  function fire() {
    if (stopped) return
    // The watcher is swapped from the timer, not from its own callback: closing a watcher inside its callback crashes Node on Windows.
    timer ??= setTimeout(() => {
      timer = null
      if (stopped) return
      arm()
      onChange()
    }, DEBOUNCE_MS)
  }

  arm()
  return () => {
    stopped = true
    watcher?.close()
    if (timer) clearTimeout(timer)
  }
}

import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readTask, readTaskStages, watchTasks } from './task-stage'

let folder = ''
beforeEach(() => void (folder = mkdtempSync(join(tmpdir(), 'operant-stage-'))))
afterEach(() => rmSync(folder, { recursive: true, force: true }))

const task = (name: string, files: Record<string, string>, at?: number) => {
  const dir = join(folder, '.operant', 'engineering', name)
  mkdirSync(dir, { recursive: true })
  for (const [f, text] of Object.entries(files)) {
    writeFileSync(join(dir, f), text)
    if (at) utimesSync(join(dir, f), at, at)
  }
}
const current = (folderPath: string) => readTaskStages(folderPath)?.find((s) => s.state === 'current')?.key

describe('readTaskStages', () => {
  it('is null when the project has no Engineering folder', () => {
    expect(readTaskStages(folder)).toBeNull()
  })

  it('is null when the Engineering folder holds no task', () => {
    mkdirSync(join(folder, '.operant', 'engineering'), { recursive: true })
    expect(readTaskStages(folder)).toBeNull()
  })

  it('reads the stage of the only task', () => {
    task('a', { 'notes.html': 'n', 'spec.html': 's' })
    expect(current(folder)).toBe('spec')
  })

  it('reads the task whose files changed last', () => {
    task('old', { 'notes.html': 'n', 'spec.html': 's', 'slices.html': '<input type="checkbox" checked> 1. x' }, 1_000_000)
    task('new', { 'notes.html': 'n' }, 2_000_000)
    expect(current(folder)).toBe('frame')
  })

  it('counts the ticked slices of the newest task', () => {
    task('a', { 'spec.html': 's', 'slices.html': '<input type="checkbox" checked> 1. x <input type="checkbox"> 2. y' })
    expect(readTaskStages(folder)?.find((s) => s.key === 'build')?.detail).toBe('1 of 2')
  })
})

describe('readTask', () => {
  it('titles the task with its spec title without the "Spec: " lead', () => {
    task('stage-box', { 'spec.html': '<title>Spec: stage box and history lines</title>' })
    expect(readTask(folder)).toMatchObject({ name: 'stage-box', title: 'stage box and history lines' })
  })

  it('falls back to the folder name as words', () => {
    task('stage-box', { 'notes.html': '<p>no title</p>' })
    expect(readTask(folder)?.title).toBe('Stage box')
  })

  it('hides a task whose files did not change after it was cleared, and shows it again when they do', () => {
    task('a', { 'spec.html': 's' }, 1_000)
    expect(readTask(folder, 2_000_000)).toBeNull()
    task('a', { 'slices.html': 'x' }, 3_000)
    expect(readTask(folder, 2_000_000)?.name).toBe('a')
  })
})

const nextCall = (calls: { n: number }, from: number) =>
  new Promise<void>((resolve, reject) => {
    const t0 = Date.now()
    const id = setInterval(() => {
      if (calls.n > from) (clearInterval(id), resolve())
      else if (Date.now() - t0 > 4000) (clearInterval(id), reject(new Error('no change was reported')))
    }, 20)
  })

describe('watchTasks', () => {
  it('reports a change to a file in the task folder', async () => {
    task('a', { 'notes.html': 'n' })
    const calls = { n: 0 }
    const stop = watchTasks(folder, () => calls.n++)
    try {
      task('a', { 'spec.html': 's' })
      await nextCall(calls, 0)
    } finally {
      stop()
    }
  })

  it('keeps reporting after the Engineering folder is created later', async () => {
    const calls = { n: 0 }
    const stop = watchTasks(folder, () => calls.n++)
    try {
      task('a', { 'notes.html': 'n' })
      await nextCall(calls, 0)
      await new Promise((r) => setTimeout(r, 400))
      const before = calls.n
      task('a', { 'spec.html': 's' })
      await nextCall(calls, before)
    } finally {
      stop()
    }
  })

  it('reports nothing after it is stopped', async () => {
    task('a', { 'notes.html': 'n' })
    const calls = { n: 0 }
    watchTasks(folder, () => calls.n++)()
    task('a', { 'spec.html': 's' })
    await new Promise((r) => setTimeout(r, 400))
    expect(calls.n).toBe(0)
  })
})

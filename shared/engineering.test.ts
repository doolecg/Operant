import { describe, expect, it } from 'vitest'
import { buildPreamble, taskStages } from './engineering'

const row = (box: string, n: number) => `<li>${box} <b>${n}. Title</b></li>`
const slices = (ticked: number, total: number) => Array.from({ length: total }, (_, i) => row(i < ticked ? '<input type="checkbox" checked>' : '<input type="checkbox">', i + 1)).join('\n')
const at = (files: string[], html: string | null = null) => taskStages(files, html).map((s) => `${s.key}:${s.state}`).join(' ')

const dirs = { engineeringDir: 'C:\\Data\\engineering\\engineering', factoryDir: 'C:\\Data\\engineering\\factory\\' }

describe('taskStages', () => {
  it('lists the six stages in order with their labels', () => {
    expect(taskStages(['notes.html'], null).map((s) => s.label)).toEqual(['Frame', 'Spec', 'Slices', 'Plan OK', 'Build', 'Ship'])
  })

  it('is at Frame with only the notes page', () => {
    expect(at(['notes.html'])).toBe('frame:current spec:todo slices:todo plan:todo build:todo ship:todo')
  })

  it('is at Spec once the spec page exists', () => {
    expect(at(['notes.html', 'spec.html'])).toBe('frame:done spec:current slices:todo plan:todo build:todo ship:todo')
  })

  it('is at Slices when the slices page has no numbered slice yet', () => {
    expect(at(['notes.html', 'spec.html', 'slices.html'], '<h1>Slices</h1>')).toBe('frame:done spec:done slices:current plan:todo build:todo ship:todo')
  })

  it('waits for the plan OK when no slice is ticked', () => {
    const s = taskStages(['notes.html', 'spec.html', 'slices.html'], slices(0, 4))
    expect(s.map((x) => `${x.key}:${x.state}`).join(' ')).toBe('frame:done spec:done slices:done plan:current build:todo ship:todo')
    expect(s[3]?.detail).toBe('waiting for your OK')
  })

  it('is building with a count once a slice is ticked', () => {
    const s = taskStages(['spec.html', 'slices.html'], slices(2, 5))
    expect(s.map((x) => `${x.key}:${x.state}`).join(' ')).toBe('frame:done spec:done slices:done plan:done build:current ship:todo')
    expect(s[4]?.detail).toBe('2 of 5')
  })

  it('is at Ship when every slice is ticked', () => {
    expect(at(['spec.html', 'slices.html'], slices(3, 3))).toBe('frame:done spec:done slices:done plan:done build:done ship:current')
  })

  it('counts the [x] and [ ] text style and ignores criteria boxes', () => {
    const html = '[x] 1. First\n  <input type="checkbox" checked> criterion\n[ ] 2. Second\n  <input type="checkbox"> criterion'
    expect(taskStages(['spec.html', 'slices.html'], html)[4]?.detail).toBe('1 of 2')
  })

  it('treats a slices page that cannot be read as having no slices', () => {
    expect(at(['spec.html', 'slices.html'], null)).toBe('frame:done spec:done slices:current plan:todo build:todo ship:todo')
  })
})

describe('buildPreamble', () => {
  it('is empty when both modes are off', () => {
    expect(buildPreamble({ engineering: false, factory: false }, dirs)).toBe('')
  })

  it('names the flow skill and the rules when only Engineering is on', () => {
    const t = buildPreamble({ engineering: true, factory: false }, dirs)
    expect(t).toContain('Engineering Mode is on')
    expect(t).toContain('C:\\Data\\engineering\\engineering/skills/flow/SKILL.md')
    expect(t).toContain('Never push')
    expect(t).not.toContain('Factory')
  })

  it('names the factory skill, task card and worker brief when only Factory is on', () => {
    const t = buildPreamble({ engineering: false, factory: true }, dirs)
    expect(t).toContain('Subagent Factory Mode is on')
    expect(t).toContain('C:\\Data\\engineering\\factory/skills/factory/SKILL.md')
    expect(t).toContain('factory/skills/factory/task-card.md')
    expect(t).toContain('factory/skills/factory/worker-brief.md')
    expect(t).not.toContain('Engineering Mode')
  })

  it('carries both blocks when both are on, and stays short', () => {
    const t = buildPreamble({ engineering: true, factory: true }, dirs)
    expect(t).toContain('Engineering Mode is on')
    expect(t).toContain('Subagent Factory Mode is on')
    expect(t.split(/\s+/).length).toBeLessThan(350)
  })
})

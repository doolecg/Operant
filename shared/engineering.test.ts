import { describe, expect, it } from 'vitest'
import { buildPreamble } from './engineering'

const dirs = { engineeringDir: 'C:\\Data\\engineering\\engineering', factoryDir: 'C:\\Data\\engineering\\factory\\' }

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

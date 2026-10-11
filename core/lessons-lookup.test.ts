import { describe, expect, it } from 'vitest'
import type { Lesson } from '../shared/learn'
import { lessonLookup } from './lessons-store'

const lesson = (id: number, over: Partial<Lesson> = {}): Lesson =>
  ({ id, text: `text ${id}`, status: 'active', related: [], consolidatedInto: null, ...over }) as Lesson

describe('lessonLookup', () => {
  const all = new Map<number, Lesson>([
    [1, lesson(1, { related: [2, 3, 4, 5, 99] })],
    [2, lesson(2)],
    [3, lesson(3, { status: 'deleted' })],
    [4, lesson(4, { consolidatedInto: 2 })],
    [5, lesson(5)],
    [6, lesson(6, { status: 'stale' })],
  ])
  const look = lessonLookup({ getLesson: (id) => all.get(id) ?? null })

  it('isLive is false for deleted, consolidated, inactive and unknown lessons', () => {
    expect(look.isLive(1)).toBe(true)
    expect(look.isLive(3)).toBe(false)
    expect(look.isLive(4)).toBe(false)
    expect(look.isLive(6)).toBe(false)
    expect(look.isLive(99)).toBe(false)
  })

  it('related returns only active texts, at most two', () => {
    expect(look.related(1)).toEqual(['text 2', 'text 5'])
    expect(look.related(2)).toEqual([])
    expect(look.related(99)).toEqual([])
  })
})

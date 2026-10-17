import { describe, expect, it } from 'vitest'
import { PIXEL_ROWS, grain, pixelCols, pixelFrame, solidFrame } from './pixel-bar'

describe('pixelFrame', () => {
  it('lights the given fraction of the columns, with a glowing front while not full', () => {
    const f = pixelFrame(60, 0.5)
    expect(f.cols).toBe(20)
    expect([f.start, f.end]).toEqual([0, 10])
    expect(f.dots.filter((d) => d.col === 9)).toHaveLength(PIXEL_ROWS)
    expect(f.dots.filter((d) => d.col === 9).every((d) => d.tone === 'tint' && d.glow)).toBe(true)
    // The empty part only holds faint specks.
    expect(f.dots.filter((d) => d.col >= 10).every((d) => d.tone === 'tint' && d.opacity <= 0.17 && !d.glow)).toBe(true)
  })

  it('clamps odd fractions', () => {
    expect(pixelFrame(60, 1).end).toBe(20)
    expect(pixelFrame(60, 2).end).toBe(20)
    expect(pixelFrame(60, -1).end).toBe(0)
    expect(pixelFrame(60, Number.NaN).end).toBe(0)
  })

  it('runs a sweep patch along the track as the frames go by', () => {
    const a = pixelFrame(90, 0, true, 0)
    const b = pixelFrame(90, 0, true, 20)
    expect(a.end - a.start).toBe(9)
    expect(b.end).toBeGreaterThan(a.end)
    expect(b.end - b.start).toBe(9)
  })

  it('is steady for a frame and changes between frames', () => {
    expect(pixelFrame(120, 0.6, false, 4)).toEqual(pixelFrame(120, 0.6, false, 4))
    expect(pixelFrame(120, 0.6, false, 4).dots).not.toEqual(pixelFrame(120, 0.6, false, 8).dots)
  })

  it('fills the empty track with a wave while work runs', () => {
    const plain = pixelFrame(120, 0.2, false, 6).dots.filter((d) => d.col >= 8).length
    const wave = pixelFrame(120, 0.2, false, 6, true).dots.filter((d) => d.col >= 8).length
    expect(wave).toBeGreaterThan(plain)
  })

  it('lights every dot at full strength when solid', () => {
    const f = solidFrame(10)
    expect(f.dots).toHaveLength(10 * PIXEL_ROWS)
    expect(f.dots.every((d) => d.tone === 'to' && d.opacity === 1 && !d.glow)).toBe(true)
  })

  it('keeps at least one column and a steady grain', () => {
    expect(pixelCols(1)).toBe(1)
    expect(grain(5, 7)).toBe(grain(5, 7))
    expect(grain(5, 7)).toBeGreaterThanOrEqual(0)
    expect(grain(5, 7)).toBeLessThanOrEqual(1)
  })
})

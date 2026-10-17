// The pixel bar of the Dooles Tools mods (Flightdeck, Bottom Bar, Clean View): a dark rounded track of small dots,
// part of them lit, flickering frame by frame. Pure: the renderer draws the dots as SVG (components/ui/PixelBar.tsx).

export const PIXEL_PITCH = 3
export const PIXEL_ROWS = 3
export const PIXEL_HEIGHT = 9
// How often the dots are drawn again; the pattern itself changes every second frame.
export const PIXEL_FRAME_MS = 250

// 'to': the bar's colour. 'from': the same colour, dimmer (the tail). 'tint': the foreground colour (the front, specks).
export type PixelTone = 'to' | 'from' | 'tint'

export interface PixelDot {
  col: number
  row: number
  tone: PixelTone
  opacity: number
  glow: boolean
}

export interface PixelFrame {
  cols: number
  // Lit columns: [start, end). A sweep moves its span along the track with the frames.
  start: number
  end: number
  dots: PixelDot[]
}

// Every dot lit at full strength in the bar's colour: something finished.
export function solidFrame(cols: number): PixelFrame {
  const dots: PixelDot[] = []
  for (let col = 0; col < cols; col++) for (let row = 0; row < PIXEL_ROWS; row++) dots.push({ col, row, tone: 'to', opacity: 1, glow: false })
  return { cols, start: 0, end: cols, dots }
}

// A steady pseudo-random 0..1 per pixel, so a bar looks the same each time it is drawn for the same frame.
export function grain(i: number, seed: number): number {
  let h = (i * 374761393 + seed * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

export const pixelCols = (width: number): number => Math.max(1, Math.floor(width / PIXEL_PITCH))

/**
 * One frame of the bar `width` pixels wide. `fraction` of it is lit: sparse and dim at the tail, fuller and brighter
 * toward the front, where the last column is bright and glows. With `sweep` (work with no percent) a lit patch 30% of
 * the track runs along it instead. The empty track keeps a faint scatter that shifts too. `wave`: while work runs the
 * empty track also carries a slow rolling wave of faint pixels (Bottom Bar's look).
 */
export function pixelFrame(width: number, fraction: number, sweep = false, tick = 0, wave = false): PixelFrame {
  const cols = pixelCols(width)
  const t = Math.floor(tick / 2)
  const lit = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0))
  const span = Math.max(4, Math.round(cols * 0.3))
  const sweepEnd = (t % (cols + span)) + 1
  const start = sweep ? sweepEnd - span : 0
  const end = sweep ? sweepEnd : Math.round(cols * lit)
  const dots: PixelDot[] = []
  const dot = (col: number, row: number, tone: PixelTone, opacity: number, glow = false) => dots.push({ col, row, tone, opacity: Math.round(opacity * 100) / 100, glow })
  for (let c = 0; c < cols; c++) {
    const isLit = c >= start && c < end
    const isHead = isLit && c === end - 1 && (sweep || lit < 1)
    const b = end - start <= 1 ? 1 : (c - start) / (end - start - 1)
    for (let r = 0; r < PIXEL_ROWS; r++) {
      const i = c * PIXEL_ROWS + r
      if (isHead) {
        dot(c, r, 'tint', 0.75 + 0.25 * grain(i, t + 3), true)
      } else if (isLit && c >= end - 5) {
        // The few columns behind the front: dense and bright, some glowing.
        if (grain(i, t * 7 + 11) > 0.92) continue
        const near = (c - (end - 5)) / 4
        const hot = grain(i, t * 13 + 5) > 0.55 - 0.3 * near
        dot(c, r, hot ? 'tint' : 'to', 0.7 + 0.3 * grain(i, t + 19), hot && near > 0.4)
      } else if (isLit) {
        // Fuller toward the front, and a fresh draw each frame.
        if (grain(i, t * 7 + 11) > 0.3 + 0.65 * b) continue
        const o = 0.2 + 0.75 * b * (0.35 + 0.65 * grain(i, t * 13 + 5))
        dot(c, r, grain(i, t + 17) > 0.85 ? 'from' : 'to', o)
      } else if (wave) {
        const crest = Math.sin(c * 0.32 - tick * 0.45 + r * 0.6)
        const o = 0.04 + 0.26 * Math.max(0, crest) * (0.6 + 0.4 * grain(i, t + 31))
        if (crest > -0.2 || grain(i, t + 37) > 0.8) dot(c, r, crest > 0.75 ? 'tint' : 'to', o)
      } else if (grain(i, Math.floor(t / 2) * 3 + 23) > 0.84) {
        dot(c, r, 'tint', 0.05 + 0.12 * grain(i, t + 29))
      }
    }
  }
  return { cols, start, end, dots }
}

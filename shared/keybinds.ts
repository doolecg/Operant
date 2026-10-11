// Pure keybind helpers. Accelerators look like "Mod+Shift+P" or, for mouse buttons, "Alt+Mouse4".
// Left and right click can never be bound; only middle, back and forward.

// DOM MouseEvent.button -> token. Mouse3 is the middle button, Mouse4 is back, Mouse5 is forward.
export const MOUSE_BUTTON_TOKENS: Readonly<Record<number, string>> = { 1: 'Mouse3', 3: 'Mouse4', 4: 'Mouse5' }

const MOUSE_LABELS: Readonly<Record<string, string>> = { Mouse3: 'Middle click', Mouse4: 'Mouse back', Mouse5: 'Mouse forward' }

const MODIFIER_TOKENS = new Set(['Mod', 'Ctrl', 'Alt', 'Shift'])

export const isMouseToken = (token: string): boolean => /^Mouse\d+$/.test(token)

export const isMouseAccel = (accel: string): boolean => isMouseToken(accel.split('+').pop() ?? '')

export interface MouseLike {
  button: number
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

// The accelerator for a mouse press, or null for buttons that cannot be bound (left, right).
export function mouseToAccel(e: MouseLike, mac: boolean): string | null {
  const token = MOUSE_BUTTON_TOKENS[e.button]
  if (!token) return null
  const mod = mac ? e.metaKey : e.ctrlKey
  const parts = [mod && 'Mod', mac && e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', token]
  return parts.filter(Boolean).join('+')
}

// True when the press is exactly this mouse accelerator.
export const matchesMouse = (e: MouseLike, accel: string, mac: boolean): boolean => !!accel && mouseToAccel(e, mac) === accel

// The mouse button number (MouseEvent.button) an accelerator ends in, or null.
export function mouseButtonOf(accel: string): number | null {
  const last = accel.split('+').pop() ?? ''
  const hit = Object.entries(MOUSE_BUTTON_TOKENS).find(([, t]) => t === last)
  return hit ? Number(hit[0]) : null
}

// Keeps a stored accelerator when it is sane. Mouse accelerators must be modifiers plus one allowed button.
export function sanitizeAccel(value: unknown, fallback: string, max = 40): string {
  if (typeof value !== 'string') return fallback
  const v = value.trim().slice(0, max)
  if (!v.includes('Mouse')) return v
  const parts = v.split('+')
  const token = parts.pop() ?? ''
  const ok = Object.values(MOUSE_BUTTON_TOKENS).includes(token) && parts.every((p) => MODIFIER_TOKENS.has(p))
  return ok ? v : fallback
}

// Readable label for one part of an accelerator (mouse buttons get words, the rest is returned as is).
export const mouseLabel = (token: string): string => MOUSE_LABELS[token] ?? token

// The key name a keyboard event stands for, as used in accelerators; null for bare modifiers.
export function keyNameOf(e: { key: string; code: string }): string | null {
  if (e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta') return null
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3)
  if (/^Digit[0-9]$/.test(e.code)) return e.code.slice(5)
  if (e.key === ' ') return 'Space'
  return e.key.length === 1 ? e.key.toUpperCase() : e.key
}

// For hold-to-talk: does this keyup end a keyboard accelerator (its main key, or one of its modifiers, let go)?
export function releasesAccel(e: { key: string; code: string }, accel: string, mac: boolean): boolean {
  if (!accel || isMouseAccel(accel)) return false
  const parts = accel.split('+')
  const main = parts.pop()
  const name = keyNameOf(e)
  if (name) return name === main
  const modKey = (p: string) => (p === 'Mod' ? (mac ? 'Meta' : 'Control') : p === 'Ctrl' ? 'Control' : p)
  return parts.some((p) => modKey(p) === e.key)
}

import { describe, expect, it } from 'vitest'
import { isMouseAccel, keyNameOf, matchesMouse, mouseButtonOf, mouseLabel, mouseToAccel, releasesAccel, sanitizeAccel } from './keybinds'
import { DEFAULT_SETTINGS, sanitizeSettings } from './settings'

const press = (button: number, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({
  button,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
})

describe('mouse keybinds', () => {
  it('maps middle, back and forward but never left or right click', () => {
    expect(mouseToAccel(press(1), false)).toBe('Mouse3')
    expect(mouseToAccel(press(3), false)).toBe('Mouse4')
    expect(mouseToAccel(press(4), false)).toBe('Mouse5')
    expect(mouseToAccel(press(0), false)).toBeNull()
    expect(mouseToAccel(press(2), false)).toBeNull()
  })

  it('adds modifiers in a fixed order, Mod being Ctrl or Cmd', () => {
    expect(mouseToAccel(press(3, { ctrlKey: true, shiftKey: true }), false)).toBe('Mod+Shift+Mouse4')
    expect(mouseToAccel(press(3, { metaKey: true, altKey: true }), true)).toBe('Mod+Alt+Mouse4')
    expect(mouseToAccel(press(3, { ctrlKey: true }), true)).toBe('Ctrl+Mouse4')
  })

  it('matches only the exact accelerator', () => {
    expect(matchesMouse(press(3), 'Mouse4', false)).toBe(true)
    expect(matchesMouse(press(3, { altKey: true }), 'Mouse4', false)).toBe(false)
    expect(matchesMouse(press(4), 'Mouse4', false)).toBe(false)
    expect(matchesMouse(press(3), '', false)).toBe(false)
  })

  it('reads the button and kind of an accelerator', () => {
    expect(isMouseAccel('Alt+Mouse5')).toBe(true)
    expect(isMouseAccel('Alt+D')).toBe(false)
    expect(mouseButtonOf('Alt+Mouse5')).toBe(4)
    expect(mouseButtonOf('Mouse3')).toBe(1)
    expect(mouseButtonOf('Alt+D')).toBeNull()
  })

  it('labels mouse buttons in words', () => {
    expect(mouseLabel('Mouse4')).toBe('Mouse back')
    expect(mouseLabel('Mouse5')).toBe('Mouse forward')
    expect(mouseLabel('Mouse3')).toBe('Middle click')
    expect(mouseLabel('Alt')).toBe('Alt')
  })
})

describe('sanitizeAccel', () => {
  it('keeps keyboard and valid mouse accelerators', () => {
    expect(sanitizeAccel(' Alt+D ', 'x')).toBe('Alt+D')
    expect(sanitizeAccel('Mouse4', 'x')).toBe('Mouse4')
    expect(sanitizeAccel('Mod+Shift+Mouse5', 'x')).toBe('Mod+Shift+Mouse5')
    expect(sanitizeAccel('', 'x')).toBe('')
  })

  it('rejects left and right click, unknown buttons and junk', () => {
    expect(sanitizeAccel('Mouse1', 'Alt+D')).toBe('Alt+D')
    expect(sanitizeAccel('Mouse2', 'Alt+D')).toBe('Alt+D')
    expect(sanitizeAccel('Mouse9', 'Alt+D')).toBe('Alt+D')
    expect(sanitizeAccel('Foo+Mouse4', 'Alt+D')).toBe('Alt+D')
    expect(sanitizeAccel(42, 'Alt+D')).toBe('Alt+D')
  })

  it('is applied to stored settings, and dictation mode is checked', () => {
    expect(sanitizeSettings({ keybinds: { dictate: 'Mouse4', zoomIn: 'Mouse1' } }).keybinds).toMatchObject({
      dictate: 'Mouse4',
      zoomIn: DEFAULT_SETTINGS.keybinds.zoomIn,
    })
    expect(DEFAULT_SETTINGS.dictation.mode).toBe('toggle')
    expect(sanitizeSettings({ dictation: { mode: 'hold' } }).dictation).toEqual({ enabled: true, mode: 'hold' })
    expect(sanitizeSettings({ dictation: { mode: 'sideways' } }).dictation.mode).toBe('toggle')
    expect(sanitizeSettings({}).dictation.mode).toBe('toggle')
  })
})

describe('hold-to-talk release', () => {
  it('names keys like the recorder does', () => {
    expect(keyNameOf({ key: 'd', code: 'KeyD' })).toBe('D')
    expect(keyNameOf({ key: 'Alt', code: 'AltLeft' })).toBeNull()
    expect(keyNameOf({ key: ' ', code: 'Space' })).toBe('Space')
  })

  it('ends on the main key or a held modifier, not on other keys', () => {
    expect(releasesAccel({ key: 'd', code: 'KeyD' }, 'Alt+D', false)).toBe(true)
    expect(releasesAccel({ key: 'Alt', code: 'AltLeft' }, 'Alt+D', false)).toBe(true)
    expect(releasesAccel({ key: 'Shift', code: 'ShiftLeft' }, 'Alt+D', false)).toBe(false)
    expect(releasesAccel({ key: 'x', code: 'KeyX' }, 'Alt+D', false)).toBe(false)
    expect(releasesAccel({ key: 'Control', code: 'ControlLeft' }, 'Mod+D', false)).toBe(true)
    expect(releasesAccel({ key: 'Meta', code: 'MetaLeft' }, 'Mod+D', true)).toBe(true)
    expect(releasesAccel({ key: 'd', code: 'KeyD' }, 'Mouse4', false)).toBe(false)
  })
})

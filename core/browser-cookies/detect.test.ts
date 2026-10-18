import { describe, expect, it } from 'vitest'
import { defaultFirefoxProfilePath, linuxFamilyFromDesktop, macFamilyFromBundleId, parseMacDefaultBrowser, parseRegProgId, windowsFamilyFromProgId } from './detect'

describe('windowsFamilyFromProgId', () => {
  it('recognises Firefox and its forks', () => {
    expect(windowsFamilyFromProgId('FirefoxURL-308046B0AF4A39CB')).toEqual({ engine: 'firefox', name: 'Firefox' })
    expect(windowsFamilyFromProgId('LibreWolfURL-abc')?.name).toBe('LibreWolf')
    expect(windowsFamilyFromProgId('ZenURL-abc')?.name).toBe('Zen')
  })
  it('recognises Chromium browsers', () => {
    expect(windowsFamilyFromProgId('ChromeHTML')).toEqual({ engine: 'chromium', name: 'Google Chrome' })
    expect(windowsFamilyFromProgId('MSEdgeHTM')?.name).toBe('Microsoft Edge')
    expect(windowsFamilyFromProgId('BraveHTML')?.name).toBe('Brave')
    expect(windowsFamilyFromProgId('VivaldiHTM')?.name).toBe('Vivaldi')
    expect(windowsFamilyFromProgId('OperaStable')?.name).toBe('Opera')
  })
  it('returns null for an unknown ProgId', () => {
    expect(windowsFamilyFromProgId('AppXsomething')).toBeNull()
  })
})

describe('parseRegProgId', () => {
  it('pulls the ProgId out of reg query output', () => {
    const out = '\r\nHKEY_CURRENT_USER\\...\\UserChoice\r\n    ProgId    REG_SZ    ChromeHTML\r\n\r\n'
    expect(parseRegProgId(out)).toBe('ChromeHTML')
  })
  it('returns null when absent', () => {
    expect(parseRegProgId('nothing here')).toBeNull()
  })
})

describe('defaultFirefoxProfilePath', () => {
  it('prefers the Install section default', () => {
    const ini = `[Install123]
Default=Profiles/aaaa.default-release
Locked=1

[Profile0]
Name=default-release
Path=Profiles/aaaa.default-release
Default=1

[Profile1]
Name=old
Path=Profiles/bbbb.default`
    expect(defaultFirefoxProfilePath(ini)).toBe('Profiles/aaaa.default-release')
  })
  it('falls back to the Default=1 profile, then the first', () => {
    const ini = `[Profile0]
Path=p0

[Profile1]
Path=p1
Default=1`
    expect(defaultFirefoxProfilePath(ini)).toBe('p1')
    expect(defaultFirefoxProfilePath('[Profile0]\nPath=only')).toBe('only')
  })
})

describe('macFamilyFromBundleId', () => {
  it('maps bundle ids', () => {
    expect(macFamilyFromBundleId('com.google.chrome')?.name).toBe('Google Chrome')
    expect(macFamilyFromBundleId('org.mozilla.firefox')?.engine).toBe('firefox')
    expect(macFamilyFromBundleId('com.apple.safari')).toBeNull()
  })
})

describe('parseMacDefaultBrowser', () => {
  it('finds the https handler', () => {
    const json = JSON.stringify({ LSHandlers: [{ LSHandlerURLScheme: 'http', LSHandlerRoleAll: 'com.a' }, { LSHandlerURLScheme: 'https', LSHandlerRoleAll: 'com.google.chrome' }] })
    expect(parseMacDefaultBrowser(json)).toBe('com.google.chrome')
  })
  it('returns null on bad input', () => {
    expect(parseMacDefaultBrowser('not json')).toBeNull()
    expect(parseMacDefaultBrowser('{}')).toBeNull()
  })
})

describe('linuxFamilyFromDesktop', () => {
  it('maps .desktop names', () => {
    expect(linuxFamilyFromDesktop('firefox.desktop')?.engine).toBe('firefox')
    expect(linuxFamilyFromDesktop('google-chrome.desktop')?.name).toBe('Google Chrome')
    expect(linuxFamilyFromDesktop('brave-browser.desktop')?.name).toBe('Brave')
    expect(linuxFamilyFromDesktop('chromium.desktop')?.name).toBe('Chromium')
    expect(linuxFamilyFromDesktop('something-else.desktop')).toBeNull()
  })
})

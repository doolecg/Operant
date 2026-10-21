import { win32 } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyToolPaths, findInDefaults, type LocationDeps } from './tool-locations'

const W = (...parts: string[]) => win32.join('C:/Users/me', ...parts)

const deps = (platform: NodeJS.Platform, present: string[], over: Partial<LocationDeps> = {}): LocationDeps => ({
  platform,
  env: { APPDATA: W('AppData', 'Roaming') },
  home: platform === 'win32' ? W() : '/home/me',
  exists: (p) => present.includes(p),
  listDir: () => [],
  ...over,
})

describe('findInDefaults', () => {
  it('finds a program an installer put in a default folder', () => {
    const claude = W('.local', 'bin', 'claude.exe')
    expect(findInDefaults('claude', deps('win32', [claude]))).toBe(claude)
  })

  it('finds an npm global .cmd on Windows', () => {
    const opencode = W('AppData', 'Roaming', 'npm', 'opencode.cmd')
    expect(findInDefaults('opencode', deps('win32', [opencode]))).toBe(opencode)
  })

  it('finds Node under nvm on Linux', () => {
    const d = deps('linux', ['/home/me/.nvm/versions/node/v22.1.0/bin/node'], { listDir: (dir) => (dir === '/home/me/.nvm/versions/node' ? ['v22.1.0'] : []) })
    expect(findInDefaults('nodejs', d)).toBe('/home/me/.nvm/versions/node/v22.1.0/bin/node')
  })

  it('is null when nothing is there, and for ids that are not programs', () => {
    expect(findInDefaults('uv', deps('linux', []))).toBeNull()
    expect(findInDefaults('dictation', deps('linux', []))).toBeNull()
  })
})

describe('applyToolPaths', () => {
  it('puts the chosen folders in front of PATH and takes them out again', () => {
    const env: NodeJS.ProcessEnv = { PATH: '/usr/bin' }
    applyToolPaths({ claude: '/opt/claude/bin/claude' }, env, 'linux')
    expect(env.PATH).toBe('/opt/claude/bin:/usr/bin')
    applyToolPaths({}, env, 'linux')
    expect(env.PATH).toBe('/usr/bin')
  })

  it('leaves the environment alone when there never were paths', () => {
    const env: NodeJS.ProcessEnv = { PATH: '/usr/bin' }
    applyToolPaths({}, env, 'linux')
    expect(env.PATH).toBe('/usr/bin')
  })
})

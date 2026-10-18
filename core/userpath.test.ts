import { describe, expect, it } from 'vitest'
import { expandWin, mergePath, parseRegPath } from './userpath'

describe('user PATH', () => {
  it('reads the Path value from reg query output', () => {
    const out = '\r\nHKEY_CURRENT_USER\\Environment\r\n    Path    REG_EXPAND_SZ    %USERPROFILE%\\.local\\bin;C:\\Tools\r\n\r\n'
    expect(parseRegPath(out)).toBe('%USERPROFILE%\\.local\\bin;C:\\Tools')
    expect(parseRegPath('    Path    REG_SZ    C:\\A')).toBe('C:\\A')
    expect(parseRegPath('ERROR: The system was unable to find the specified registry key or value.')).toBeNull()
  })

  it('expands %VARS% case-insensitively and leaves unknown ones', () => {
    expect(expandWin('%UserProfile%\\.local\\bin;%NOPE%\\x', { USERPROFILE: 'C:\\Users\\me' })).toBe('C:\\Users\\me\\.local\\bin;%NOPE%\\x')
  })

  it('appends only the entries the PATH lacks, keeping its order first', () => {
    const merged = mergePath('C:\\WINDOWS\\system32;C:\\Program Files\\nodejs\\', ['c:\\windows\\System32', 'C:\\Program Files\\nodejs', 'C:\\Users\\me\\.local\\bin', ' '], 'win32')
    expect(merged).toBe('C:\\WINDOWS\\system32;C:\\Program Files\\nodejs\\;C:\\Users\\me\\.local\\bin')
    expect(mergePath('/usr/bin:/bin', ['/bin', '/home/me/.local/bin'], 'linux')).toBe('/usr/bin:/bin:/home/me/.local/bin')
  })
})

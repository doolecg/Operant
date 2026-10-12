import { describe, expect, it } from 'vitest'
import { autoOpenPath, relativeInProject } from './docs'

describe('relativeInProject', () => {
  it('handles absolute posix and windows paths', () => {
    expect(relativeInProject('/home/a/proj', '/home/a/proj/docs/x.md')).toBe('docs/x.md')
    expect(relativeInProject('C:\\Users\\a\\proj', 'c:\\users\\a\\proj\\docs\\x.md')).toBe('docs/x.md')
  })
  it('refuses paths outside the folder, siblings and climbing', () => {
    expect(relativeInProject('/home/a/proj', '/home/a/proj2/docs/x.md')).toBeNull()
    expect(relativeInProject('/home/a/proj', '/etc/x.md')).toBeNull()
    expect(relativeInProject('/home/a/proj', 'docs/../../x.md')).toBeNull()
    expect(relativeInProject('/home/a/proj', '/home/a/proj')).toBeNull()
  })
  it('takes a relative path as relative to the folder', () => {
    expect(relativeInProject('/p', './docs/a.html')).toBe('docs/a.html')
  })
})

describe('autoOpenPath', () => {
  const root = '/p'
  it('opens a new html or md file in a doc folder or below one', () => {
    expect(autoOpenPath(root, '/p/docs/a.md', true)).toBe('docs/a.md')
    expect(autoOpenPath(root, '/p/Plans/x/y.HTML', true)).toBe('Plans/x/y.HTML')
    expect(autoOpenPath(root, '/p/src/design/page.htm', true)).toBe('src/design/page.htm')
  })
  it('ignores edits, other kinds and other folders', () => {
    expect(autoOpenPath(root, '/p/docs/a.md', false)).toBeNull()
    expect(autoOpenPath(root, '/p/docs/a.pdf', true)).toBeNull()
    expect(autoOpenPath(root, '/p/src/a.md', true)).toBeNull()
    expect(autoOpenPath(root, '/p/docs.md', true)).toBeNull()
    expect(autoOpenPath(root, '/elsewhere/docs/a.md', true)).toBeNull()
  })
})

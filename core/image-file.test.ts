import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { IMAGE_FILE_MAX, readProjectImage } from './image-file'

let base: string
let proj: string
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'opimg-'))
  proj = join(base, 'proj')
  mkdirSync(join(proj, 'docs'), { recursive: true })
  writeFileSync(join(proj, 'docs', 'a.png'), Buffer.from([1, 2, 3]))
  writeFileSync(join(base, 'outside.png'), Buffer.from([9]))
  writeFileSync(join(proj, 'notes.txt'), 'x')
})
afterEach(() => rmSync(base, { recursive: true, force: true }))

describe('readProjectImage', () => {
  it('reads a project image by relative or absolute path as a data URL', () => {
    const want = { mediaType: 'image/png', dataUrl: 'data:image/png;base64,AQID' }
    expect(readProjectImage(proj, 'docs/a.png')).toEqual(want)
    expect(readProjectImage(proj, join(proj, 'docs', 'a.png'))).toEqual(want)
  })
  it('refuses paths outside the project, missing files and other types', () => {
    expect(() => readProjectImage(proj, join(base, 'outside.png'))).toThrow(/outside the project/)
    expect(() => readProjectImage(proj, '../outside.png')).toThrow(/outside the project/)
    expect(() => readProjectImage(proj, 'docs/none.png')).toThrow(/outside the project/)
    expect(() => readProjectImage(proj, 'notes.txt')).toThrow(/image can be shown/)
  })
  it('refuses an image over the size cap', () => {
    writeFileSync(join(proj, 'big.png'), Buffer.alloc(IMAGE_FILE_MAX + 1))
    expect(() => readProjectImage(proj, 'big.png')).toThrow(/over 8 MB/)
  })
})

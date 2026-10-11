import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_MEMORY_SETTINGS } from '../shared/aux-settings'
import { SOUL_BANK, bankFor } from './hindsight'
import { RECALL_HEADER, recallFile, recallKey, recallText, writeRecallFor } from './session-recall'

const dirs: string[] = []
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))
const tmp = () => (dirs[dirs.length] = mkdtempSync(join(tmpdir(), 'recall-')))
const FOLDER = '/code/shop'

describe('session recall file', () => {
  it('keys a folder the same with either slash and any case', () => {
    expect(recallKey('C:\\Code\\Shop\\')).toBe(recallKey('c:/code/shop'))
  })

  it('wraps entries as reference data, scrubs secrets and respects the token cap', () => {
    const text = recallText(['Use pnpm. token=abcdefghijklmnop1234', 'x'.repeat(4000)], 100)
    expect(text.startsWith(RECALL_HEADER)).toBe(true)
    expect(text).not.toContain('abcdefghijklmnop1234')
    expect(text).not.toContain('xxxx')
    expect(recallText([], 100)).toBe('')
  })

  it('writes the soul and project lessons, keeps the old file when the server fails, clears it when recall is off', async () => {
    const dir = tmp()
    const ok = { recall: async (bank: string) => ({ ok: true as const, items: bank === SOUL_BANK ? ['Prefers short replies'] : bank === bankFor(FOLDER) ? ['Tests use vitest'] : [] }) }
    expect(await writeRecallFor(dir, FOLDER, ok, DEFAULT_MEMORY_SETTINGS)).toBe(true)
    const body = readFileSync(recallFile(dir, FOLDER), 'utf8')
    expect(body).toContain('Prefers short replies')
    expect(body).toContain('Tests use vitest')
    const down = { recall: async () => ({ ok: false as const, error: 'unreachable' }) }
    expect(await writeRecallFor(dir, FOLDER, down, DEFAULT_MEMORY_SETTINGS)).toBe(false)
    expect(existsSync(recallFile(dir, FOLDER))).toBe(true)
    await writeRecallFor(dir, FOLDER, ok, { ...DEFAULT_MEMORY_SETTINGS, recallMode: 'off' })
    expect(existsSync(recallFile(dir, FOLDER))).toBe(false)
  })
})

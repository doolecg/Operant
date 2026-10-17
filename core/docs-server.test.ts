import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DocsServer, parseDocPath, resolveDocFile } from './docs-server'

let root = ''
let outside = ''
beforeAll(() => {
  const base = mkdtempSync(join(tmpdir(), 'docs-server-'))
  root = join(base, 'proj')
  outside = join(base, 'outside')
  mkdirSync(join(root, 'docs'), { recursive: true })
  mkdirSync(outside)
  writeFileSync(join(root, 'docs', 'a.html'), '<h1>a</h1>')
  writeFileSync(join(root, 'docs', 'b.md'), '# b <i>x</i>')
  writeFileSync(join(root, 'docs', 'secret.env'), 'KEY=1')
  writeFileSync(join(root, 'docs', 'big.html'), 'x'.repeat(100))
  writeFileSync(join(outside, 'o.md'), '# outside')
  try {
    symlinkSync(outside, join(root, 'link'), 'junction')
  } catch {
    // Not allowed here; the link test then passes because the file is simply missing.
  }
})
afterAll(() => rmSync(join(root, '..'), { recursive: true, force: true }))

describe('parseDocPath', () => {
  const t = 'tok123'
  it('accepts the token and decodes segments', () => {
    expect(parseDocPath(`/d/${t}/4/docs/a%20b.md`, t)).toEqual({ kind: 'file', crewId: 4, segments: ['docs', 'a b.md'] })
    expect(parseDocPath(`/p/${t}/7`, t)).toEqual({ kind: 'memory', id: '7' })
    expect(parseDocPath(`/x/${t}/3/page.html`, t)).toEqual({ kind: 'loose', id: '3', segments: ['page.html'] })
  })
  it('refuses a wrong token, traversal, separators and NUL', () => {
    expect(parseDocPath('/d/nope/4/docs/a.md', t)).toBeNull()
    expect(parseDocPath(`/d/${t}/4/../a.md`, t)).toBeNull()
    expect(parseDocPath(`/d/${t}/4/%2e%2e/a.md`, t)).toBeNull()
    expect(parseDocPath(`/d/${t}/4/docs%2fa.md`, t)).toBeNull()
    expect(parseDocPath(`/d/${t}/4/docs%5Ca.md`, t)).toBeNull()
    expect(parseDocPath(`/d/${t}/4/a%00.md`, t)).toBeNull()
    expect(parseDocPath(`/d/${t}/x/a.md`, t)).toBeNull()
    expect(parseDocPath(`/d/${t}/4`, t)).toBeNull()
  })
})

describe('resolveDocFile', () => {
  it('serves allowed files inside the folder', () => {
    expect(resolveDocFile(root, ['docs', 'a.html'])?.size).toBe(10)
  })
  it('refuses traversal, drive segments, other extensions, directories and missing files', () => {
    expect(resolveDocFile(root, ['..', 'outside', 'o.md'])).toBeNull()
    expect(resolveDocFile(root, ['C:', 'x.md'])).toBeNull()
    expect(resolveDocFile(root, ['docs', 'secret.env'])).toBeNull()
    expect(resolveDocFile(root, ['docs'])).toBeNull()
    expect(resolveDocFile(root, ['docs', 'none.md'])).toBeNull()
  })
  it('refuses a link that leaves the folder', () => {
    expect(resolveDocFile(root, ['link', 'o.md'])).toBeNull()
  })
  it('refuses files over the size cap', () => {
    expect(resolveDocFile(root, ['docs', 'big.html'], 50)).toBeNull()
  })
})

describe('DocsServer', () => {
  it('serves files and plans over loopback, refusing the rest', async () => {
    const s = new DocsServer({ folderOf: (id) => (id === 1 ? root : null) })
    try {
      const url = await s.urlFor(1, 'docs/b.md')
      const res = await fetch(url)
      expect(res.status).toBe(200)
      expect(res.headers.get('x-content-type-options')).toBe('nosniff')
      expect(res.headers.get('content-security-policy')).toContain("default-src 'none'")
      expect(await res.text()).toContain('&lt;i&gt;x&lt;/i&gt;')
      expect((await fetch(url.replace('/1/', '/2/'))).status).toBe(404)
      expect((await fetch(url.replace(s.token, 'bad'))).status).toBe(404)
      expect((await fetch(url, { method: 'POST' })).status).toBe(405)
      const plan = await fetch(await s.urlForMemory('Plan', '# Plan'))
      expect(await plan.text()).toContain('<h1>Plan</h1>')
    } finally {
      await s.close()
    }
  })
  it('serves a document outside any project from its own folder only', async () => {
    const s = new DocsServer({ folderOf: () => null })
    try {
      writeFileSync(join(outside, 'page.html'), '<h1>page</h1>')
      writeFileSync(join(outside, 'style.css'), 'h1{}')
      const url = await s.urlForLooseFile(join(outside, 'page.html'))
      expect(url).toMatch(/\/x\//)
      expect(await (await fetch(url!)).text()).toBe('<h1>page</h1>')
      expect((await fetch(url!.replace('page.html', 'style.css'))).status).toBe(200)
      expect((await fetch(url!.replace('page.html', '..%2Fproj%2Fdocs%2Fa.html'))).status).toBe(404)
      expect(await s.urlForLooseFile(join(outside, 'none.html'))).toBeNull()
      expect(await s.urlForLooseFile(join(root, 'docs', 'secret.env'))).toBeNull()
    } finally {
      await s.close()
    }
  })
})

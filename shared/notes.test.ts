import { describe, expect, it } from 'vitest'
import { markdownNoteToHtml, noteHtmlToSave, noteTextToHtml, sanitizeNoteHtml } from './notes'

describe('sanitizeNoteHtml', () => {
  it('removes scripts, handlers and unknown tags but keeps b, i, ul, li', () => {
    const out = sanitizeNoteHtml('<script>alert(1)</script><b onclick="x()" style="color:red">a</b><a href="http://x">l</a><img src=x onerror=y><ul><li><i>b</i></li></ul>')
    expect(out).toBe('<b>a</b>l<ul><li><i>b</i></li></ul>')
  })
  it('keeps only data-checked on the checkbox span and drops other spans', () => {
    expect(sanitizeNoteHtml('<span class="x" data-checked="true" onclick="y">t</span>')).toBe('<span data-checked="true">t</span>')
    expect(sanitizeNoteHtml('<span style="a">t</span>')).toBe('t')
  })
  it('maps strong and em to b and i', () => {
    expect(sanitizeNoteHtml('<strong>a</strong><em>b</em>')).toBe('<b>a</b><i>b</i>')
  })
})

describe('markdownNoteToHtml', () => {
  it('converts bold and italic', () => {
    expect(markdownNoteToHtml('a **hi** and *there*')).toBe('<div>a <b>hi</b> and <i>there</i></div>')
  })
  it('converts bullets and checklist lines', () => {
    expect(markdownNoteToHtml('- a\n- [ ] b\n- [x] c\nend')).toBe(
      '<ul><li>a</li><li><span data-checked="false"></span>b</li><li><span data-checked="true"></span>c</li></ul><div>end</div>',
    )
  })
  it('keeps angle brackets escaped', () => {
    expect(noteTextToHtml('1 < 2 and <3')).toBe('<div>1 &lt; 2 and &lt;3</div>')
  })
})

describe('noteTextToHtml and noteHtmlToSave', () => {
  it('sanitises stored html and migrates old text', () => {
    expect(noteTextToHtml('<div onclick="x">a</div>')).toBe('<div>a</div>')
    expect(noteTextToHtml('**x**')).toBe('<div><b>x</b></div>')
  })
  it('wraps plain text and empties blank notes', () => {
    expect(noteHtmlToSave('a &lt; b')).toBe('<div>a &lt; b</div>')
    expect(noteHtmlToSave('<div><br></div>')).toBe('')
    expect(noteHtmlToSave('<ul><li><span data-checked="false"></span><br></li></ul>')).toContain('data-checked')
  })
})

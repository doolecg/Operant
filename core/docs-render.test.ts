import { describe, expect, it } from 'vitest'
import { renderMarkdownPage } from './docs-render'

describe('renderMarkdownPage', () => {
  it('renders headings, lists and code', () => {
    const html = renderMarkdownPage('T', '# Hi\n\n- a\n- b\n\n```\nx < y\n```')
    expect(html).toContain('<h1>Hi</h1>')
    expect(html).toContain('<ul>')
    expect(html).toContain('x &lt; y')
  })
  it('escapes raw HTML and the title', () => {
    const html = renderMarkdownPage('<b>t</b>', 'Hello <script>alert(1)</script> **bold**')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('<title>&lt;b&gt;t&lt;/b&gt;</title>')
    expect(html).toContain('<strong>bold</strong>')
  })
  it('keeps only safe links', () => {
    const html = renderMarkdownPage('T', '[a](javascript:alert(1)) [b](https://example.com/x?a=1&b=2) [c](file:///etc/passwd)')
    expect(html).not.toContain('href="javascript:')
    expect(html).not.toContain('href="file:')
    expect(html).toContain('href="https://example.com/x?a=1&amp;b=2"')
  })
})

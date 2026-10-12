// Markdown to a styled, self-contained HTML page for the browser tile. Pure. Every piece of text is escaped, only
// http, https and mailto links survive (safeHref) and raw HTML in the source is shown as text.
import { parseMarkdown, safeHref, type Block, type Inline } from '../shared/markdown'

export const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'))

function inlines(list: Inline[]): string {
  return list
    .map((n): string => {
      switch (n.t) {
        case 'text':
          return escapeHtml(n.v)
        case 'br':
          return '<br>'
        case 'code':
          return `<code>${escapeHtml(n.v)}</code>`
        case 'strong':
          return `<strong>${inlines(n.c)}</strong>`
        case 'em':
          return `<em>${inlines(n.c)}</em>`
        case 'del':
          return `<del>${inlines(n.c)}</del>`
        case 'link': {
          const href = safeHref(n.href)
          return href ? `<a href="${escapeHtml(href)}" rel="noreferrer noopener" target="_blank">${inlines(n.c)}</a>` : inlines(n.c)
        }
      }
    })
    .join('')
}

function blocks(list: Block[]): string {
  return list
    .map((b): string => {
      switch (b.t) {
        case 'heading': {
          const level = Math.min(6, Math.max(1, b.level))
          return `<h${String(level)}>${inlines(b.c)}</h${String(level)}>`
        }
        case 'p':
          return `<p>${inlines(b.c)}</p>`
        case 'code':
          return `<pre><code>${escapeHtml(b.v)}</code></pre>`
        case 'quote':
          return `<blockquote>${blocks(b.c)}</blockquote>`
        case 'list': {
          const tag = b.ordered ? 'ol' : 'ul'
          const start = b.ordered && Number.isInteger(b.start) && b.start !== 1 ? ` start="${String(b.start)}"` : ''
          const items = b.items
            .map((it) => {
              const box = it.task === null ? '' : `<input type="checkbox" disabled${it.task ? ' checked' : ''}> `
              return `<li>${box}${blocks(it.blocks)}</li>`
            })
            .join('')
          return `<${tag}${start}>${items}</${tag}>`
        }
        case 'table': {
          const cell = (tag: string, c: Inline[], i: number): string => {
            const a = b.align[i]
            return `<${tag}${a ? ` style="text-align:${a}"` : ''}>${inlines(c)}</${tag}>`
          }
          const head = `<thead><tr>${b.head.map((c, i) => cell('th', c, i)).join('')}</tr></thead>`
          const rows = b.rows.map((r) => `<tr>${r.map((c, i) => cell('td', c, i)).join('')}</tr>`).join('')
          return `<table>${head}<tbody>${rows}</tbody></table>`
        }
        case 'hr':
          return '<hr>'
      }
    })
    .join('\n')
}

const STYLE = `
:root{color-scheme:light dark;--fg:#1d2127;--bg:#fff;--muted:#5b6470;--line:#d9dde3;--code:#f2f4f7;--link:#1a56c4}
@media (prefers-color-scheme:dark){:root{--fg:#e4e7ec;--bg:#16181c;--muted:#9aa3af;--line:#2d333b;--code:#21252b;--link:#7aa7f5}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:50rem;margin:0 auto;padding:2rem 1.25rem 4rem}
h1,h2,h3,h4,h5,h6{line-height:1.25;margin:1.8em 0 .5em}h1{font-size:2rem;margin-top:0}h2{font-size:1.5rem;border-bottom:1px solid var(--line);padding-bottom:.25em}h3{font-size:1.2rem}
p,ul,ol,blockquote,pre,table{margin:.8em 0}
a{color:var(--link)}
code{background:var(--code);border-radius:4px;padding:.1em .35em;font:.9em ui-monospace,SFMono-Regular,Consolas,monospace}
pre{background:var(--code);border-radius:8px;padding:.9em 1em;overflow:auto}pre code{background:none;padding:0}
blockquote{margin-left:0;padding:.1em 1em;border-left:3px solid var(--line);color:var(--muted)}
table{border-collapse:collapse;display:block;overflow:auto}th,td{border:1px solid var(--line);padding:.4em .7em}th{background:var(--code)}
hr{border:0;border-top:1px solid var(--line);margin:2em 0}
li>p{margin:.2em 0}
`

// The CSP sent with these pages: no scripts, no remote loads; inline style only.
export const MARKDOWN_CSP = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"

export function renderMarkdownPage(title: string, md: string): string {
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${STYLE}</style></head><body><main>\n${blocks(parseMarkdown(md))}\n</main></body></html>`
}

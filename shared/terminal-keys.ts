// Which way a terminal key press goes: to the app (a bound shortcut), a clipboard action, a scroll, or on to the PTY.
export type TermKeyAction = 'app' | 'copy' | 'paste' | 'selectAll' | 'scrollPageUp' | 'scrollPageDown' | 'scrollTop' | 'scrollBottom' | 'terminal'

export interface TermKeyInput {
  mac: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  code: string
  hasSelection: boolean
  // The session is running, so a paste has somewhere to go.
  live: boolean
  // The press matches a rebindable app shortcut.
  bound: boolean
}

// Windows-style clipboard: Ctrl+C copies when there is a selection, Ctrl+V pastes. On macOS it is Cmd+C and Cmd+V,
// and Ctrl+C (interrupt) and Ctrl+V go through to the terminal. Off macOS the terminal-style chords also work:
// Ctrl+Shift+C and Ctrl+Insert copy, Ctrl+Shift+V and Shift+Insert paste, Ctrl+Shift+A selects all. Ctrl+Shift+C is
// always swallowed so it never reaches the PTY. Shift+PageUp/PageDown/Home/End scroll the scrollback.
export function decideTermKey(k: TermKeyInput): TermKeyAction {
  if (k.bound) return 'app'
  if (!k.ctrlKey && !k.metaKey && !k.altKey && k.shiftKey) {
    if (k.code === 'PageUp') return 'scrollPageUp'
    if (k.code === 'PageDown') return 'scrollPageDown'
    if (k.code === 'Home') return 'scrollTop'
    if (k.code === 'End') return 'scrollBottom'
    if (k.code === 'Insert' && !k.mac && k.live) return 'paste'
  }
  if (!k.mac && k.ctrlKey && !k.metaKey && !k.altKey) {
    if (k.shiftKey && k.code === 'KeyC') return 'copy'
    if (k.shiftKey && k.code === 'KeyV' && k.live) return 'paste'
    if (k.shiftKey && k.code === 'KeyA') return 'selectAll'
    if (!k.shiftKey && k.code === 'Insert' && k.hasSelection) return 'copy'
  }
  const clip = k.mac ? k.metaKey && !k.ctrlKey && !k.altKey : k.ctrlKey && !k.altKey
  if (clip && k.code === 'KeyC' && k.hasSelection) return 'copy'
  if (clip && k.code === 'KeyV' && k.live) return 'paste'
  return 'terminal'
}

// What an image on the clipboard types into the PTY so the agent CLI reads it itself.
// Claude Code reads Alt+V on Windows and Linux (Ctrl+V is its raw paste); elsewhere Ctrl+V.
export function imagePasteBytes(mac: boolean, claude: boolean): string {
  return !mac && claude ? '\x1bv' : '\x16'
}

// Absolute file paths (Windows drive or UNC, or Unix), ./ or ../ relative ones, and plain relative ones with a file
// extension (src/a.ts) in terminal output. A trailing :line or :line:col is part of the link text but not the path.
// Whether a path is really a file in the project is checked when it is opened, not here.
const FILE_LINKS: RegExp[] = [
  /(?<![A-Za-z0-9])[A-Za-z]:[\\/](?![\\/])[^\s"'<>|*?]+/g,
  /(?<![\w./~:@-])\/(?:[\w.@+-]+\/)+[\w.@+-]+(?::\d+){0,2}/g,
  /(?<![\w.:/\\])\.{1,2}[\\/][^\s"'<>|*?]+/g,
  /(?<![\w./\\~:@-])(?:[\w@+-][\w.@+-]*[\\/])+[\w.@+-]*\.[A-Za-z][A-Za-z0-9]{0,7}(?::\d+){0,2}/g,
]

export interface FileLink {
  text: string
  // The path alone, without a :line[:col] suffix.
  path: string
  start: number
  end: number
}

export function findFileLinks(line: string): FileLink[] {
  const out: FileLink[] = []
  for (const re of FILE_LINKS) {
    for (const m of line.matchAll(re)) {
      const text = m[0].replace(/[.,;:)\]]+$/, '')
      const path = text.replace(/(?::\d+){1,2}$/, '')
      const start = m.index
      const end = start + text.length
      if (path.length < 3 || /^[a-z][a-z0-9+.-]+:\/\//i.test(path) || out.some((o) => start < o.end && end > o.start)) continue
      out.push({ text, path, start, end })
    }
  }
  return out.sort((a, b) => a.start - b.start)
}

// Dropped file paths typed into a prompt: quoted when they hold a space, joined by spaces.
export function dropText(paths: string[]): string {
  return paths
    .filter(Boolean)
    .map((p) => (/\s/.test(p) ? `"${p}"` : p))
    .join(' ')
}

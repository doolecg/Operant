import type { ChatItem, SubagentItem, SubagentStatus, ToolItem, TurnItem } from './claude-chat'

// Pure logic behind the Chat view's turn folds, command labels and sub-agent rows. No React here so it can be tested.

// "46s", "4m 23s", "1h 2m": whole seconds, for the "Worked for" heading and the agent timers.
export function elapsedText(ms: number): string {
  const s = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

// ---- command labels

const WRAPPERS = new Set(['sudo', 'env', 'time', 'command', 'nohup', 'exec', 'call', '&'])
const SETUP = /^(cd|pushd|popd|set-location|export|set)\s|^\$env:/i
const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/

// The program a shell command runs: "npm" for "cd app && npm test", "git" for "FOO=1 git status | head".
export function commandProgram(command: string): string | null {
  const parts = command
    .split(/&&|\|\||;|\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  const main = parts.find((p) => !SETUP.test(p)) ?? parts[0]
  if (!main) return null
  for (const raw of main.match(/"[^"]*"|'[^']*'|\S+/g) ?? []) {
    const tok = raw.replace(/^["']|["']$/g, '')
    if (!tok || ENV_ASSIGN.test(tok) || WRAPPERS.has(tok.toLowerCase())) continue
    const base = tok.split(/[\\/]/).filter(Boolean).pop() ?? tok
    return base.replace(/\.(exe|cmd|bat|ps1|com)$/i, '') || null
  }
  return null
}

// The program of a Bash or PowerShell call; null for any other tool or when the input has no command yet.
export function shellProgram(t: Pick<ToolItem, 'name' | 'input'>): string | null {
  if (t.name !== 'Bash' && t.name !== 'PowerShell') return null
  const command = t.input && typeof t.input === 'object' ? (t.input as { command?: unknown }).command : null
  return typeof command === 'string' ? commandProgram(command) : null
}

// ---- sub-agent summary

export interface AgentCounts {
  running: number
  waiting: number
  finished: number
  failed: number
  stopped: number
  total: number
}

export function agentCounts(statuses: SubagentStatus[]): AgentCounts {
  const c: AgentCounts = { running: 0, waiting: 0, finished: 0, failed: 0, stopped: 0, total: statuses.length }
  for (const s of statuses) {
    if (s === 'running') c.running++
    else if (s === 'waiting') c.waiting++
    else if (s === 'done') c.finished++
    else if (s === 'failed') c.failed++
    else c.stopped++
  }
  return c
}

// "2 running, 1 finished"; null for fewer than two agents (one agent needs no summary).
export function agentSummaryText(c: AgentCounts): string | null {
  if (c.total < 2) return null
  const parts: string[] = []
  if (c.running) parts.push(`${c.running} running`)
  if (c.waiting) parts.push(`${c.waiting} waiting`)
  if (c.finished) parts.push(`${c.finished} finished`)
  if (c.failed) parts.push(`${c.failed} failed`)
  if (c.stopped) parts.push(`${c.stopped} stopped`)
  return parts.join(', ')
}

export const isAgentOpen = (a: Pick<SubagentItem, 'status'>): boolean => a.status === 'running' || a.status === 'waiting'

// How long an agent ran, or has been running (frozen once it ended); null when its start is unknown.
export function agentTimer(a: Pick<SubagentItem, 'startedAt' | 'endedAt' | 'status'>, now: number): number | null {
  if (!a.startedAt) return null
  const end = a.endedAt ?? (isAgentOpen(a) ? now : null)
  return end === null ? null : Math.max(0, end - a.startedAt)
}

// ---- turns

export type TurnEntry =
  | { type: 'item'; item: ChatItem }
  // A finished turn's thinking and tool rows folded into one row: "Worked for 4m 23s" or "You stopped after 12s".
  | { type: 'fold'; id: string; items: ChatItem[]; stopped: boolean; ms: number; failed: number }
  // The running turn's heading: "Working for 4m 23s", its rows stay open.
  | { type: 'working'; id: string; startedAt: number }
  // Above a turn's agents when there are two or more: "2 running, 1 finished".
  | { type: 'agents'; id: string; text: string }

export interface PlanOptions {
  // The last turn has not finished yet.
  live: boolean
  // Epoch ms the running turn started; read from the turn's own items when absent.
  startedAt?: number | null
}

const startOf = (it: ChatItem): number | null => ('startedAt' in it ? it.startedAt : 'at' in it ? it.at : null)

const isOpenTool = (it: ChatItem): boolean => it.kind === 'tool' && (it.status === 'preparing' || it.status === 'running')

// Thinking and finished tool rows of a closed turn. A tool still running (a background shell) and the sub-agent rows stay out.
const foldable = (it: ChatItem): boolean => it.kind === 'thinking' || (it.kind === 'tool' && !isOpenTool(it))

const wasStopped = (items: ChatItem[]): boolean =>
  items.some((it) => (it.kind === 'notice' && it.source === 'interrupt') || ((it.kind === 'tool' || it.kind === 'subagent') && it.status === 'interrupted'))

// Splits the main thread into turns (each ends at its `turn` item; the last may be still open) and returns the entries to
// draw: a closed turn's thinking and tool rows become one fold, the open turn gets a heading, two or more agents get a
// summary line. The fold or heading sits after the owner's message that starts the turn.
export function planTurns(items: ChatItem[], opts: PlanOptions): TurnEntry[] {
  const out: TurnEntry[] = []
  let seg: ChatItem[] = []
  const flush = (end: TurnItem | null) => {
    if (seg.length) planSegment(seg, end, opts, out)
    seg = []
  }
  for (const it of items) {
    seg.push(it)
    if (it.kind === 'turn') flush(it)
  }
  flush(null)
  return out
}

function planSegment(seg: ChatItem[], end: TurnItem | null, opts: PlanOptions, out: TurnEntry[]): void {
  const head = seg.findIndex((it) => it.kind !== 'user')
  const agentsText = agentSummaryText(agentCounts(seg.filter((it): it is SubagentItem => it.kind === 'subagent').map((a) => a.status)))
  let lead: TurnEntry | null = null
  let skip: (it: ChatItem) => boolean = () => false
  if (end) {
    const folded = seg.filter(foldable)
    if (folded.length) {
      lead = {
        type: 'fold',
        id: `fold:${folded[0]!.id}`,
        items: folded,
        stopped: !end.ok && wasStopped(seg),
        ms: end.durationMs,
        failed: folded.filter((it) => it.kind === 'tool' && it.status === 'failed').length,
      }
      skip = foldable
    }
  } else if (opts.live && seg.some((it) => it.kind === 'thinking' || it.kind === 'tool' || it.kind === 'subagent')) {
    const times = seg.map(startOf).filter((t): t is number => t !== null)
    lead = { type: 'working', id: `working:${seg[head]!.id}`, startedAt: opts.startedAt ?? Math.min(...times) }
  }
  let agentsShown = false
  seg.forEach((it, i) => {
    if (i === head && lead) out.push(lead)
    if (it.kind === 'subagent' && agentsText && !agentsShown) {
      agentsShown = true
      out.push({ type: 'agents', id: `agents:${it.id}`, text: agentsText })
    }
    if (!skip(it)) out.push({ type: 'item', item: it })
  })
}

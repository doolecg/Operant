// Where the Chat view is inside a tile's tree of agents. A path is the agent ids from the outermost down; [] is the
// tile's own conversation. Pure, so the breadcrumbs, the "Subagent of" chip and the Esc step are tested without React.

export interface LineageNode {
  id: string
  // The id of the agent that started this one (null: the main conversation did).
  parent: string | null
}

export type LineagePath = string[]

// The path to one agent, following `parent` upwards. null when the agent is not in the list.
export function agentPath(agents: readonly LineageNode[], id: string): LineagePath | null {
  const byId = new Map(agents.map((a) => [a.id, a]))
  const path: LineagePath = []
  const seen = new Set<string>()
  let cur = byId.get(id)
  if (!cur) return null
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    path.unshift(cur.id)
    cur = cur.parent === null ? undefined : byId.get(cur.parent)
  }
  return path
}

// The longest start of `path` whose agents all still exist (a cleared or restarted session drops them).
export function validPath(agents: readonly LineageNode[], path: LineagePath): LineagePath {
  const ids = new Set(agents.map((a) => a.id))
  const at = path.findIndex((id) => !ids.has(id))
  return at < 0 ? path : path.slice(0, at)
}

export const parentPath = (path: LineagePath): LineagePath => path.slice(0, -1)

// Going deeper (or sideways) animates in, going up animates out.
export const drillDirection = (from: LineagePath, to: LineagePath): 'in' | 'out' => (to.length >= from.length ? 'in' : 'out')

export function truncateLabel(text: string, max = 32): string {
  const s = text.replace(/\s+/g, ' ').trim()
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s
}

export interface Crumb {
  key: string
  label: string
  // The whole title, for the tooltip.
  full: string
  // Where a click goes; null for the current agent.
  to: LineagePath | null
}

// Project / the tile's thread / agent / its agent ...: every crumb but the last is a way back.
export function buildCrumbs(project: string | null | undefined, thread: string, path: LineagePath, titleOf: (id: string) => string, max = 32): Crumb[] {
  const crumbs: Crumb[] = []
  const add = (key: string, full: string, to: LineagePath | null) => crumbs.push({ key, label: truncateLabel(full, max), full, to })
  if (project?.trim()) add('project', project, [])
  add('thread', thread || 'Chat', path.length === 0 ? null : [])
  path.forEach((id, i) => add(id, titleOf(id), i === path.length - 1 ? null : path.slice(0, i + 1)))
  return crumbs
}

// The chip above an agent's task: "Subagent of" and the title of whoever started it.
export function subagentOf(path: LineagePath, thread: string, titleOf: (id: string) => string, max = 48): { lead: string; parent: string; full: string } {
  const full = path.length > 1 ? titleOf(path[path.length - 2]!) : thread || 'Chat'
  return { lead: 'Subagent of', parent: truncateLabel(full, max), full }
}

// A long task is clipped with a "Show full message" link: more than `lines` lines once long lines wrap at about `cols`.
export function needsClip(text: string, lines = 8, cols = 84): boolean {
  let n = 0
  for (const l of text.split(/\r?\n/)) n += Math.max(1, Math.ceil(l.length / cols))
  return n > lines
}

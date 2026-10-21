import { useSyncExternalStore } from 'react'
import { agentPath, drillDirection, type LineageNode, type LineagePath } from '@shared/chat-lineage'

// Which agent of a tile the Agents panel shows (null = the list). The Agent row in the chat and a row in the panel both
// set it, so there is one destination; `nonce` changes on every open so a collapsed panel can expand itself.
export interface AgentSelection {
  agent: string | null
  nonce: number
}

const none: AgentSelection = { agent: null, nonce: 0 }
const sel = new Map<number, AgentSelection>()
const listeners = new Set<() => void>()

export function selectAgent(scratchId: number, agent: string | null): void {
  const cur = sel.get(scratchId) ?? none
  sel.set(scratchId, { agent, nonce: agent ? cur.nonce + 1 : cur.nonce })
  for (const l of listeners) l()
}

export function useAgentSelection(scratchId: number): AgentSelection {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => void listeners.delete(l)),
    () => sel.get(scratchId) ?? none,
  )
}

// Which agent's conversation the main chat column shows: the path of agent ids from the outermost down ([] = the tile's own
// conversation). `dir` is the way the last change went, for the drill-in animation (null before the first change).
export interface AgentThreadSelection {
  path: LineagePath
  dir: 'in' | 'out' | null
}

const noThread: AgentThreadSelection = { path: [], dir: null }
const threads = new Map<number, AgentThreadSelection>()

export function openThread(scratchId: number, path: LineagePath): void {
  const cur = threads.get(scratchId) ?? noThread
  threads.set(scratchId, { path, dir: drillDirection(cur.path, path) })
  for (const l of listeners) l()
}

// Opens one agent (at any depth) in the main column; an id the stream does not know is ignored.
export function openAgentThread(scratchId: number, agents: readonly LineageNode[], id: string): void {
  const path = agentPath(agents, id)
  if (path) openThread(scratchId, path)
}

export function useAgentThread(scratchId: number): AgentThreadSelection {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => void listeners.delete(l)),
    () => threads.get(scratchId) ?? noThread,
  )
}

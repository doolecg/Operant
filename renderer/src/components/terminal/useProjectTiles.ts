import { useMemo } from 'react'
import type { TerminalTab } from './useTerminals'

// A tile is an agent terminal (Claude Code or OpenCode). Shells live in the bottom drawer and the browser in its side panel.
export interface TileInfo {
  id: string
  title: string
  scratch: TerminalTab
}

export type ScratchTileInfo = TileInfo

export const scratchTileId = (id: number) => `scratch:${id}`

export const isScratchTile = (_t: TileInfo): _t is ScratchTileInfo => true

// The tiles this project wants open: its agent terminals.
export function useProjectTiles(crewId: number, scratch: TerminalTab[]): TileInfo[] {
  return useMemo(
    () => scratch.filter((t) => t.crewId === crewId && t.kind !== 'shell').map((t) => ({ id: scratchTileId(t.scratchId), title: t.title + (t.exited ? ' (exited)' : ''), scratch: t })),
    [scratch, crewId],
  )
}

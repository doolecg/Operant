import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { setActiveClaudeTile } from './activeClaudeTile'
import { ModsHost } from '@/components/mods/ModsHost'
import { Sparkles, SquareTerminal } from 'lucide-react'
import type { MainCli } from '@shared/settings'
import { decodeIpcError } from '@shared/ipc'
import type { ScratchView } from '@shared/types'
import { isTileOut } from '@shared/tile-popout'
import { Button } from '@/components/ui/button'
import { BrowserTile } from '@/components/browser/BrowserTile'
import { PoppedOutNotice } from '@/components/browser/BrowserPopout'
import { useBrowserActions, useBrowserState } from '@/components/browser/useBrowser'
import { OperatorTerminal } from '@/components/dashboard/OperatorTerminal'
import { ChatView } from '@/components/chat/ChatView'
import { ChatHeaderControls, ChatStateBadge, ViewSwitch } from '@/components/chat/ChatHeader'
import { CLI_SHORT, cliBlocked } from '@/lib/capabilities'
import { call, useCapabilities, useCrews, useSettings } from '@/lib/queries'
import { toast } from '@/lib/toast'
import { NOTES_DEFAULT, NOTES_MAX, NOTES_MIN, NOTES_RAIL, NotesPanel, NotesRail } from '@/components/notes/NotesPanel'
import { TileIcon } from './TileFrame'
import { TileInfoBar, TileStatus } from './TileInfoBar'
import { TileSurface } from './TileSurface'
import { useTilePopouts } from './useTilePopouts'
import { isScratchTile, useProjectTiles, type ScratchTileInfo, type TileInfo } from './useProjectTiles'
import type { TerminalTab } from './useTerminals'

const TILES_MIN_WIDTH = 480

const HEADING:Record<string, string> = { claude: 'Claude Code', opencode: 'OpenCode', shell: 'Shell' }

interface Props {
  crewId: number
  // The project's shell and agent terminals (from the drawer's list); they open as tiles here.
  scratch: TerminalTab[]
  // The scratch terminal opened last (the drawer's active one); its tile takes the focus when it is in this project.
  active: number | null
  onCloseScratch: (scratchId: number) => void
  onStart: (kind: 'shell' | MainCli) => void
}

// The project's Terminal view: the tiles (the shell and agent terminals) and the Mods sub-agent panel.
export function TerminalView({ crewId, scratch, active, onCloseScratch, onStart }: Props) {
  const settings = useSettings().data
  const cli = settings?.mainCli ?? 'claude'
  const strip = settings?.tiles.strip ?? 'normal'
  const blocked = cliBlocked(useCapabilities().data, cli)
  const tiles = useProjectTiles(crewId, scratch)
  const scratchTiles = tiles.filter(isScratchTile)
  const browser = useBrowserActions(crewId)
  const out = useTilePopouts()
  const browserOut = useBrowserState(crewId).data?.poppedOut === true
  const activeTile = scratchTiles.find((t) => t.scratch.scratchId === active)?.id ?? null
  const crew = useCrews().data?.find((c) => c.id === crewId)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  // The Claude tile the Subagent Panel follows: the focused one, else the first Claude tile.
  const claudeTile = scratchTiles.find((t) => t.id === focusedId && t.scratch.kind === 'claude') ?? scratchTiles.find((t) => t.scratch.kind === 'claude')
  const claudeScratchId = claudeTile?.scratch.scratchId ?? null
  // The Learning settings learn from this session when asked to run now.
  useEffect(() => setActiveClaudeTile(claudeScratchId), [claudeScratchId])
  // The focused tile is the one on screen: its finished turn does not raise a Windows notification.
  const focusedScratchId = scratchTiles.find((t) => t.id === focusedId)?.scratch.scratchId ?? null
  useEffect(() => {
    void call('notify:visible', focusedScratchId).catch(() => undefined)
  }, [focusedScratchId])
  useEffect(
    () => () => {
      void call('notify:visible', null).catch(() => undefined)
    },
    [],
  )

  const close = (t: TileInfo) => (t.scratch ? onCloseScratch(t.scratch.scratchId) : void browser.close.mutate())

  // Each Claude tile is in the Chat or the Terminal view (a property of the scratch terminal).
  const qc = useQueryClient()
  const claudeIds = scratchTiles
    .filter((t) => t.scratch.kind === 'claude')
    .map((t) => t.scratch.scratchId)
    .join(',')
  const views = useQuery({
    queryKey: ['scratchViews', crewId, claudeIds],
    queryFn: async () => Object.fromEntries((await call('scratch:list', crewId)).map((s) => [s.id, { view: s.view, effort: s.effort, model: s.model, presetId: s.presetId }])),
    enabled: claudeIds !== '',
  }).data
  const viewOf = (t: ScratchTileInfo): ScratchView | undefined => (t.scratch.kind === 'claude' ? views?.[t.scratch.scratchId]?.view : 'terminal')
  const switchView = (t: ScratchTileInfo, view: ScratchView) =>
    call('scratch:setView', t.scratch.scratchId, view)
      .then(() => qc.invalidateQueries({ queryKey: ['scratchViews'] }))
      .catch((e) => toast(decodeIpcError(e).message, true))
  const effortOf = (t: ScratchTileInfo) => {
    const e = views?.[t.scratch.scratchId]?.effort
    return e && e !== 'default' ? e : null
  }

  const body = (tile: TileInfo) => {
    if (!isScratchTile(tile)) return <BrowserTile crewId={crewId} />
    const t = tile
    // The session lives in its own window: no terminal here, so two of them do not fight over the PTY size.
    if (isTileOut(out, t.scratch.scratchId)) return <PoppedOutNotice title={t.title} onPopIn={() => void call('tile:popIn', t.scratch.scratchId).catch(() => undefined)} />
    const view = viewOf(t)
    if (view === undefined) return null
    if (t.scratch.kind === 'claude' && view === 'chat')
      return (
        <div className="relative h-full min-h-0">
          <ChatView scratchId={t.scratch.scratchId} launchEffort={effortOf(t)} tileModel={views?.[t.scratch.scratchId]?.model ?? ''} onTerminal={() => void switchView(t, 'terminal')} projectName={crew?.name} threadTitle={t.title} crewId={crewId} engineering={crew?.engineering ?? false} factory={crew?.factory ?? false} workers={Object.entries(views ?? {}).map(([id, v]) => ({ id: Number(id), presetId: v.presetId }))} />
        </div>
      )
    return (
      <div className="relative h-full min-h-0">
        <OperatorTerminal sessionKey={`scratch:${t.scratch.scratchId}`} autoFocus={false} crewId={crewId} cli={t.scratch.kind} />
      </div>
    )
  }

  // The Notes panel: when the area is too narrow for the tiles to keep 480px it shrinks to a rail (and floats open on demand).
  const root = useRef<HTMLDivElement>(null)
  const [areaWidth, setAreaWidth] = useState(0)
  const [notesFloating, setNotesFloating] = useState(false)
  useEffect(() => {
    const el = root.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => entry && setAreaWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const notesOpen = settings?.layout.notesOpen ?? false
  const notesWidth = Math.min(NOTES_MAX, Math.max(NOTES_MIN, settings?.layout.notesWidth || NOTES_DEFAULT))
  const notesNarrow = areaWidth > 0 && areaWidth - notesWidth - 12 < TILES_MIN_WIDTH
  useEffect(() => setNotesFloating(false), [crewId, notesOpen])

  return (
    <div ref={root} className="relative flex h-full min-h-0">
      {notesOpen &&
        (notesNarrow ? (
          notesFloating ? (
            <>
              <div aria-hidden style={{ width: NOTES_RAIL + 6 }} className="shrink-0" />
              <NotesPanel crewId={crewId} onCollapse={() => setNotesFloating(false)} />
            </>
          ) : (
            <NotesRail onExpand={() => setNotesFloating(true)} />
          )
        ) : (
          <NotesPanel crewId={crewId} />
        ))}
      <section aria-label="Terminal tiles" className="flex min-w-0 flex-1 flex-col p-1.5">
        {tiles.length === 0 ? (
          <div className="grid flex-1 place-content-center gap-3 p-4 text-center">
            <p className="text-muted-foreground text-sm">No terminals open. Start one here, or add one from the terminal drawer.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={() => onStart(cli)} disabled={!!blocked} title={blocked}>
                <Sparkles /> Start {CLI_SHORT[cli]}
              </Button>
              <Button size="sm" variant="outline" onClick={() => onStart('shell')}>
                <SquareTerminal /> New shell
              </Button>
            </div>
          </div>
        ) : (
          <TileSurface
            crewId={crewId}
            tiles={tiles}
            onClose={close}
            popOut={(tile) => {
              if (!isScratchTile(tile)) return browserOut ? null : () => void browser.popOut.mutate()
              const t = tile
              if (isTileOut(out, t.scratch.scratchId)) return null
              return () =>
                void call('tile:popOut', { scratchId: t.scratch.scratchId, crewId, kind: t.scratch.kind, title: t.title }).catch((e) => toast(decodeIpcError(e).message, true))
            }}
            body={body}
            chrome={(tile) => {
              if (!isScratchTile(tile)) return { icon: <TileIcon kind="browser" compact={strip === 'compact'} />, heading: 'Browser', subtitle: crew?.name }
              const t = tile
              if (t.scratch.kind === 'claude' && viewOf(t) === 'chat')
                return {
                  icon: (
                    <span aria-hidden className="text-primary grid size-6 shrink-0 place-items-center text-[13px]">
                      ◆
                    </span>
                  ),
                  heading: HEADING.claude,
                  badge: <ChatStateBadge scratchId={t.scratch.scratchId} />,
                  status: <ChatHeaderControls scratchId={t.scratch.scratchId} onView={(v) => void switchView(t, v)} />,
                }
              return {
                icon: <TileIcon kind={t.scratch.kind} compact={strip === 'compact'} />,
                heading: HEADING[t.scratch.kind],
                subtitle: crew?.name,
                status:
                  t.scratch.kind === 'claude' && viewOf(t) === 'terminal' ? (
                    <>
                      <TileStatus tile={t.scratch} />
                      <ViewSwitch view="terminal" blockedReason={null} onChange={(v) => void switchView(t, v)} />
                    </>
                  ) : (
                    <TileStatus tile={t.scratch} />
                  ),
              }
            }}
            info={(t) => (!isScratchTile(t) || t.scratch.kind === 'shell' || (t.scratch.kind === 'claude' && viewOf(t) !== 'terminal') ? null : <TileInfoBar tile={t.scratch} crew={crew} />)}
            onFocusChange={setFocusedId}
            focusId={activeTile}
          />
        )}
      </section>

      {claudeTile && (
        <ModsHost key={claudeTile.scratch.scratchId} tileId={claudeTile.scratch.scratchId} crewId={crew?.id ?? null} chat={views?.[claudeTile.scratch.scratchId]?.view === 'chat'} />
      )}
    </div>
  )
}

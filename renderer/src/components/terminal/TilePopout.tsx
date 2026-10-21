import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PictureInPicture2 } from 'lucide-react'
import { decodeIpcError } from '@shared/ipc'
import type { ScratchView } from '@shared/types'
import type { TilePopoutRequest } from '@shared/tile-popout'
import { Button } from '@/components/ui/button'
import { ChatView } from '@/components/chat/ChatView'
import { ChatHeaderControls, ChatStateBadge, ViewSwitch } from '@/components/chat/ChatHeader'
import { OperatorTerminal } from '@/components/dashboard/OperatorTerminal'
import { call, useLiveUpdates } from '@/lib/queries'
import { toast } from '@/lib/toast'
import { TileIcon } from './TileFrame'

// The whole content of a terminal pop-out window (main.tsx renders it when the URL has ?tilePopout=<scratchId>): a thin
// bar with the title and the way back, then the same body the tile has in the Terminal view, attached to the same session.
export function TilePopoutPage({ req }: { req: TilePopoutRequest }) {
  useLiveUpdates()
  const qc = useQueryClient()
  const { scratchId, crewId, kind } = req
  const popIn = () => void call('tile:popIn', scratchId).catch(() => undefined)

  // A Claude tile is in the Chat or the Terminal view; this window follows the same property.
  const key = ['tilePopoutView', scratchId] as const
  const row = useQuery({
    queryKey: key,
    queryFn: async () => (await call('scratch:list', crewId)).find((s) => s.id === scratchId) ?? null,
    enabled: kind === 'claude',
  }).data
  const view: ScratchView | undefined = kind === 'claude' ? row?.view : 'terminal'
  const switchView = (v: ScratchView) =>
    call('scratch:setView', scratchId, v)
      .then(() => qc.invalidateQueries({ queryKey: key }))
      .catch((e) => toast(decodeIpcError(e).message, true))
  const chat = kind === 'claude' && view === 'chat'
  const effort = row?.effort && row.effort !== 'default' ? row.effort : null

  return (
    <div className="bg-background text-foreground flex h-screen flex-col p-2">
      <div className="flex shrink-0 items-center gap-2 pb-1 text-xs">
        {chat ? (
          <span aria-hidden className="text-primary grid size-6 shrink-0 place-items-center text-[13px]">
            ◆
          </span>
        ) : (
          <TileIcon kind={kind} />
        )}
        <h1 title={req.title} className="min-w-0 truncate text-[13px] font-semibold">
          {req.title}
        </h1>
        {chat && <ChatStateBadge scratchId={scratchId} />}
        <div className="ml-auto flex items-center gap-2">
          {chat && <ChatHeaderControls scratchId={scratchId} onView={(v) => void switchView(v)} />}
          {kind === 'claude' && view === 'terminal' && <ViewSwitch view="terminal" blockedReason={null} onChange={(v) => void switchView(v)} />}
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs" aria-label={`Pop ${req.title} back in`} onClick={popIn}>
            <PictureInPicture2 aria-hidden className="size-3.5" />
            Pop back in
          </Button>
        </div>
      </div>
      <div className="surface-edge bg-card min-h-0 flex-1 overflow-hidden rounded-[18px]">
        {view === undefined ? null : chat ? (
          <div className="relative h-full min-h-0">
            <ChatView scratchId={scratchId} launchEffort={effort} tileModel={row?.model ?? ''} onTerminal={() => void switchView('terminal')} threadTitle={req.title} />
          </div>
        ) : (
          <div className="relative h-full min-h-0">
            <OperatorTerminal sessionKey={`scratch:${scratchId}`} crewId={crewId} cli={kind} />
          </div>
        )}
      </div>
    </div>
  )
}

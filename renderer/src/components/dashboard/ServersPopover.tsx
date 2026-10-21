import { useState } from 'react'
import { Copy, Globe, RefreshCw, Server } from 'lucide-react'
import { decodeIpcError } from '@shared/ipc'
import type { RunningServer } from '@shared/servers'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { call, useServers } from '@/lib/queries'
import { toast } from '@/lib/toast'

// The dev servers the tiles started: a footer button with a count, and a list grouped by project.
export function ServersPopover({ onOpened }: { onOpened: (crewId: number) => void }) {
  const [open, setOpen] = useState(false)
  const servers = useServers()
  const list = servers.data?.servers ?? []
  const failed = (e: unknown) => toast(decodeIpcError(e).message, true)

  const byProject = new Map<number, { name: string; rows: RunningServer[] }>()
  for (const s of list) {
    const group = byProject.get(s.crewId)
    if (group) group.rows.push(s)
    else byProject.set(s.crewId, { name: s.crewName, rows: [s] })
  }

  const openIn = (s: RunningServer) => {
    call('browser:open', s.crewId, s.url)
      .then(() => {
        onOpened(s.crewId)
        setOpen(false)
      })
      .catch(failed)
  }
  const copy = (s: RunningServer) => {
    navigator.clipboard.writeText(s.url).then(() => toast(`Copied ${s.url}`), failed)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) void servers.refetch()
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="relative" aria-label="Running servers">
              <Server />
              {list.length > 0 && (
                <span className="bg-primary text-primary-foreground absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[10px] leading-4">
                  {list.length > 99 ? '99+' : list.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Servers running from your tiles</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" className="w-96" aria-label="Running servers">
        <div className="surface-line flex items-center gap-1 border-b px-3 py-2">
          <span className="mr-auto text-sm font-medium">Servers</span>
          <Button variant="ghost" size="icon-sm" aria-label="Refresh servers" title="Refresh" disabled={servers.isFetching} onClick={() => void servers.refetch()}>
            <RefreshCw className={servers.isFetching ? 'animate-spin' : undefined} />
          </Button>
        </div>
        <ScrollArea className="max-h-80">
          <div className="space-y-3 p-3">
            {servers.isError && <p className="text-destructive text-xs">{decodeIpcError(servers.error).message}</p>}
            {servers.data?.error && <p className="text-destructive text-xs">{servers.data.error}</p>}
            {!servers.isError && !servers.data?.error && list.length === 0 && (
              <p className="text-muted-foreground text-xs">{servers.isPending ? 'Looking for servers.' : 'No servers running from your tiles.'}</p>
            )}
            {[...byProject.entries()].map(([crewId, g]) => (
              <section key={crewId} aria-label={g.name} className="space-y-1.5">
                <h3 className="text-muted-foreground text-[10.5px] font-semibold tracking-[.09em] uppercase">{g.name}</h3>
                {g.rows.map((s) => (
                  <div key={s.key} className="surface space-y-1.5 rounded-lg p-2">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate font-mono text-xs">{s.url}</span>
                      <span className="text-muted-foreground ml-auto shrink-0 text-xs">port {s.port}</span>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {s.process} in {s.tileTitle}
                      {s.allInterfaces ? '. Reachable from the network.' : ''}
                    </p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="secondary" className="h-7 gap-1" onClick={() => openIn(s)} aria-label={`Open ${s.url} in browser`}>
                        <Globe className="size-3.5" /> Open in browser
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => copy(s)} aria-label={`Copy address ${s.url}`}>
                        <Copy className="size-3.5" /> Copy address
                      </Button>
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

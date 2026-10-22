import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { tileState } from '@shared/claude-chat'
import { activitySummary, boardCounts, buildCards, filterCards, liveSummary, planUsage, type BoardFilter, type BoardLive } from '@shared/board'
import type { Crew, ScratchTerminal } from '@shared/types'
import { useChatState } from '@/components/chat/useChat'
import { rightNowHeadline } from '@/components/mods/agents/rightNow'
import type { TerminalTab } from '@/components/terminal/useTerminals'
import { PixelBar, meterTone } from '@/components/ui/pixel-bar'
import { bridge } from '@/lib/bridge'
import { call, threadsKey, useProviders, useUsageReport } from '@/lib/queries'
import { useMoney } from '@/lib/useMoney'
import { cn } from '@/lib/utils'
import { BoardCard } from './BoardCard'
import { BoardDock } from './BoardDock'

const startOfToday = () => new Date().setHours(0, 0, 0, 0)

// Reads the live chat of one open Claude tile and reports its status; renders nothing.
function Probe({ id, report }: { id: number; report: (id: number, live: BoardLive | null) => void }) {
  const state = useChatState(id)
  const live = useMemo(() => (state ? liveSummary(state, tileState(state) === 'Working' ? rightNowHeadline(state.items, state.turn).headline : '') : null), [state])
  useEffect(() => report(id, live), [id, live, report])
  useEffect(() => () => report(id, null), [id, report])
  return null
}

function Meter({ usedPct, label }: { usedPct: number; label: string }) {
  const used = Math.round(usedPct)
  const left = Math.min(100, Math.max(0, 100 - used))
  const tone = meterTone(used)
  return (
    <span className="flex items-center gap-2.5">
      <PixelBar width={48} fraction={left / 100} tone={tone === 'success' ? 'primary' : tone} />
      <span>
        <b className="text-foreground font-semibold">{left}%</b> {label}
      </span>
    </span>
  )
}

const FILTERS: Array<{ id: BoardFilter; label: string; dot?: string }> = [
  { id: 'all', label: 'All' },
  { id: 'working', label: 'Working', dot: 'bg-primary' },
  { id: 'needs', label: 'Needs you', dot: 'bg-warning' },
]

// Threads of all projects as cards: what each one is doing, what needs the owner, and one row to message the selected one.
export function BoardView({ crews, tabs, onOpenThread }: { crews: Crew[]; tabs: TerminalTab[]; onOpenThread: (row: ScratchTerminal) => void }) {
  const qc = useQueryClient()
  const lists = useQueries({ queries: crews.map((c) => ({ queryKey: threadsKey(c.id), queryFn: () => call('scratch:list', c.id) })) })
  const [live, setLive] = useState<ReadonlyMap<number, BoardLive>>(new Map())
  const [filter, setFilter] = useState<BoardFilter>('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const providers = useProviders().data?.providers
  const today = useUsageReport({ filter: { from: startOfToday() } }).data?.totals.costUsd
  const { money } = useMoney()
  const plan = useMemo(() => planUsage(providers ?? []), [providers])

  useEffect(() => bridge().on('usage:changed', () => void qc.invalidateQueries({ queryKey: ['usage-report'] })), [qc])

  const report = useCallback((id: number, v: BoardLive | null) => {
    setLive((prev) => {
      const cur = prev.get(id)
      if (cur?.status === v?.status && cur?.line === v?.line && cur?.model === v?.model) return prev
      const next = new Map(prev)
      if (v) next.set(id, v)
      else next.delete(id)
      return next
    })
  }, [])

  const openIds = new Set(tabs.map((t) => t.scratchId))
  const cards = buildCards(
    crews.map((crew, i) => ({ crew, rows: lists[i]?.data ?? [] })),
    openIds,
    live,
  )
  const counts = boardCounts(cards)
  const shown = filterCards(cards, filter)
  const selected = cards.find((c) => c.row.id === selectedId) ?? null
  const activity = activitySummary(counts)

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col px-14 pt-11" aria-label="Board">
      {cards.filter((c) => c.open && c.row.agent === 'claude').map((c) => <Probe key={c.row.id} id={c.row.id} report={report} />)}

      <div className="text-muted-foreground flex h-7 shrink-0 items-center gap-8 text-[13px]">
        {plan.fiveHour !== null && <Meter usedPct={plan.fiveHour} label="session left" />}
        {plan.sevenDay !== null && <Meter usedPct={plan.sevenDay} label="weekly left" />}
        {today !== undefined && (
          <span>
            <b className="text-foreground font-semibold">{money(today)}</b> today
          </span>
        )}
        {activity && (
          <span className="ml-auto flex items-center gap-2">
            <i aria-hidden className="bg-warning size-[7px] rounded-full" />
            {activity}
          </span>
        )}
      </div>

      <div role="toolbar" aria-label="Filter threads" className="mt-7 flex h-8 shrink-0 items-center gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn('focus-visible:ring-primary/60 flex h-8 items-center gap-2 rounded-full px-4 text-[13px] outline-none focus-visible:ring-2', filter === f.id ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {f.dot && <i aria-hidden className={cn('size-[7px] rounded-full', f.dot)} />}
            {f.label} {counts[f.id]}
          </button>
        ))}
        <span className="text-muted-foreground ml-auto text-[12.5px]">Needs you first, then newest</span>
      </div>

      <div className="mt-7 min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <p className="text-muted-foreground text-[13px]">{cards.length === 0 ? 'No threads yet.' : 'No threads match this filter.'}</p>
        ) : (
          <div role="listbox" aria-label="Threads" className="grid grid-cols-3 items-start gap-8 pb-4">
            {shown.map((c) => (
              <BoardCard key={c.row.id} card={c} selected={c.row.id === selectedId} onSelect={() => setSelectedId(c.row.id === selectedId ? null : c.row.id)} onOpen={() => onOpenThread(c.row)} />
            ))}
          </div>
        )}
      </div>

      <BoardDock selected={selected} />
    </section>
  )
}

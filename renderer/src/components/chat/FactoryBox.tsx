import { ChevronDown, Play } from 'lucide-react'
import { FACTORY_ROLES } from '@shared/engineering'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PixelBar } from '@/components/ui/pixel-bar'
import { usePresets } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { chipClass } from './StageBox'
import { useAnyChatWorking, useWorkingCount } from './useChat'

// App.tsx opens a Claude tile for the project from this preset when it hears the event.
export const START_ROLE_EVENT = 'operant:start-role'
export interface StartRoleDetail {
  crewId: number
  presetId: number
  label: string
  // The preset's own model and effort: the tile takes these, not the remembered defaults.
  model: string
  effort: string
}

// A Claude tile and the preset it runs (null: none).
export interface FactoryWorker {
  id: number
  presetId: number | null
}

// "claude-opus-5-5" as "Opus 5.5".
const modelLabel = (id: string) => {
  const m = /^claude-([a-z]+)-(\d+)-(\d+)/.exec(id)
  return m ? `${m[1]![0]!.toUpperCase()}${m[1]!.slice(1)} ${m[2]}.${m[3]}` : id
}

function useRoles(crewId: number | null, on: boolean) {
  const presets = usePresets().data
  if (!on || crewId === null || !presets) return []
  return FACTORY_ROLES.flatMap((r) => {
    const preset = presets.find((p) => p.builtin === r.preset)
    if (!preset) return []
    const start = () => window.dispatchEvent(new CustomEvent<StartRoleDetail>(START_ROLE_EVENT, { detail: { crewId, presetId: preset.id, label: r.label, model: preset.model, effort: preset.effort } }))
    return [{ ...r, presetId: preset.id, model: modelLabel(preset.model), start }]
  })
}

const startClass = 'm-press text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs'

// One Factory level on a single line, like the plan-usage figures in the Bottom Bar: its name, a pixel bar that sweeps while a
// tile started from its preset works, and the Start button. The model and the job are in the tooltip.
function RoleCard({ role, ids }: { role: ReturnType<typeof useRoles>[number]; ids: number[] }) {
  const busy = useAnyChatWorking(ids)
  return (
    <div className={'bg-accent/40 flex h-8 items-center gap-2 rounded-lg pr-1 pl-2.5'} title={`${role.job} (${role.model})`}>
      <span className={cn('truncate', busy ? 'text-foreground' : 'text-muted-foreground')}>{role.label}</span>
      <span className="min-w-0 flex-1">
        <PixelBar sweep={busy} tone="primary" label={busy ? `${role.label} is working` : `${role.label} is idle`} />
      </span>
      <button type="button" onClick={role.start} title={`Start a ${role.label}: a new chat with just its preset`} aria-label={`Start a ${role.label}`} className={cn(startClass, 'bg-accent/60 size-6 justify-center px-0')}>
        <Play className="size-3" aria-hidden />
      </button>
    </div>
  )
}

const idsOf = (workers: FactoryWorker[], presetId: number) => workers.filter((w) => w.presetId === presetId).map((w) => w.id)

// The Factory as a chip at the top of the chat ("Factory 2 working" with a pixel bar); it opens the levels, a line each with a Start button that
// opens a chat with just that level's preset (model, instructions, skills), without the project's Factory leader instructions.
export function FactoryChip({ crewId, on, workers = [] }: { crewId: number | null; on: boolean; workers?: FactoryWorker[] }) {
  const roles = useRoles(crewId, on)
  const working = useWorkingCount(workers.map((w) => w.id))
  if (roles.length === 0) return null
  return (
    <Popover>
      <PopoverTrigger data-chat="factory-chip" aria-label={working > 0 ? `Factory: ${working} working` : 'Factory levels'} className={chipClass}>
        {working > 0 ? `Factory ${working} working` : 'Factory'}
        <span className="w-[72px]">
          <PixelBar sweep={working > 0} tone="primary" label={working > 0 ? 'Factory is working' : 'Factory is idle'} />
        </span>
        <ChevronDown className="size-3.5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-[300px] flex-col gap-1.5 p-3 text-xs" data-chat="factory-popover">
        <p className="px-1 py-0.5 text-[13px] font-medium">Factory levels</p>
        {roles.map((r) => (
          <RoleCard key={r.key} role={r} ids={idsOf(workers, r.presetId)} />
        ))}
      </PopoverContent>
    </Popover>
  )
}

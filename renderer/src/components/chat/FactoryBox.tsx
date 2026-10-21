import { Play } from 'lucide-react'
import { FACTORY_ROLES } from '@shared/engineering'
import { PixelBar } from '@/components/ui/pixel-bar'
import { usePresets } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { useAnyChatWorking } from './useChat'

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
function RoleCard({ role, ids, compact }: { role: ReturnType<typeof useRoles>[number]; ids: number[]; compact?: boolean }) {
  const busy = useAnyChatWorking(ids)
  return (
    <div className={cn('bg-accent/40 flex h-8 items-center gap-2 rounded-lg pr-1 pl-2.5', compact && 'min-w-[150px] flex-1')} title={`${role.job} (${role.model})`}>
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

// The Factory levels in a row at the top of a narrow chat: a small card per level.
export function FactoryBar({ crewId, on, workers = [] }: { crewId: number | null; on: boolean; workers?: FactoryWorker[] }) {
  const roles = useRoles(crewId, on)
  if (roles.length === 0) return null
  return (
    <div role="group" aria-label="Factory levels" data-chat="factory-bar" className="surface mx-auto mt-2 flex w-[calc(100%-2.5rem)] max-w-[680px] shrink-0 flex-wrap gap-1.5 rounded-xl p-1.5 text-xs @[900px]:hidden">
      {roles.map((r) => (
        <RoleCard key={r.key} role={r} ids={idsOf(workers, r.presetId)} compact />
      ))}
    </div>
  )
}

// The same levels as a column on the left of a wide chat: a card per level, and a small Start button that opens a chat with just
// that level's preset (model, instructions, skills), without the project's Factory leader instructions.
export function FactoryRail({ crewId, on, workers = [] }: { crewId: number | null; on: boolean; workers?: FactoryWorker[] }) {
  const roles = useRoles(crewId, on)
  if (roles.length === 0) return null
  return (
    <div role="group" aria-label="Factory levels" data-chat="factory-rail" className="surface hidden w-[200px] shrink-0 flex-col gap-1.5 rounded-xl p-2 text-xs @[900px]:flex">
      <p className="text-muted-foreground px-1 py-0.5 text-xs">Factory</p>
      {roles.map((r) => (
        <RoleCard key={r.key} role={r} ids={idsOf(workers, r.presetId)} />
      ))}
    </div>
  )
}

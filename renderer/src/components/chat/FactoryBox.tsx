import { Play } from 'lucide-react'
import { FACTORY_ROLES } from '@shared/engineering'
import { usePresets } from '@/lib/queries'
import { cn } from '@/lib/utils'

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
    return [{ ...r, model: modelLabel(preset.model), start }]
  })
}

const startClass = 'm-press text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs'

// The Factory levels in one row at the top of a narrow chat, each with a Start button.
export function FactoryBar({ crewId, on }: { crewId: number | null; on: boolean }) {
  const roles = useRoles(crewId, on)
  if (roles.length === 0) return null
  return (
    <div role="group" aria-label="Factory levels" data-chat="factory-bar" className="surface mx-auto mt-2 flex w-[calc(100%-2.5rem)] max-w-[680px] shrink-0 flex-wrap items-center gap-x-1 gap-y-1 rounded-xl px-3 py-1.5 text-xs @[900px]:hidden">
      <span className="text-muted-foreground mr-1">Factory</span>
      {roles.map((r) => (
        <button key={r.key} type="button" onClick={r.start} title={`${r.job}. Starts a new chat with the ${r.label} preset only (${r.model}).`} aria-label={`Start a ${r.label}`} className={startClass}>
          <Play className="size-3" aria-hidden /> {r.label}
        </button>
      ))}
    </div>
  )
}

// The same levels as a column on the left of a wide chat: name and model, and a small Start button that opens a chat with just that
// level's preset (model, instructions, skills), without the project's Factory leader instructions.
export function FactoryRail({ crewId, on }: { crewId: number | null; on: boolean }) {
  const roles = useRoles(crewId, on)
  if (roles.length === 0) return null
  return (
    <div role="group" aria-label="Factory levels" data-chat="factory-rail" className="surface hidden w-[200px] shrink-0 flex-col gap-0.5 rounded-xl p-2 text-[13px] @[900px]:flex">
      <p className="text-muted-foreground px-2 py-1 text-xs">Factory</p>
      {roles.map((r) => (
        <div key={r.key} className="flex min-h-8 items-center gap-2 rounded-lg px-2">
          <span className="min-w-0 flex-1" title={r.job}>
            <span className="text-foreground block truncate">{r.label}</span>
            <span className="text-muted-foreground block truncate text-[11px] leading-tight">{r.model}</span>
          </span>
          <button type="button" onClick={r.start} title={`Start a ${r.label}: a new chat with just its preset`} aria-label={`Start a ${r.label}`} className={cn(startClass, 'bg-accent/60')}>
            <Play className="size-3" aria-hidden /> Start
          </button>
        </div>
      ))}
    </div>
  )
}

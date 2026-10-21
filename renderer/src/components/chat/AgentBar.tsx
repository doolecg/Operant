import { CornerUpLeft } from 'lucide-react'
import type { SubagentItem } from '@shared/claude-chat'
import { shortModel } from '@/components/mods/agents/agentView'
import { agentElapsed, agentRowFor, formatDuration } from './chatHelpers'
import { useNow } from './useChat'

// Where the prompt box would be: an agent runs on its own, so this only says how it is doing and leads back up.
export function AgentBar({ agent, parentTitle, onOpenParent }: { agent: SubagentItem; parentTitle: string; onOpenParent: () => void }) {
  const row = agentRowFor(agent)
  const running = row.dot === 'running' || row.dot === 'waiting'
  const now = useNow(running)
  const ms = agentElapsed(row, now)
  const model = shortModel(agent.model)
  const status =
    row.dot === 'running' ? `Working${ms !== null ? ` ${formatDuration(ms)}` : ''}` : row.dot === 'waiting' ? 'Waiting for you' : row.dot === 'done' ? `Done${ms !== null ? ` in ${formatDuration(ms)}` : ''}` : row.dot === 'failed' ? 'Failed' : 'Stopped'
  return (
    <div className="mx-auto w-full max-w-[720px] shrink-0 px-5 pb-3">
      <div role="group" aria-label="Agent status" className="surface flex items-center gap-3 px-4 py-2.5 text-[13px]">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {model && <span className="shrink-0 font-medium">{model}</span>}
          {agent.effort && <span className="text-muted-foreground shrink-0 capitalize">{agent.effort}</span>}
          <span role="status" className="text-muted-foreground min-w-0 truncate tabular-nums">
            {status}
          </span>
        </div>
        <span className="text-muted-foreground shrink-0">Runs on its own</span>
        <button type="button" title={`Open ${parentTitle}`} onClick={onOpenParent} className="hover:bg-accent m-press inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-medium">
          <CornerUpLeft className="size-3.5" aria-hidden />
          Open parent
        </button>
      </div>
    </div>
  )
}

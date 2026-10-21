import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Bot } from 'lucide-react'
import { itemsOf, type ChatState, type SubagentItem } from '@shared/claude-chat'
import { buildCrumbs, needsClip, parentPath, subagentOf, type LineagePath } from '@shared/chat-lineage'
import { cn } from '@/lib/utils'
import { useAgentItems } from '@/components/mods/agents/useAgentItems'
import { AgentBar } from './AgentBar'
import { Breadcrumbs } from './Breadcrumbs'
import { ConversationList } from './ConversationList'
import { agentRowFor } from './chatHelpers'
import { openAgentThread, openThread } from './agentSelection'

const NEAR_BOTTOM = 80

interface Props {
  scratchId: number
  state: ChatState
  agents: SubagentItem[]
  // The agents from the outermost down to the one shown (never empty).
  path: LineagePath
  agent: SubagentItem
  dir: 'in' | 'out' | null
  project: string | null
  thread: string
  onTerminal: () => void
}

// The task the agent was given, as a bubble from the right captioned with who sent it; a long one is clipped.
function TaskBubble({ text }: { text: string }) {
  const long = needsClip(text)
  const [full, setFull] = useState(false)
  const clipped = long && !full
  return (
    <div className="flex flex-col items-end gap-1" data-chat="agent-task">
      <span className="text-muted-foreground text-xs">Sent by another agent</span>
      <div className="bg-bubble min-w-0 rounded-[18px] px-[15px] py-[9px] text-[15px] leading-[1.55] [overflow-wrap:anywhere]" style={{ maxWidth: '80%' }}>
        <div className={cn('whitespace-pre-wrap', clipped && 'max-h-[12.4em] overflow-hidden [mask-image:linear-gradient(to_bottom,#000_65%,transparent)]')}>{text}</div>
        {long && (
          <button type="button" aria-expanded={full} onClick={() => setFull((f) => !f)} className="text-muted-foreground hover:text-foreground mt-1 ml-auto block text-[13px]">
            {full ? 'Show less' : 'Show full message'}
          </button>
        )}
      </div>
    </div>
  )
}

// One agent's own conversation in the main column: its task, its work, and no prompt box. Esc and "Open parent" go up one level.
export function AgentThread({ scratchId, state, agents, path, agent, dir, project, thread, onTerminal }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const stuck = useRef(true)
  const row = agentRowFor(agent)
  const running = row.dot === 'running' || row.dot === 'waiting'
  const items = useAgentItems(scratchId, agent.id, running, itemsOf(state, agent.id))
  // The task is shown once, as the bubble above; the agent's own copy of it in its transcript is dropped.
  const shown = useMemo(() => {
    const at = items.findIndex((i) => i.kind === 'user' && i.text.trim() === agent.prompt?.trim())
    return at < 0 ? items : items.filter((_, k) => k !== at)
  }, [items, agent.prompt])
  const titles = useMemo(() => new Map(agents.map((a) => [a.id, agentRowFor(a).description])), [agents])
  const titleOf = (id: string) => titles.get(id) ?? 'Agent'
  const crumbs = buildCrumbs(project, thread, path, titleOf)
  const chip = subagentOf(path, thread, titleOf)
  const up = () => openThread(scratchId, parentPath(path))

  useEffect(() => root.current?.focus({ preventScroll: true }), [])
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && stuck.current) el.scrollTop = el.scrollHeight
  }, [items])

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return
    if (document.querySelector('[data-radix-popper-content-wrapper]')) return
    up()
  }

  return (
    <div ref={root} tabIndex={-1} onKeyDown={onKeyDown} className={cn('relative flex h-full min-h-0 flex-col outline-none', dir === 'out' ? 'm-drill-out' : 'm-drill-in')} data-chat="agent-view">
      <Breadcrumbs crumbs={crumbs} onGo={(p) => openThread(scratchId, p)} />
      <div
        ref={scroller}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label={`Conversation of ${row.description}`}
        onScroll={(e) => {
          const el = e.currentTarget
          stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM
        }}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto flex max-w-[720px] flex-col gap-3.5 px-5 pt-4 pb-4">
          <div className="flex justify-center">
            <span title={chip.full} className="bg-card text-muted-foreground inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-xs">
              <Bot className="size-3.5 shrink-0" aria-hidden />
              <span className="text-foreground shrink-0">{chip.lead}</span>
              <span className="truncate">{chip.parent}</span>
            </span>
          </div>
          {agent.prompt && <TaskBubble text={agent.prompt} />}
          <ConversationList scratchId={scratchId} items={shown} onOpenAgent={(id) => openAgentThread(scratchId, agents, id)} onTerminal={onTerminal} live={running} turnStartedAt={agent.startedAt} />
          {shown.length === 0 && <p className="text-muted-foreground text-[13px]">{running ? 'Waiting for the agent…' : 'No conversation is available for this agent.'}</p>}
        </div>
      </div>
      <AgentBar agent={agent} parentTitle={path.length > 1 ? titleOf(path[path.length - 2]!) : thread} onOpenParent={up} />
    </div>
  )
}

import { memo, useMemo } from 'react'
import { buildRows, type ChatItem, type ChatRow } from '@shared/claude-chat'
import { planTurns, type TurnEntry } from '@shared/chat-summary'
import { AgentsSummary, AssistantText, CommandRow, NoticeRow, SubagentRow, ThinkingRow, ToolGroupRow, ToolRow, TurnFold, TurnRow, UserBubble, WorkingHeading } from './ItemViews'
import { PermissionCard, PlanCard, QuestionCard } from './PromptCards'
import { cn } from '@/lib/utils'
import { chatActions } from './useChat'

interface Props {
  scratchId: number
  items: ChatItem[]
  onOpenAgent: (agentItemId: string) => void
  onTerminal: () => void
  // The Agents panel's smaller style.
  small?: boolean
  // Prompts are answered in the main chat only; elsewhere they show as a muted pointer.
  prompts?: boolean
  // The last turn is still running: it gets a "Working for" heading and its rows stay open.
  live?: boolean
  turnStartedAt?: number | null
}

const ItemView = memo(function ItemView({ scratchId, item, onOpenAgent, onTerminal, small, prompts }: Omit<Props, 'items'> & { item: ChatItem }) {
  switch (item.kind) {
    case 'user':
      return <UserBubble item={item} small={small} />
    case 'text':
      return <AssistantText item={item} small={small} />
    case 'thinking':
      return <ThinkingRow item={item} />
    case 'tool':
      return <ToolRow t={item} small={small} />
    case 'subagent':
      return <SubagentRow item={item} onOpen={onOpenAgent} small={small} />
    case 'permission':
      return prompts === false ? <Pointer answered={item.answer !== null} /> : <PermissionCard scratchId={scratchId} item={item} />
    case 'question':
      return prompts === false ? <Pointer answered={item.answers !== null} /> : <QuestionCard scratchId={scratchId} item={item} />
    case 'plan':
      return prompts === false ? <Pointer answered={item.answer !== null} /> : <PlanCard scratchId={scratchId} item={item} />
    case 'command':
      return <CommandRow item={item} />
    case 'notice':
      return <NoticeRow item={item} onRestart={() => void chatActions.restart(scratchId)} onTerminal={onTerminal} />
    case 'turn':
      return <TurnRow item={item} />
  }
})

function Pointer({ answered }: { answered: boolean }) {
  return <div className="text-muted-foreground text-xs">{answered ? 'Answered in the chat' : 'Waiting for your answer in the chat'}</div>
}

// Long conversations stay cheap: off-screen rows skip layout and paint (the newest ones always render).
const lazy = '[content-visibility:auto] [contain-intrinsic-size:auto_60px]'

type Row =
  | ChatRow
  | { type: 'fold'; id: string; rows: ChatRow[]; ms: number; stopped: boolean; failed: number }
  | { type: 'working'; id: string; startedAt: number }
  | { type: 'agents'; id: string; text: string }

// The turn plan as rows: runs of plain items still fold read-only tools into groups, a turn's fold holds its own groups.
function toRows(entries: TurnEntry[]): Row[] {
  const out: Row[] = []
  let run: ChatItem[] = []
  const flush = () => {
    out.push(...buildRows(run))
    run = []
  }
  for (const e of entries) {
    if (e.type === 'item') {
      run.push(e.item)
      continue
    }
    flush()
    out.push(e.type === 'fold' ? { type: 'fold', id: e.id, rows: buildRows(e.items), ms: e.ms, stopped: e.stopped, failed: e.failed } : e)
  }
  flush()
  return out
}

export const ConversationList = memo(function ConversationList({ scratchId, items, onOpenAgent, onTerminal, small, prompts = true, live = false, turnStartedAt }: Props) {
  const rows = useMemo(() => toRows(planTurns(items, { live, startedAt: turnStartedAt })), [items, live, turnStartedAt])
  const renderRow = (row: ChatRow, cls?: string) =>
    row.type === 'toolGroup' ? (
      <div key={row.id} className={cls}>
        <ToolGroupRow summary={row.summary} items={row.items} small={small} />
      </div>
    ) : (
      <div key={row.item.id} className={cn(cls, row.item.kind === 'user' && 'flex justify-end')} data-item={row.item.kind}>
        <ItemView scratchId={scratchId} item={row.item} onOpenAgent={onOpenAgent} onTerminal={onTerminal} small={small} prompts={prompts} />
      </div>
    )
  return (
    <>
      {rows.map((row, i) => {
        const cls = i >= rows.length - 6 ? undefined : lazy
        if (row.type === 'fold')
          return (
            <div key={row.id} className={cls}>
              <TurnFold ms={row.ms} stopped={row.stopped} failed={row.failed} small={small}>
                {row.rows.map((r) => renderRow(r))}
              </TurnFold>
            </div>
          )
        if (row.type === 'working')
          return (
            <div key={row.id} className={cls}>
              <WorkingHeading startedAt={row.startedAt} small={small} />
            </div>
          )
        if (row.type === 'agents')
          return (
            <div key={row.id} className={cls}>
              <AgentsSummary text={row.text} small={small} />
            </div>
          )
        return renderRow(row, cls)
      })}
    </>
  )
})

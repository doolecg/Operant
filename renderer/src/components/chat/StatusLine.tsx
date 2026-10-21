import type { ChatState } from '@shared/claude-chat'
import { PixelBar } from '@/components/ui/pixel-bar'
import { formatDuration, kTokens } from './chatHelpers'
import { useNow } from './useChat'

// Above the composer while a turn runs: a moving pixel bar (still amber while waiting), the status word derived from real events, the turn time and
// the output tokens so far; "esc to interrupt" at the right. While a prompt is pending it points at the card instead.
export function StatusLine({ state }: { state: ChatState }) {
  const { turn } = state
  const active = turn.phase === 'working' || turn.phase === 'waiting'
  const now = useNow(active && turn.startedAt !== null)
  // The row keeps its height when nothing runs, so the conversation above does not jump 28px at the start and end of a turn.
  if (!active) return <div aria-hidden className="h-7 shrink-0" />
  const waiting = turn.pendingCount > 0
  const elapsed = turn.startedAt !== null ? Math.max(0, now - turn.startedAt) : turn.elapsedMs
  return (
    <div role="status" aria-label="Claude status" data-chat="status-line" className="mx-auto flex w-full max-w-[720px] items-center gap-2 px-5 pb-2 text-[13px]">
      <PixelBar
        fraction={waiting ? 1 : 0}
        sweep={!waiting}
        tone={waiting ? 'warning' : 'primary'}
        width={96}
        label={waiting ? 'Waiting for your answer' : 'Claude is working'}
        className="shrink-0"
      />
      {waiting ? (
        <span className="text-muted-foreground min-w-0 truncate">
          <span className="text-foreground">Needs your answer above</span>
          {turn.pendingLabel && <span> · {turn.pendingLabel}</span>}
        </span>
      ) : (
        <span className="text-muted-foreground min-w-0 truncate">
          <span className="text-foreground">{turn.word || 'Working…'}</span>
          {turn.startedAt !== null && <span> {formatDuration(elapsed)}</span>}
          {turn.outputTokens > 0 && <span> · ↓ {kTokens(turn.outputTokens)} tokens</span>}
        </span>
      )}
      <span className="text-muted-foreground/70 ml-auto shrink-0 text-xs">esc to interrupt</span>
    </div>
  )
}

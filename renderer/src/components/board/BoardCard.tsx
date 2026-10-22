import type { KeyboardEvent } from 'react'
import { Check } from 'lucide-react'
import type { BoardCard as Card, BoardStatus } from '@shared/board'
import { PixelBar } from '@/components/ui/pixel-bar'
import { shortAge } from '@/lib/format'
import { cn } from '@/lib/utils'

const DOT: Record<BoardStatus, string> = {
  working: 'bg-primary motion-safe:animate-pulse',
  needs: 'bg-warning',
  failed: 'bg-destructive',
  done: 'bg-success',
  quiet: 'bg-muted-foreground/40',
}
const LINE: Partial<Record<BoardStatus, string>> = { needs: 'text-warning', failed: 'text-destructive' }
const EDGE: Partial<Record<BoardStatus, string>> = {
  needs: 'before:bg-warning',
  failed: 'before:bg-destructive',
}

function Bar({ status }: { status: BoardStatus }) {
  if (status === 'working') return <PixelBar sweep />
  if (status === 'done') return <PixelBar solid tone="success" />
  if (status === 'needs') return <PixelBar fraction={1} tone="warning" />
  if (status === 'failed') return <PixelBar fraction={1} tone="destructive" />
  return <PixelBar fraction={0} tone="muted" />
}

export function BoardCard({ card, selected, onSelect, onOpen }: { card: Card; selected: boolean; onSelect: () => void; onOpen: () => void }) {
  const { row, status, line } = card
  const key = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
    e.preventDefault()
    onSelect()
  }
  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={0}
      data-board-card={row.id}
      onClick={onSelect}
      onKeyDown={key}
      className={cn(
        'group bg-card hover:bg-accent focus-visible:ring-primary/60 relative cursor-default rounded-[18px] py-[22px] pr-[26px] pl-7 outline-none focus-visible:ring-2',
        selected && 'bg-accent',
        EDGE[status] && cn('before:absolute before:inset-y-[22px] before:left-0 before:w-[3px] before:rounded-r-[3px]', EDGE[status]),
      )}
    >
      <div className="flex min-h-6 items-center gap-2.5">
        <i aria-hidden className={cn('size-[7px] shrink-0 rounded-full', DOT[status])} />
        <h3 title={row.title} className="min-w-0 flex-1 truncate text-[15px] font-semibold">
          {row.title}
        </h3>
        {selected && (
          <span aria-hidden className="bg-primary text-primary-foreground grid size-5 shrink-0 place-items-center rounded-full">
            <Check className="size-3" strokeWidth={2.8} />
          </span>
        )}
      </div>
      {line && (
        <p title={line} className={cn('mt-1.5 truncate pl-[18px] text-[13.5px] leading-[22px]', LINE[status] ?? 'text-foreground/80')}>
          {line}
        </p>
      )}
      <div className={cn('flex items-center gap-3 pl-[18px]', line ? 'mt-[18px]' : 'mt-3.5')}>
        <span className="max-w-[190px] min-w-0 flex-1">
          <Bar status={status} />
        </span>
        <span className="text-muted-foreground ml-auto text-xs whitespace-nowrap">
          {card.project} &middot; {shortAge(row.updatedAt)}
        </span>
      </div>
      <div className="mt-3.5 hidden items-center gap-3 pl-[18px] group-focus-within:flex group-hover:flex">
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">{card.model ?? ''}</span>
        <button
          type="button"
          aria-label={`Open thread ${row.title}`}
          onClick={(e) => (e.stopPropagation(), onOpen())}
          className="bg-muted hover:bg-muted/70 text-foreground focus-visible:ring-primary/60 h-7 shrink-0 rounded-lg px-3 text-[12.5px] outline-none focus-visible:ring-2"
        >
          Open thread
        </button>
      </div>
    </div>
  )
}

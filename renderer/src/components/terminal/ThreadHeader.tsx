import type { ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import type { ScratchView } from '@shared/types'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useChatState } from '@/components/chat/useChat'

// A Claude tile's view switch, as menu items: Chat and Terminal on the same session. A chat may only switch between turns.
function ViewItems({ scratchId, view, onView }: { scratchId: number; view: ScratchView; onView: (v: ScratchView) => void }) {
  const state = useChatState(scratchId)
  const busy = view === 'chat' && !!state && state.turn.phase !== 'idle' && state.process === 'ready'
  return (
    <>
      <DropdownMenuItem disabled={busy} title={busy ? 'Switch views when Claude is not working' : undefined} onSelect={() => onView(view === 'chat' ? 'terminal' : 'chat')}>
        {view === 'chat' ? 'Show the terminal view' : 'Show the chat view'}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
    </>
  )
}

// The top of an open thread, on one line: the title, its state, the stage and Factory chips, the context meter and a menu with the rest
// (the Chat or Terminal view, pop out, close).
export function ThreadHeader({
  title,
  chips,
  badge,
  context,
  claude,
  onPopOut,
  onClose,
}: {
  title: string
  chips?: ReactNode
  badge?: ReactNode
  context?: ReactNode
  claude?: { scratchId: number; view: ScratchView; onView: (v: ScratchView) => void }
  onPopOut?: (() => void) | null
  onClose: () => void
}) {
  return (
    <div data-chat="thread-header" className="mx-auto flex h-[52px] w-full max-w-[760px] shrink-0 items-center gap-3 px-5">
      <h2 title={title} className="min-w-0 flex-1 truncate text-[15px] font-semibold">
        {title}
      </h2>
      {badge}
      {chips}
      {context}
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Thread options" title="Thread options" className="text-muted-foreground hover:bg-accent hover:text-foreground grid size-7 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {claude && <ViewItems {...claude} />}
          {onPopOut && <DropdownMenuItem onSelect={onPopOut}>Open in its own window</DropdownMenuItem>}
          <DropdownMenuItem onSelect={onClose}>Close thread</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

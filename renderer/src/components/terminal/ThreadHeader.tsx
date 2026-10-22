import type { ReactNode } from 'react'
import { PictureInPicture2, X } from 'lucide-react'

const iconBtn = 'text-muted-foreground hover:bg-accent hover:text-foreground grid size-7 shrink-0 place-items-center rounded-full'

// The top of an open thread: its title, the stage and Factory chips, the tile's own status controls, pop out and close.
export function ThreadHeader({ title, chips, badge, status, onPopOut, onClose }: { title: string; chips?: ReactNode; badge?: ReactNode; status?: ReactNode; onPopOut?: (() => void) | null; onClose: () => void }) {
  return (
    <div data-chat="thread-header" className="mx-auto flex min-h-[52px] w-full max-w-[760px] shrink-0 flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2">
      <h2 title={title} className="min-w-[12rem] flex-1 truncate text-[15px] font-semibold">
        {title}
      </h2>
      {badge}
      {chips}
      {status}
      {onPopOut && (
        <button type="button" aria-label={`Pop out ${title}`} title="Open this thread in its own window" onClick={onPopOut} className={iconBtn}>
          <PictureInPicture2 className="size-3.5" />
        </button>
      )}
      <button type="button" aria-label={`Close ${title}`} title="Close this thread" onClick={onClose} className={iconBtn}>
        <X className="size-3.5" />
      </button>
    </div>
  )
}

import { Fragment } from 'react'
import type { Crumb, LineagePath } from '@shared/chat-lineage'
import { cn } from '@/lib/utils'

// Project / the tile's thread / agent / its agent: every crumb but the last jumps back to that level.
export function Breadcrumbs({ crumbs, onGo }: { crumbs: Crumb[]; onGo: (path: LineagePath) => void }) {
  return (
    <nav aria-label="Conversation path" className="shrink-0 px-4 pt-3 pb-1">
      <ol className="flex min-w-0 items-center gap-1.5 text-[13px]">
        {crumbs.map((c, i) => (
          <Fragment key={c.key}>
            {i > 0 && (
              <li aria-hidden className="text-muted-foreground/60 shrink-0">
                /
              </li>
            )}
            <li className={cn('min-w-0', c.to === null ? 'shrink' : 'shrink-[3]')}>
              {c.to === null ? (
                <span aria-current="page" title={c.full} className="block truncate font-medium">
                  {c.label}
                </span>
              ) : (
                <button type="button" title={c.full} onClick={() => onGo(c.to!)} className="text-muted-foreground hover:text-foreground m-press block max-w-full truncate rounded-md px-1 py-0.5">
                  {c.label}
                </button>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}

import type { ReactNode } from 'react'

// The one row every tool on the Install page uses: name, status badge and tag; one description; an optional detail line; the actions in fixed slots.
export function ToolRow({
  testId,
  name,
  badge,
  tag,
  description,
  detail,
  error,
  install,
  add,
  remove,
  below,
}: {
  testId: string
  name: string
  badge: ReactNode
  tag: 'required' | 'optional'
  description: string
  detail?: ReactNode
  error?: string | null
  install?: ReactNode
  add?: ReactNode
  remove?: ReactNode
  below?: ReactNode
}) {
  return (
    <div className="py-3" data-testid={testId}>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{name}</span>
            {badge}
            <span className="text-muted-foreground text-[11px] uppercase">{tag}</span>
          </div>
          <p className="text-muted-foreground text-xs">{description}</p>
          {detail && <p className="text-muted-foreground text-xs">{detail}</p>}
          {error && (
            <p role="alert" className="text-destructive text-xs">
              {error}
            </p>
          )}
        </div>
        <div className="grid shrink-0 grid-cols-[8rem_6rem_6.5rem] items-start gap-2 [&_button]:w-full">
          <div>{install}</div>
          <div>{add}</div>
          <div>{remove}</div>
        </div>
      </div>
      {below}
    </div>
  )
}

import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

// One section of the Agents card: the thin divider above it is the only separator between sections.
export const SECTION = 'surface-line border-t px-3 py-2'

interface PanelRowProps extends Omit<ComponentProps<'div'>, 'children'> {
  icon: ReactNode
  label: ReactNode
  sub?: ReactNode
  trailing?: ReactNode
}

// A card row: a 16px icon, a medium 13px label with an optional muted line under it, and a trailing element.
export function PanelRow({ icon, label, sub, trailing, className, ...rest }: PanelRowProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3 px-1 py-1.5', className)} {...rest}>
      <span className="grid size-4 shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] leading-snug font-medium">{label}</span>
        {sub && <span className="text-muted-foreground block truncate text-xs">{sub}</span>}
      </span>
      {trailing}
    </div>
  )
}

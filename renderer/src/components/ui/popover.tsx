import * as React from 'react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger

export function PopoverContent({ className, align = 'start', sideOffset = 6, ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn('m-surface origin-(--radix-popover-content-transform-origin) bg-popover surface-edge text-popover-foreground z-50 w-80 rounded-[18px] p-0 outline-none', className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

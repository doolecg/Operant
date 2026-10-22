import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

// The size of a data URL's picture: "4KB", "1.2MB".
export function imageSize(dataUrl: string): string {
  const bytes = Math.max(0, ((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4)
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

// An image as a small chip: a tiny thumbnail, its name and its size. Clicking opens it; the x (when given) removes it.
export function ImageChip({ src, name, onOpen, onRemove, className }: { src: string; name: string; onOpen?: () => void; onRemove?: () => void; className?: string }) {
  return (
    <span className={cn('border-border bg-accent/60 inline-flex h-[26px] max-w-full items-center gap-1.5 rounded-full border pr-2 pl-1 text-[12.5px]', className)}>
      <button type="button" aria-label={`Open ${name}`} title="Open image" onClick={onOpen} className="focus-visible:ring-ring inline-flex min-w-0 items-center gap-1.5 rounded-full outline-none focus-visible:ring-2">
        <img src={src} alt="" className="size-[18px] shrink-0 rounded-md object-cover" />
        <span className="min-w-0 truncate">{name}</span>
        <span className="text-muted-foreground shrink-0 text-[11.5px]">{imageSize(src)}</span>
      </button>
      {onRemove && (
        <button type="button" aria-label={`Remove ${name}`} onClick={onRemove} className="text-muted-foreground hover:text-foreground grid shrink-0 place-items-center">
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}
